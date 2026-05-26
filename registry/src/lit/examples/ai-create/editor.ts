import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'

import './ai-create.css'

import { ContextProvider } from '@lit/context'
import { html, LitElement, type PropertyDeclaration, type PropertyValues } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import type { Editor } from 'prosekit/core'
import { createEditor } from 'prosekit/core'

import { sampleContent } from '../../sample/sample-doc-ai-create'
import { editorContext } from '../../ui/editor-context'

import { registerLitAiCreateResult } from './create-popover'
import { defineExtension } from './extension'
import { registerLitAiCreateToolbar } from './wand-toolbar'

export class LitEditor extends LitElement {
  static override properties = {
    editor: {
      state: true,
      attribute: false,
    } satisfies PropertyDeclaration<Editor>,
  }

  private editor: Editor
  private ref: Ref<HTMLDivElement>
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

  override disconnectedCallback() {
    this.editor.unmount()
    super.disconnectedCallback()
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties)
    this.editor.mount(this.ref.value)
  }

  override render() {
    return html`<div class="CSS_EDITOR_VIEWPORT">
      <lit-ai-create-toolbar></lit-ai-create-toolbar>
      <div class="CSS_EDITOR_SCROLLING">
        <div ${ref(this.ref)} class="CSS_EDITOR_CONTENT"></div>
        <lit-ai-create-result style="display: contents;"></lit-ai-create-result>
      </div>
    </div>`
  }
}

export function registerLitEditor() {
  registerLitAiCreateToolbar()
  registerLitAiCreateResult()

  if (customElements.get('lit-editor-example-ai-create')) return
  customElements.define('lit-editor-example-ai-create', LitEditor)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-editor-example-ai-create': LitEditor
  }
}
