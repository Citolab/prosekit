import { createEditor, union } from '@prosekit/core'
import { CommitRecorder, defineCommitRecorder } from '@prosekit/extensions/commit'
import { defineDoc } from '@prosekit/extensions/doc'
import { defineParagraph } from '@prosekit/extensions/paragraph'
import { defineText } from '@prosekit/extensions/text'
import { describe, expect, it } from 'vitest'

import { AI_DIFF_CHANGE_INDEX_ATTR, AI_DIFF_ID_ATTR, aiDiffPluginKey, defineAiDiff } from './ai-diff'

function setup() {
  const recorder = new CommitRecorder()
  const extension = union(
    defineDoc(),
    defineText(),
    defineParagraph(),
    defineCommitRecorder(recorder),
    defineAiDiff(),
  )
  const editor = createEditor({
    extension,
    defaultContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] },
      ],
    },
  })
  const host = document.createElement('div')
  editor.mount(host)
  return { editor, recorder }
}

function recordRewrite(
  editor: ReturnType<typeof setup>['editor'],
  recorder: CommitRecorder,
  apply: () => void,
) {
  recorder.init(editor.view.state.doc)
  apply()
  return recorder.commit()
}

describe('defineAiDiff', () => {
  it('creates a fragment when an AI commit is added', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      // Replace "world" with "there" — a single-word change.
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    expect(commit).not.toBeNull()
    if (!commit) return

    editor.commands.addAiDiff(commit)
    const state = aiDiffPluginKey.getState(editor.view.state)
    expect(state?.diffs.length).toBe(1)
    expect(state?.diffs[0].fragments.length).toBeGreaterThan(0)
  })

  it('renders fragment decorations with diff-id and change-index attrs', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    if (!commit) throw new Error('expected a commit')
    editor.commands.addAiDiff(commit, { id: 'test-diff' })

    const additions = editor.view.dom.querySelectorAll('.prosekit-commit-addition')
    expect(additions.length).toBeGreaterThan(0)
    const span = additions[0] as HTMLElement
    expect(span.getAttribute(AI_DIFF_ID_ATTR)).toBe('test-diff')
    expect(span.getAttribute(AI_DIFF_CHANGE_INDEX_ATTR)).toBe('0')
  })

  it('acceptAiDiffFragment removes the fragment but keeps the doc unchanged', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    if (!commit) throw new Error('expected a commit')
    editor.commands.addAiDiff(commit, { id: 'test-diff' })

    const docBefore = editor.view.state.doc
    editor.commands.acceptAiDiffFragment('test-diff', 0)

    expect(editor.view.state.doc.eq(docBefore)).toBe(true)
    const state = aiDiffPluginKey.getState(editor.view.state)
    // The diff is cleared because its only fragment was accepted.
    expect(state?.diffs.length).toBe(0)
  })

  it('rejectAiDiffFragment restores the original text at that fragment', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    if (!commit) throw new Error('expected a commit')
    expect(editor.view.state.doc.textContent).toBe('hello there')
    editor.commands.addAiDiff(commit, { id: 'test-diff' })

    editor.commands.rejectAiDiffFragment('test-diff', 0)

    expect(editor.view.state.doc.textContent).toBe('hello world')
    const state = aiDiffPluginKey.getState(editor.view.state)
    expect(state?.diffs.length).toBe(0)
  })

  it('acceptAiDiff (whole) clears all diffs without touching the doc', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    if (!commit) throw new Error('expected a commit')
    editor.commands.addAiDiff(commit)
    const docBefore = editor.view.state.doc
    editor.commands.acceptAiDiff()

    expect(editor.view.state.doc.eq(docBefore)).toBe(true)
    expect(aiDiffPluginKey.getState(editor.view.state)?.diffs.length).toBe(0)
  })

  it('rejectAiDiff (whole) reverts every still-pending fragment', () => {
    const { editor, recorder } = setup()
    const commit = recordRewrite(editor, recorder, () => {
      const tr = editor.view.state.tr.replaceWith(
        7,
        12,
        editor.view.state.schema.text('there'),
      )
      editor.view.dispatch(tr)
    })
    if (!commit) throw new Error('expected a commit')
    editor.commands.addAiDiff(commit)
    editor.commands.rejectAiDiff()

    expect(editor.view.state.doc.textContent).toBe('hello world')
    expect(aiDiffPluginKey.getState(editor.view.state)?.diffs.length).toBe(0)
  })
})
