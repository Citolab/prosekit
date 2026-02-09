import type { Node as ProseMirrorNode, ResolvedPos, Slice } from '@prosekit/pm/model'
import { Selection, SelectionRange, TextSelection } from '@prosekit/pm/state'

import { COLUMN_BLOCK_NODE_NAME, COLUMN_NODE_NAME } from './column-layout-types'
import { findParentNodeClosestToPos, type Predicate } from './column-layout-utils'

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

export class ColumnLayoutSelection extends Selection {
  constructor(selection: Selection) {
    const { $from, $to } = selection
    super($from, $to)
    this._$from = $from
    this._$to = $to
  }

  private _$from: ResolvedPos
  private _$to: ResolvedPos

  override get $from(): ResolvedPos {
    return this._$from
  }

  override get $to(): ResolvedPos {
    return this._$to
  }

  override map(): Selection {
    return this
  }

  override content(): Slice {
    return this.$from.doc.slice(this.from, this.to, true)
  }

  override eq(other: Selection): boolean {
    return other instanceof ColumnLayoutSelection && other.anchor === this.anchor
  }

  override toJSON(): { type: string; from: number; to: number } {
    return { type: 'column-layout', from: this.from, to: this.to }
  }

  expandSelection(doc: ProseMirrorNode): void {
    const where: Predicate = ({ pos, node }) => {
      if (node.type.name === COLUMN_NODE_NAME) {
        return true
      }
      return doc.resolve(pos).depth <= 0
    }

    const fromParent = findParentNodeClosestToPos(this.$from, where)
    const toParent = findParentNodeClosestToPos(this.$to, where)
    if (!fromParent || !toParent) {
      return
    }

    this._$from = doc.resolve(fromParent.pos)
    this._$to = doc.resolve(toParent.pos + toParent.node.nodeSize)

    if (this.getFirstNode()?.type.name === COLUMN_BLOCK_NODE_NAME) {
      const offset = 2
      this._$from = doc.resolve(this.$from.pos + offset)
      this._$to = doc.resolve(this.$to.pos + offset)
    }

    const mutableThis = this as Mutable<ColumnLayoutSelection>
    mutableThis.$anchor = this._$from
    mutableThis.$head = this._$to
    mutableThis.ranges = [new SelectionRange(this._$from, this._$to)]
  }

  static create(
    doc: ProseMirrorNode,
    from: number,
    to: number,
  ): ColumnLayoutSelection {
    const $from = doc.resolve(from)
    const $to = doc.resolve(to)
    return new ColumnLayoutSelection(new TextSelection($from, $to))
  }

  getFirstNode(): ProseMirrorNode | null {
    return this.content().content.firstChild
  }
}
