import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { defineColumnLayout } from 'prosekit/extensions/column-layout'

export function defineExtension() {
  return union(
    defineBasicExtension(),
    defineColumnLayout(),
  )
}

export type EditorExtension = ReturnType<typeof defineExtension>
