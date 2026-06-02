import { ContextConsumer } from '@lit/context'
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom'
import { html, LitElement, nothing, type PropertyDeclaration } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import { parseHtmlToDoc, serializeDocToHtml } from '@prosekit/ai'
import { defineUpdateHandler, type Editor } from 'prosekit/core'
import { Slice } from 'prosekit/pm/model'

import { editorContext } from '../../ui/editor-context'

import { commitRecorder, type EditorExtension } from './extension'
import { AI_PROMPTS, type AiPrompt } from './prompts'

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

class LitAiCheckToolbar extends LitElement {
  static override properties = {
    openMenu: { state: true, attribute: false } satisfies PropertyDeclaration<boolean>,
    running: { state: true, attribute: false } satisfies PropertyDeclaration<boolean>,
  }

  private openMenu = false
  private running = false

  private editorConsumer = new ContextConsumer(this, {
    context: editorContext,
    subscribe: true,
  })

  private removeUpdateExtension?: VoidFunction
  private robotButtonRef: Ref<HTMLButtonElement> = createRef<HTMLButtonElement>()
  private menuRef: Ref<HTMLDivElement> = createRef<HTMLDivElement>()
  private cleanupAutoUpdate?: () => void

  override createRenderRoot() {
    return this
  }

  override connectedCallback() {
    super.connectedCallback()
    this.attachEditorListener()
  }

  override disconnectedCallback() {
    this.detachEditorListener()
    this.stopAutoUpdate()
    super.disconnectedCallback()
  }

  override updated() {
    this.attachEditorListener()
    const menuEl = this.menuRef.value
    const anchor = this.robotButtonRef.value
    if (!menuEl || !anchor) return
    const isOpen = menuEl.matches(':popover-open')
    if (this.openMenu && !isOpen) {
      menuEl.showPopover()
      this.startAutoUpdate(anchor, menuEl)
    } else if (!this.openMenu && isOpen) {
      menuEl.hidePopover()
      this.stopAutoUpdate()
    }
  }

  private attachEditorListener() {
    if (this.removeUpdateExtension) return
    const editor = this.editorConsumer.value
    if (!editor) return
    this.removeUpdateExtension = editor.use(
      defineUpdateHandler(() => this.requestUpdate()),
    )
  }

  private detachEditorListener() {
    this.removeUpdateExtension?.()
    this.removeUpdateExtension = undefined
  }

  private startAutoUpdate(anchor: HTMLElement, menuEl: HTMLElement) {
    this.stopAutoUpdate()
    this.cleanupAutoUpdate = autoUpdate(anchor, menuEl, async () => {
      const { x, y } = await computePosition(anchor, menuEl, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      })
      Object.assign(menuEl.style, { left: `${x}px`, top: `${y}px` })
    })
  }

  private stopAutoUpdate() {
    this.cleanupAutoUpdate?.()
    this.cleanupAutoUpdate = undefined
  }

  private onToggleMenu = (event: ToggleEvent) => {
    if (event.newState === 'closed' && this.openMenu) {
      this.openMenu = false
    }
  }

  private toggleMenu = () => {
    this.openMenu = !this.openMenu
  }

  private async runPrompt(prompt: AiPrompt) {
    if (this.running) return
    const editor = this.editorConsumer.value as Editor<EditorExtension> | undefined
    if (!editor) return

    const apiKey = readStorage(API_KEY_STORAGE_KEY)
    const endpoint = readStorage(ENDPOINT_STORAGE_KEY)
    if (!apiKey || !endpoint) {
      window.alert(
        'No API endpoint or key found. Open the Stream Content story first and configure both.',
      )
      return
    }

    this.openMenu = false
    this.running = true
    const view = editor.view
    const from = 0
    const to = view.state.doc.content.size

    const originalHtml = serializeDocToHtml(editor)

    const controller = new AbortController()
    const model = readStorage(MODEL_STORAGE_KEY, DEFAULT_MODEL) || DEFAULT_MODEL

    try {
      let htmlBuffer = ''
      const { streamFromOpenAI } = await import('./openai')
      await streamFromOpenAI({
        endpoint,
        apiKey,
        model,
        prompt: `${prompt.instruction}\n\n---\n${originalHtml}`,
        write: (chunk: string) => {
          htmlBuffer += chunk
        },
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      commitRecorder.init(view.state.doc)

      // Parse as a full doc node, then use the resulting closed fragment
      // (openStart=0, openEnd=0) to replace the editor's content. This
      // avoids ambiguous slice boundaries that produce phantom whitespace
      // deletions in the diff.
      const parsed = parseHtmlToDoc(editor, htmlBuffer)
      const slice = new Slice(parsed.content, 0, 0)
      const tr = view.state.tr.replace(from, to, slice)
      view.dispatch(tr)

      const commit = commitRecorder.commit()
      if (commit) {
        editor.commands.addAiDiff(commit)
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        console.error('AI check failed:', error)
      }
      commitRecorder.init(view.state.doc)
    } finally {
      this.running = false
    }
  }

  override render() {
    return html`
      <div
        class="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-800"
        data-testid="ai-check-toolbar"
      >
        <button
          ${ref(this.robotButtonRef)}
          type="button"
          @click=${this.toggleMenu}
          ?disabled=${this.running}
          title="AI Check — scan the whole document"
          class="CSS_TOGGLE_BUTTON"
        >
          <div class="CSS_ICON_ROBOT"></div>
        </button>
        ${this.running
          ? html`<span class="text-xs text-gray-500 ml-2">Scanning…</span>`
          : nothing}
      </div>

      <div
        ${ref(this.menuRef)}
        popover="auto"
        @toggle=${this.onToggleMenu}
        class="ai-check-toolbar-menu flex flex-col min-w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 shadow"
        style="position: fixed; margin: 0;"
      >
        ${AI_PROMPTS.map(
          (prompt) => html`
            <button
              type="button"
              @click=${() => this.runPrompt(prompt)}
              class="text-left px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ${prompt.label}
            </button>
          `,
        )}
      </div>
    `
  }
}

export function registerLitAiCheckToolbar() {
  if (customElements.get('lit-ai-check-toolbar')) return
  customElements.define('lit-ai-check-toolbar', LitAiCheckToolbar)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ai-check-toolbar': LitAiCheckToolbar
  }
}
