import 'prosekit/basic/style.css'
import 'prosekit/basic/typography.css'
import 'prosekit/extensions/column-layout/style.css'

import { html, LitElement, type PropertyDeclaration, type PropertyValues } from 'lit'
import { createRef, ref, type Ref } from 'lit/directives/ref.js'
import { createEditor, defineUpdateHandler, findParentNode, type Editor } from 'prosekit/core'

import { defineExtension } from './extension'

export class LitEditor extends LitElement {
  static override properties = {
    editor: {
      state: true,
      attribute: false,
    } satisfies PropertyDeclaration<Editor>,
  }

  private editor: Editor
  private ref: Ref<HTMLDivElement>
  private disposeUpdate: VoidFunction

  constructor() {
    super()

    const extension = defineExtension()
    this.editor = createEditor({ extension })
    this.editor.setContent(
      '<p>Select a block and choose a column layout.</p><p>You can also select multiple blocks first.</p>',
    )
    this.disposeUpdate = this.editor.use(defineUpdateHandler(() => this.requestUpdate()))
    this.ref = createRef<HTMLDivElement>()
  }

  override createRenderRoot() {
    return this
  }

  override disconnectedCallback() {
    this.disposeUpdate()
    this.editor.unmount()
    super.disconnectedCallback()
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties)
    this.editor.mount(this.ref.value)
  }

  private getActiveColumnCount(): number {
    const found = findParentNode(
      (node) => node.type.name === 'columnBlock',
      this.editor.state.selection.$from,
    )
    return found?.node.childCount ?? 0
  }

  override render() {
    const currentColumns = this.getActiveColumnCount()

    return html`
      <style>
        .column-layout-toolbar {
          display: flex;
          gap: 0.5rem;
          margin: 0 0 0.75rem;
        }

        .column-layout-toolbar button {
          border: 1px solid rgb(203 213 225);
          border-radius: 0.45rem;
          background: white;
          color: rgb(15 23 42);
          font: inherit;
          font-size: 0.875rem;
          padding: 0.3rem 0.6rem;
          cursor: pointer;
        }

        .column-layout-toolbar button[data-active] {
          border-color: rgb(14 116 144);
          background: rgb(224 242 254);
          color: rgb(12 74 110);
        }

        .column-layout-toolbar button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      </style>

      <div class="CSS_EDITOR_VIEWPORT">
        <div class="column-layout-toolbar">
          <button
            ?data-active=${currentColumns === 2}
            ?disabled=${!this.editor.commands.setColumns.canExec(2)}
            @click=${() => this.editor.commands.setColumns(2)}
          >
            2 Columns
          </button>
          <button
            ?data-active=${currentColumns === 3}
            ?disabled=${!this.editor.commands.setColumns.canExec(3)}
            @click=${() => this.editor.commands.setColumns(3)}
          >
            3 Columns
          </button>
          <button
            ?data-active=${currentColumns === 4}
            ?disabled=${!this.editor.commands.setColumns.canExec(4)}
            @click=${() => this.editor.commands.setColumns(4)}
          >
            4 Columns
          </button>
          <button
            ?disabled=${!this.editor.commands.unsetColumns.canExec()}
            @click=${() => this.editor.commands.unsetColumns()}
          >
            Remove
          </button>
        </div>

        <div class="CSS_EDITOR_SCROLLING">
          <div ${ref(this.ref)} class="CSS_EDITOR_CONTENT"></div>
        </div>
      </div>
    `
  }
}

export function registerLitEditor() {
  if (customElements.get('lit-editor-example-column-layout')) return
  customElements.define('lit-editor-example-column-layout', LitEditor)
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-editor-example-column-layout': LitEditor
  }
}
