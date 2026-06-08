import { ContextConsumer } from '@lit/context'
import {
  parseHtmlToSlice,
  serializeDocToHtml,
  serializeSelectionToHtml,
} from '@prosekit/ai'
import { html, LitElement, nothing, type PropertyDeclaration } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import { defineUpdateHandler, type Editor } from 'prosekit/core'
import { Selection as PmSelection } from 'prosekit/pm/state'

import { editorContext } from '../../ui/editor-context'

import type { ChatMessage } from './llm.ts'

const API_KEY_STORAGE_KEY = 'prosekit-stream-content-api-key'
const MODEL_STORAGE_KEY = 'prosekit-stream-content-model'
const ENDPOINT_STORAGE_KEY = 'prosekit-stream-content-endpoint'
const DEFAULT_MODEL = 'gpt-4o-mini'

function readStorage(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

interface UiMessage extends ChatMessage {
  id: number
  scope: 'selection' | 'document'
  streaming?: boolean
}

class LitAiChatSidebar extends LitElement {
  static override properties = {
    open: { attribute: false } satisfies PropertyDeclaration<boolean>,
    messages: { state: true, attribute: false } satisfies PropertyDeclaration<UiMessage[]>,
    draft: { state: true, attribute: false } satisfies PropertyDeclaration<string>,
    streaming: { state: true, attribute: false } satisfies PropertyDeclaration<boolean>,
  }

  open = false
  private messages: UiMessage[] = []
  private draft = ''
  private streaming = false

  private editorConsumer = new ContextConsumer(this, {
    context: editorContext,
    subscribe: true,
  })

  private threadRef: Ref<HTMLDivElement> = createRef<HTMLDivElement>()
  private currentController?: AbortController
  private nextId = 1
  private removeUpdateHandler?: VoidFunction

  override createRenderRoot() {
    return this
  }

  override connectedCallback() {
    super.connectedCallback()
    this.attachEditorListener()
  }

  override disconnectedCallback() {
    this.detachEditorListener()
    this.currentController?.abort()
    super.disconnectedCallback()
  }

  override updated() {
    this.attachEditorListener()
    const thread = this.threadRef.value
    if (thread) thread.scrollTop = thread.scrollHeight
  }

  private attachEditorListener() {
    if (this.removeUpdateHandler) return
    const editor = this.editorConsumer.value
    if (!editor) return
    this.removeUpdateHandler = editor.use(
      defineUpdateHandler(() => this.requestUpdate()),
    )
  }

  private detachEditorListener() {
    this.removeUpdateHandler?.()
    this.removeUpdateHandler = undefined
  }

  private getEditor(): Editor | undefined {
    return this.editorConsumer.value
  }

  private hasSelection(): boolean {
    const editor = this.getEditor()
    if (!editor) return false
    const { from, to } = editor.view.state.selection
    return from !== to
  }

  private onInput = (event: Event) => {
    this.draft = (event.target as HTMLInputElement).value
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void this.submit()
    }
  }

  private updateMessage(id: number, patch: Partial<UiMessage>) {
    this.messages = this.messages.map((m) => (m.id === id ? { ...m, ...patch } : m))
  }

  private async submit() {
    const editor = this.getEditor()
    if (!editor || !this.draft.trim() || this.streaming) return

    const apiKey = readStorage(API_KEY_STORAGE_KEY)
    const endpoint = readStorage(ENDPOINT_STORAGE_KEY)
    if (!apiKey || !endpoint) {
      window.alert(
        'No API endpoint or key found. Open the Stream Content story first and configure both.',
      )
      return
    }

    const selectionHtml = serializeSelectionToHtml(editor)
    const documentHtml = serializeDocToHtml(editor)
    const scope: 'selection' | 'document' = selectionHtml ? 'selection' : 'document'

    const userMessage: UiMessage = { id: this.nextId++, role: 'user', content: this.draft.trim(), scope }
    const assistantMessage: UiMessage = { id: this.nextId++, role: 'assistant', content: '', scope, streaming: true }
    const assistantId = assistantMessage.id
    this.messages = [...this.messages, userMessage, assistantMessage]
    this.draft = ''
    this.streaming = true

    const controller = new AbortController()
    this.currentController = controller
    let assistantContent = ''

    try {
      const { streamChatFromOpenAI } = await import('./llm')
      await streamChatFromOpenAI({
        endpoint,
        apiKey,
        model: readStorage(MODEL_STORAGE_KEY, DEFAULT_MODEL) || DEFAULT_MODEL,
        messages: this.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        documentHtml,
        selectionHtml,
        write: (chunk) => {
          assistantContent += chunk
          this.updateMessage(assistantId, { content: assistantContent })
        },
        signal: controller.signal,
      })
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.error('AI chat failed:', error)
        this.updateMessage(assistantId, { content: assistantContent || 'Failed to get a response.' })
      }
    } finally {
      if (this.currentController === controller) {
        this.streaming = false
        this.updateMessage(assistantId, { streaming: false })
        this.currentController = undefined
      }
    }
  }

  private copy = async (htmlString: string) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = htmlString
    const text = tmp.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  private insert = (htmlString: string) => {
    const editor = this.getEditor()
    if (!editor || !htmlString) return
    const view = editor.view
    const { from, to } = view.state.selection
    const $from = view.state.doc.resolve(from)
    const parsed = parseHtmlToSlice(editor, htmlString, $from)
    const tr = view.state.tr.replaceRange(from, to, parsed)
    tr.setSelection(PmSelection.near(tr.doc.resolve(from + parsed.size)))
    view.dispatch(tr)
    view.focus()
  }

  private close = () => {
    this.dispatchEvent(
      new CustomEvent('ai-chat-toggle', { bubbles: true, composed: true }),
    )
  }

  private renderMessage(m: UiMessage) {
    if (m.role === 'user') {
      return html`
        <div>
          <div>You · ${m.scope}</div>
          <div>${m.content}</div>
        </div>
      `
    }
    const showActions = !m.streaming && m.content
    return html`
      <div>
        <div>AI</div>
        <div
          .innerHTML=${m.content || (m.streaming ? '…' : '')}
        ></div>
        ${showActions
          ? html`
              <div class="flex gap-2 mt-1">
                <button
                  type="button"
                  @click=${() => this.copy(m.content)}
                  class="underline text-gray-600 dark:text-gray-300"
                >
                  Copy
                </button>
                <button
                  type="button"
                  @click=${() => this.insert(m.content)}
                  class="underline text-gray-600 dark:text-gray-300"
                >
                  Insert
                </button>
              </div>
            `
          : nothing}
      </div>
    `
  }

  override render() {
    if (!this.open) return nothing
    const scope = this.hasSelection() ? 'selection' : 'document'
    return html`
      <aside class="fixed right-0 inset-y-0 w-80 flex flex-col bg-[canvas] z-10" data-testid="ai-chat-sidebar">
        <div class="flex items-center px-2 py-1 border-b border-gray-200 dark:border-gray-800">
          <div class="font-medium flex-1">Chat</div>
          <button
            type="button"
            @click=${this.close}
            class="px-2"
            title="Close"
          >
            ×
          </button>
        </div>

        <div ${ref(this.threadRef)} class="flex-1 overflow-y-auto">
          ${this.messages.length === 0
            ? html`<div class="text-gray-500">
                Ask a question. Select text in the editor first to scope to that selection.
              </div>`
            : this.messages.map((m) => this.renderMessage(m))}
        </div>

        <form
          class="flex flex-col gap-1 p-2 border-t border-gray-200 dark:border-gray-800"
          @submit=${(e: Event) => { e.preventDefault(); void this.submit() }}
        >
          <div class="text-gray-500">Scope: ${scope}</div>
          <div class="flex gap-1">
            <input
              type="text"
              .value=${this.draft}
              @input=${this.onInput}
              @keydown=${this.onKeyDown}
              placeholder="Ask…"
              ?disabled=${this.streaming}
              class="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
            <button
              type="submit"
              ?disabled=${this.streaming || !this.draft.trim()}
              class="px-3 py-1 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </aside>
    `
  }
}

export function registerLitAiChatSidebar() {
  if (customElements.get('lit-ai-chat-sidebar')) return
  customElements.define('lit-ai-chat-sidebar', LitAiChatSidebar)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ai-chat-sidebar': LitAiChatSidebar
  }
}
