import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'
import 'prosekit/extensions/commit/style.css'

import './ai-check.css'

import { ContextProvider } from '@lit/context'
import { html, LitElement, type PropertyDeclaration, type PropertyValues } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import type { Editor } from 'prosekit/core'
import { createEditor } from 'prosekit/core'

import { sampleContent } from '../../sample/sample-doc-ai-check'
import { editorContext } from '../../ui/editor-context'

import { registerLitAiCheckAcceptToolbar } from './accept-toolbar'
import { defineExtension } from './extension'
import { registerLitAiCheckFragmentPopover } from './fragment-popover'
import { registerLitAiCheckToolbar } from './robot-toolbar'

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
      <lit-ai-check-toolbar></lit-ai-check-toolbar>
      <div class="CSS_EDITOR_SCROLLING">
        <div ${ref(this.ref)} class="CSS_EDITOR_CONTENT"></div>
        <lit-ai-check-accept-toolbar style="display: contents;"></lit-ai-check-accept-toolbar>
        <lit-ai-check-fragment-popover style="display: contents;"></lit-ai-check-fragment-popover>
      </div>
    </div>`
  }
}

export function registerLitEditor() {
  registerLitAiCheckToolbar()
  registerLitAiCheckAcceptToolbar()
  registerLitAiCheckFragmentPopover()

  if (customElements.get('lit-editor-example-ai-check')) return
  customElements.define('lit-editor-example-ai-check', LitEditor)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-editor-example-ai-check': LitEditor
  }
}
