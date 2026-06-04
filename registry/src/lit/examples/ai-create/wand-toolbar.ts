import { ContextConsumer } from '@lit/context'
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom'
import { html, LitElement, type PropertyDeclaration } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import { defineUpdateHandler } from 'prosekit/core'
import { TextSelection } from 'prosekit/pm/state'

import { editorContext } from '../../ui/editor-context'

import {
  AI_PROMPTS,
  type AiCreateRequestDetail,
  type AiPrompt,
} from './prompts'

class LitAiCreateToolbar extends LitElement {
  static override properties = {
    openMenu: { state: true, attribute: false } satisfies PropertyDeclaration<boolean>,
  }

  private openMenu = false

  private editorConsumer = new ContextConsumer(this, {
    context: editorContext,
    subscribe: true,
  })

  private removeUpdateExtension?: VoidFunction
  private wandButtonRef: Ref<HTMLButtonElement> = createRef<HTMLButtonElement>()
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
    const anchor = this.wandButtonRef.value
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
    if (this.openMenu) {
      this.openMenu = false
      return
    }
    this.selectCursorBlockIfCollapsed()
    this.openMenu = true
  }

  private selectCursorBlockIfCollapsed() {
    const editor = this.editorConsumer.value
    if (!editor) return
    const view = editor.view
    // Respect an existing non-empty selection — only expand when collapsed.
    if (!view.state.selection.empty) {
      view.focus()
      return
    }
    const { $from } = view.state.selection
    const from = $from.start(1)
    const to = $from.end(1)
    if (from === to) return
    const tr = view.state.tr.setSelection(
      TextSelection.create(view.state.doc, from, to),
    )
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    view.focus()
  }

  private runPrompt(prompt: AiPrompt) {
    const editor = this.editorConsumer.value
    if (!editor) return
    const { from, to } = editor.view.state.selection
    if (from === to) return
    this.openMenu = false
    this.dispatchEvent(
      new CustomEvent<AiCreateRequestDetail>('ai-create-request', {
        bubbles: true,
        composed: true,
        detail: { from, to, prompt },
      }),
    )
  }

  override render() {
    return html`
      <div
        class="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-800"
        data-testid="ai-create-toolbar"
      >
        <button
          ${ref(this.wandButtonRef)}
          type="button"
          @click=${this.toggleMenu}
          title="AI Create — rewrite the selection (or the block at the cursor)"
          class="CSS_TOGGLE_BUTTON"
        >
          <div class="CSS_ICON_WAND"></div>
        </button>
      </div>

      <div
        ${ref(this.menuRef)}
        popover="auto"
        @toggle=${this.onToggleMenu}
        class="ai-create-toolbar-menu flex flex-col min-w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 shadow"
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

export function registerLitAiCreateToolbar() {
  if (customElements.get('lit-ai-create-toolbar')) return
  customElements.define('lit-ai-create-toolbar', LitAiCreateToolbar)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ai-create-toolbar': LitAiCreateToolbar
  }
}
