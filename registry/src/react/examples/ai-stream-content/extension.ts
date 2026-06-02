import { createStreamingPlugin } from '@prosekit/ai'
import { defineBasicExtension } from 'prosekit/basic'
import { definePlugin, union } from 'prosekit/core'

export function defineExtension() {
  return union(
    defineBasicExtension(),
    definePlugin(createStreamingPlugin()),
  )
}

export type EditorExtension = ReturnType<typeof defineExtension>
