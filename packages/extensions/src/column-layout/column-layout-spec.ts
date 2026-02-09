import { defineNodeSpec, union, type Extension } from '@prosekit/core'

import { COLUMN_BLOCK_NODE_NAME, COLUMN_NODE_NAME } from './column-layout-types'

export type ColumnSpecExtension = Extension<{
  Nodes: {
    [COLUMN_NODE_NAME]: {}
  }
}>

export type ColumnBlockSpecExtension = Extension<{
  Nodes: {
    [COLUMN_BLOCK_NODE_NAME]: {}
  }
}>

export type ColumnLayoutSpecExtension = Extension<{
  Nodes: {
    [COLUMN_NODE_NAME]: {}
    [COLUMN_BLOCK_NODE_NAME]: {}
  }
}>

export function defineColumnSpec(): ColumnSpecExtension {
  return defineNodeSpec({
    name: COLUMN_NODE_NAME,
    group: 'column',
    content: 'block*',
    isolating: true,
    selectable: false,
    parseDOM: [{ tag: 'div.prosekit-column' }],
    toDOM: () => ['div', { class: 'prosekit-column' }, 0],
  })
}

export function defineColumnBlockSpec(): ColumnBlockSpecExtension {
  return defineNodeSpec({
    name: COLUMN_BLOCK_NODE_NAME,
    group: 'block',
    content: `${COLUMN_NODE_NAME}{2,}`,
    isolating: true,
    selectable: true,
    parseDOM: [{ tag: 'div.prosekit-column-block' }],
    toDOM: () => ['div', { class: 'prosekit-column-block' }, 0],
  })
}

export function defineColumnLayoutSpec(): ColumnLayoutSpecExtension {
  return union(defineColumnSpec(), defineColumnBlockSpec())
}
