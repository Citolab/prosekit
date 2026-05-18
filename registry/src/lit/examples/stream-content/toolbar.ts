import { ContextConsumer } from '@lit/context'
import { streamContent } from '@prosekit/ai'
import { html, LitElement, nothing } from 'lit'
import type { Editor } from 'prosekit/core'

import { editorContext } from '../../ui/editor-context'

const API_KEY_STORAGE_KEY = 'prosekit-stream-content-api-key'
const MODEL_STORAGE_KEY = 'prosekit-stream-content-model'
const DEFAULT_MODEL = 'gpt-4o-mini'

function readStorage(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage might be disabled; ignore.
  }
}

export class LitStreamContentToolbar extends LitElement {
  static override properties = {
    apiKey: { state: true },
    model: { state: true },
    prompt: { state: true },
    streaming: { state: true },
  }

  private apiKey = ''
  private model = DEFAULT_MODEL
  private prompt = 'Write a short article about prosemirror.'
  private streaming = false
  private abortController: AbortController | null = null

  private editorConsumer = new ContextConsumer(this, {
    context: editorContext,
    subscribe: true,
  })

  override createRenderRoot() {
    return this
  }

  override connectedCallback() {
    super.connectedCallback()
    this.apiKey = readStorage(API_KEY_STORAGE_KEY)
    this.model = readStorage(MODEL_STORAGE_KEY, DEFAULT_MODEL)
    this.classList.add('contents')
  }

  private onApiKeyInput = (event: Event): void => {
    this.apiKey = (event.target as HTMLInputElement).value
    writeStorage(API_KEY_STORAGE_KEY, this.apiKey)
  }

  private onModelInput = (event: Event): void => {
    this.model = (event.target as HTMLInputElement).value
    writeStorage(MODEL_STORAGE_KEY, this.model)
  }

  private onPromptInput = (event: Event): void => {
    this.prompt = (event.target as HTMLInputElement).value
  }

  private onSubmit = async (event: Event): Promise<void> => {
    event.preventDefault()
    const editor = this.editorConsumer.value
    if (!editor || !this.apiKey || !this.prompt || this.streaming) return

    const controller = new AbortController()
    this.abortController = controller
    this.streaming = true

    const { from, to } = editor.view.state.selection
    try {
      const { streamFromOpenAI } = await import('./openai')
      await streamContent(editor.view, {
        from,
        to,
        signal: controller.signal,
        onStream: (write) =>
          streamFromOpenAI({
            apiKey: this.apiKey,
            model: this.model || DEFAULT_MODEL,
            prompt: this.prompt,
            write,
            signal: controller.signal,
          }),
      })
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.error('streamContent failed:', error)
      }
    } finally {
      if (this.abortController === controller) this.abortController = null
      this.streaming = false
    }
  }

  private onStop = (): void => {
    this.abortController?.abort()
  }

  override render() {
    const editor = this.editorConsumer.value as Editor | undefined
    if (!editor) return nothing

    const inputCls
      = 'px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm'

    return html`
      <form
        @submit=${this.onSubmit}
        class="CSS_TOOLBAR not-content flex-col items-stretch gap-2"
      >
        <input
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Azure Foundry API key (stored in localStorage)"
          .value=${this.apiKey}
          @input=${this.onApiKeyInput}
          class="${inputCls} w-full"
        />
        <div class="flex gap-2 items-center w-full">
          <input
            type="text"
            spellcheck="false"
            placeholder="Model (default: ${DEFAULT_MODEL})"
            .value=${this.model}
            @input=${this.onModelInput}
            class="${inputCls} w-40 shrink-0"
          />
          <input
            type="text"
            placeholder="Prompt the AI…"
            .value=${this.prompt}
            @input=${this.onPromptInput}
            class="${inputCls} flex-1"
          />
          ${this.streaming
            ? html`
                <button
                  type="button"
                  @click=${this.onStop}
                  class="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                >
                  Stop
                </button>
              `
            : html`
                <button
                  type="submit"
                  ?disabled=${!this.apiKey || !this.prompt}
                  class="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Generate
                </button>
              `}
        </div>
      </form>
    `
  }
}

export function registerLitStreamContentToolbar(): void {
  if (customElements.get('lit-stream-content-toolbar')) return
  customElements.define('lit-stream-content-toolbar', LitStreamContentToolbar)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-stream-content-toolbar': LitStreamContentToolbar
  }
}
