import { html, LitElement, type PropertyDeclaration } from 'lit'

class LitAiChatToolbar extends LitElement {
  static override properties = {
    open: { attribute: false } satisfies PropertyDeclaration<boolean>,
  }

  open = false

  override createRenderRoot() {
    return this
  }

  private toggle = () => {
    this.dispatchEvent(
      new CustomEvent('ai-chat-toggle', { bubbles: true, composed: true }),
    )
  }

  override render() {
    return html`
      <div
        class="flex items-center justify-end p-2 border-b border-gray-200 dark:border-gray-800"
        data-testid="ai-chat-toolbar"
      >
        <button
          type="button"
          @click=${this.toggle}
          class="px-2 py-1 rounded text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ${this.open ? 'Close chat' : 'Chat'}
        </button>
      </div>
    `
  }
}

export function registerLitAiChatToolbar() {
  if (customElements.get('lit-ai-chat-toolbar')) return
  customElements.define('lit-ai-chat-toolbar', LitAiChatToolbar)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ai-chat-toolbar': LitAiChatToolbar
  }
}
