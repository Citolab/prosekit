import { defineAiDiff } from '@prosekit/ai'
import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
import { CommitRecorder, defineCommitRecorder } from 'prosekit/extensions/commit'

// One recorder per editor instance. The toolbar resets it before each AI
// invocation and reads the resulting `Commit` afterward.
export const commitRecorder = new CommitRecorder()

export function defineExtension() {
  return union(
    defineBasicExtension(),
    defineCommitRecorder(commitRecorder),
    defineAiDiff(),
  )
}

export type EditorExtension = ReturnType<typeof defineExtension>
