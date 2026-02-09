import type { Node as ProseMirrorNode, ResolvedPos } from '@prosekit/pm/model'

import { COLUMN_BLOCK_NODE_NAME, COLUMN_NODE_NAME } from './column-layout-types'

interface JsonNode {
  type: string
  content?: JsonNode[]
}

function times <T>(n: number, fn: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => fn(i))
}

function buildNode(node: JsonNode): JsonNode {
  return node.content ? node : { type: node.type }
}

function buildParagraph(content?: JsonNode[]): JsonNode {
  return buildNode({ type: 'paragraph', content })
}

function buildColumn(content?: JsonNode[]): JsonNode {
  return buildNode({ type: COLUMN_NODE_NAME, content })
}

export function buildColumnBlock(content: JsonNode[]): JsonNode {
  return buildNode({ type: COLUMN_BLOCK_NODE_NAME, content })
}

export function buildNColumns(count: number): JsonNode[] {
  const content = [buildParagraph()]
  return times(count, () => buildColumn(content))
}

export function clampColumnCount(value: number): number {
  if (!Number.isFinite(value)) return 2
  return Math.max(2, Math.floor(value))
}

interface PredicateProps {
  node: ProseMirrorNode
  pos: number
  start: number
}

export type Predicate = (props: PredicateProps) => boolean

export function findParentNodeClosestToPos(
  $pos: ResolvedPos,
  predicate: Predicate,
):
  | {
    start: number
    depth: number
    node: ProseMirrorNode
    pos: number
  }
  | undefined {
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const node = $pos.node(depth)
    const pos = depth > 0 ? $pos.before(depth) : 0
    const start = $pos.start(depth)
    if (predicate({ node, pos, start })) {
      return {
        start,
        depth,
        node,
        pos,
      }
    }
  }
}
