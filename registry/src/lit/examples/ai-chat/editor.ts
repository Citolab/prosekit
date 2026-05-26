import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'

import './ai-chat.css'

import { ContextProvider } from '@lit/context'
import { html, LitElement, type PropertyDeclaration, type PropertyValues } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import type { Editor } from 'prosekit/core'
import { createEditor } from 'prosekit/core'

import { sampleContent } from '../../sample/sample-doc-ai-chat'
import { editorContext } from '../../ui/editor-context'

import { registerLitAiChatSidebar } from './chat-sidebar'
import { registerLitAiChatToolbar } from './chat-toolbar'
import { defineExtension } from './extension'

export class LitEditor extends LitElement {
  static override properties = {
    editor: {
      state: true,
      attribute: false,
    } satisfies PropertyDeclaration<Editor>,
    chatOpen: {
      state: true,
      attribute: false,
    } satisfies PropertyDeclaration<boolean>,
  }

  private editor: Editor
  private ref: Ref<HTMLDivElement>
  private chatOpen = false
  constructor() {
    super()

    const extension = defineExtension()
    this.editor = createEditor({ extension, defaultContent: sampleContent })
    this.ref = createRef<HTMLDivElement>()
    new ContextProvider(this, {
      context: editorContext,
      initialValue: this.editor,
    })
  }

  override createRenderRoot() {
    return this
  }

  override connectedCallback() {
    super.connectedCallback()
    this.addEventListener('ai-chat-toggle', this.toggleChat)
  }

  override disconnectedCallback() {
    this.removeEventListener('ai-chat-toggle', this.toggleChat)
    this.editor.unmount()
    super.disconnectedCallback()
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties)
    this.editor.mount(this.ref.value)
  }

  private toggleChat = () => {
    this.chatOpen = !this.chatOpen
  }

  override render() {
    return html`
      <div class="CSS_EDITOR_VIEWPORT">
        <lit-ai-chat-toolbar .open=${this.chatOpen}></lit-ai-chat-toolbar>
        <div class="CSS_EDITOR_SCROLLING">
          <div ${ref(this.ref)} class="CSS_EDITOR_CONTENT"></div>
        </div>
      </div>
      <lit-ai-chat-sidebar .open=${this.chatOpen}></lit-ai-chat-sidebar>
    `
  }
}

export function registerLitEditor() {
  registerLitAiChatToolbar()
  registerLitAiChatSidebar()

  if (customElements.get('lit-editor-example-ai-chat')) return
  customElements.define('lit-editor-example-ai-chat', LitEditor)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-editor-example-ai-chat': LitEditor
  }
}
