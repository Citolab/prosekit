import { defineCommands, getNodeType, type Extension } from '@prosekit/core'
import type { NodeType } from '@prosekit/pm/model'
import { NodeSelection, type Command } from '@prosekit/pm/state'

import { ColumnLayoutSelection } from './column-layout-selection'
import {
  COLUMN_BLOCK_NODE_NAME,
  COLUMN_NODE_NAME,
  type ColumnLayoutOptions,
} from './column-layout-types'
import {
  buildColumnBlock,
  buildNColumns,
  clampColumnCount,
  findParentNodeClosestToPos,
  type Predicate,
} from './column-layout-utils'

/**
 * @internal
 */
export type ColumnLayoutCommandsExtension = Extension<{
  Commands: {
    setColumns: [columns: number]
    insertColumns: [columns: number]
    unsetColumns: []
  }
}>

function canAcceptColumnBlockChild({
  nestedColumns,
  parentType,
  columnTypeName,
  columnBlockType,
}: {
  nestedColumns: boolean
  parentType: NodeType
  columnTypeName: string
  columnBlockType: NodeType
}): boolean {
  if (!parentType.contentMatch.matchType(columnBlockType)) {
    return false
  }

  if (!nestedColumns && parentType.name === columnTypeName) {
    return false
  }

  return true
}

function setColumnsCommand(
  count: number,
  options?: ColumnLayoutOptions,
  keepContent: boolean = true,
): Command {
  return (state, dispatch) => {
    const columns = clampColumnCount(count)
    const { schema, doc, selection } = state
    const columnBlockType = getNodeType(schema, COLUMN_BLOCK_NODE_NAME)

    const sel = new ColumnLayoutSelection(selection)
    sel.expandSelection(doc)

    const slice = sel.content()
    const { openStart, openEnd } = slice
    if (openStart !== openEnd) {
      return false
    }

    const nodes = buildNColumns(columns)
    if (keepContent) {
      nodes[0] = { type: COLUMN_NODE_NAME, content: slice.toJSON().content }
    }

    const columnBlock = buildColumnBlock(nodes)
    const newNode = schema.nodeFromJSON(columnBlock)

    const parentType = sel.$anchor.parent.type
    if (!canAcceptColumnBlockChild({
      nestedColumns: options?.nestedColumns ?? false,
      parentType,
      columnTypeName: COLUMN_NODE_NAME,
      columnBlockType,
    })) {
      return false
    }

    if (!dispatch) {
      return true
    }

    const tr = state.tr.setSelection(sel).replaceSelectionWith(newNode, false)
    dispatch(tr)
    return true
  }
}

function unsetColumnsCommand(options?: ColumnLayoutOptions): Command {
  return (state, dispatch) => {
    const { tr } = state
    const columnBlockType = getNodeType(state.schema, COLUMN_BLOCK_NODE_NAME)

    const where: Predicate = ({ node }) => {
      if (!options?.nestedColumns && node.type === columnBlockType) {
        return true
      }
      return node.type === columnBlockType
    }

    const firstAncestor = findParentNodeClosestToPos(tr.selection.$from, where)
    if (!firstAncestor) {
      return false
    }

    let nodes = [] as Array<typeof firstAncestor.node>
    firstAncestor.node.descendants((node, _pos, parent) => {
      if (parent?.type.name === COLUMN_NODE_NAME) {
        nodes.push(node)
      }
    })

    nodes = nodes.reverse().filter((node) => node.content.size > 0)

    if (!dispatch) {
      return true
    }

    let nextTr = tr
    nextTr = nextTr.setSelection(NodeSelection.create(tr.doc, firstAncestor.pos))
    for (const node of nodes) {
      nextTr = nextTr.insert(firstAncestor.pos, node)
    }
    nextTr = nextTr.deleteSelection()
    dispatch(nextTr)
    return true
  }
}

/**
 * Set the selected blocks into a column layout and keep selected content in
 * the first column.
 */
export function setColumns(
  columns: number,
  options?: ColumnLayoutOptions,
): Command {
  return setColumnsCommand(columns, options, true)
}

/**
 * Insert an empty column layout with the given number of columns.
 */
export function insertColumns(
  columns: number,
  options?: ColumnLayoutOptions,
): Command {
  return setColumnsCommand(columns, options, false)
}

/**
 * Remove the closest column layout and flatten its columns.
 */
export function unsetColumns(options?: ColumnLayoutOptions): Command {
  return unsetColumnsCommand(options)
}

/**
 * Defines the commands for the column layout extension.
 *
 * @internal
 */
export function defineColumnLayoutCommands(
  options?: ColumnLayoutOptions,
): ColumnLayoutCommandsExtension {
  return defineCommands({
    setColumns: (columns: number) => setColumns(columns, options),
    insertColumns: (columns: number) => insertColumns(columns, options),
    unsetColumns: () => unsetColumns(options),
  })
}
