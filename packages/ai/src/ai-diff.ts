/**
 * AI diff extension — render an AI-produced `Commit` as a per-fragment
 * track-changes diff with accept / reject commands.
 *
 * @module
 */

import {
  defineCommands,
  definePlugin,
  union,
  type Extension,
} from '@prosekit/core'
import {
  decorateDeletion,
  getChanges,
  type Commit,
} from '@prosekit/extensions/commit'
import type { Node as ProseMirrorNode, Schema } from '@prosekit/pm/model'
import {
  PluginKey,
  ProseMirrorPlugin,
  type Command,
} from '@prosekit/pm/state'
import { Step } from '@prosekit/pm/transform'
import { Decoration, DecorationSet } from '@prosekit/pm/view'
import { simplifyChanges } from 'prosemirror-changeset'

/**
 * A single changed fragment inside an active diff.
 *
 * @internal
 */
interface CheckFragment {
  /**
   * Stable index that matches the original `prosemirror-changeset` change
   * order. Used by `acceptAiDiffFragment` / `rejectAiDiffFragment` to
   * identify the fragment regardless of how live positions have shifted.
   */
  index: number
  /** Range in the parent (pre-AI) doc — immutable. */
  fromA: number
  toA: number
  /** Range in the current doc — mapped forward on every transaction. */
  fromB: number
  toB: number
}

/**
 * A diff currently rendered in the editor.
 *
 * @internal
 */
interface ActiveDiff {
  id: string
  commit: Commit
  parentNode: ProseMirrorNode
  parsedSteps: Step[]
  fragments: CheckFragment[]
}

/**
 * State held by the AI diff plugin.
 *
 * @public
 */
export interface AiDiffState {
  /** All diffs currently rendered. */
  diffs: ActiveDiff[]
  /** Decorations produced from the diffs. Consumed by `props.decorations`. */
  decorations: DecorationSet
}

/**
 * Options for the `addAiDiff` command.
 *
 * @public
 */
export interface AddAiDiffOptions {
  /**
   * Caller-supplied identifier. Useful when the caller needs to reference
   * the diff later via `acceptAiDiff(id)` / `rejectAiDiff(id)`. If omitted
   * a random id is generated.
   */
  id?: string
}

/**
 * Extension type for `defineAiDiff`. Exposes the commands consumers will
 * call to manage diffs.
 *
 * @public
 */
export type AiDiffExtension = Extension<{
  Commands: {
    /** Hand a recorded `Commit` to the diff plugin to render. */
    addAiDiff: [commit: Commit, options?: AddAiDiffOptions]
    /**
     * Accept a whole diff (drop highlights, keep AI text). If `id` is
     * omitted, all active diffs are accepted.
     */
    acceptAiDiff: [id?: string]
    /**
     * Reject a whole diff (replace each still-pending fragment with its
     * original text). If `id` is omitted, all diffs are rejected.
     */
    rejectAiDiff: [id?: string]
    /** Accept a single fragment within a diff. */
    acceptAiDiffFragment: [id: string, changeIndex: number]
    /** Reject a single fragment, restoring its original content. */
    rejectAiDiffFragment: [id: string, changeIndex: number]
  }
}>

/**
 * Internal plugin meta types.
 *
 * @internal
 */
type AiDiffMeta =
  | { type: 'add'; diff: ActiveDiff }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'removeFragment'; id: string; changeIndex: number }

/**
 * Plugin key for the AI diff plugin. Exposed so consumers can read state
 * directly (e.g. a toolbar that counts active suggestions).
 *
 * @public
 */
export const aiDiffPluginKey: PluginKey<AiDiffState> = new PluginKey<AiDiffState>(
  'prosekit-ai-diff',
)

/**
 * Data attribute set on every addition decoration. Consumers can use this
 * in a delegated click handler to identify the diff a span belongs to.
 *
 * @public
 */
export const AI_DIFF_ID_ATTR = 'data-ai-diff-id'

/**
 * Data attribute set on every fragment decoration (additions and
 * deletions). Combine with {@link AI_DIFF_ID_ATTR} to identify the exact
 * fragment a span belongs to.
 *
 * @public
 */
export const AI_DIFF_CHANGE_INDEX_ATTR = 'data-ai-diff-change-index'

function randomId(): string {
  return `ai-diff-${Math.random().toString(36).slice(2, 10)}`
}

function decorateAdditionTagged(
  from: number,
  to: number,
  diffId: string,
  changeIndex: number,
): Decoration {
  return Decoration.inline(from, to, {
    class: 'prosekit-commit-addition',
    [AI_DIFF_ID_ATTR]: diffId,
    [AI_DIFF_CHANGE_INDEX_ATTR]: String(changeIndex),
  })
}

function buildFragmentDecorations(diff: ActiveDiff): Decoration[] {
  const decorations: Decoration[] = []
  for (const fragment of diff.fragments) {
    if (fragment.fromA < fragment.toA) {
      decorations.push(
        ...decorateDeletion(
          diff.parentNode,
          fragment.fromA,
          fragment.toA,
          fragment.fromB,
          {
            [AI_DIFF_ID_ATTR]: diff.id,
            [AI_DIFF_CHANGE_INDEX_ATTR]: String(fragment.index),
          },
        ),
      )
    }
    if (fragment.fromB < fragment.toB) {
      decorations.push(
        decorateAdditionTagged(
          fragment.fromB,
          fragment.toB,
          diff.id,
          fragment.index,
        ),
      )
    }
  }
  return decorations
}

function rebuildDecorations(
  diffs: readonly ActiveDiff[],
  doc: ProseMirrorNode,
): DecorationSet {
  if (diffs.length === 0) return DecorationSet.empty
  const all = diffs.flatMap(buildFragmentDecorations)
  return DecorationSet.create(doc, all)
}

/**
 * Letter / number characters across all scripts. Used to decide where a
 * "word" ends when expanding fragment ranges.
 */
const WORD_CHAR = /[\p{L}\p{N}]/u

function isWordChar(node: ProseMirrorNode, pos: number): boolean {
  // textBetween with ' ' for both leaf-text and block-boundary separators
  // returns a non-word char at any boundary, so the expansion naturally
  // stops at block edges.
  const ch = node.textBetween(pos, pos + 1, ' ', ' ')
  return !!ch && WORD_CHAR.test(ch)
}

function expandLeftToWord(node: ProseMirrorNode, pos: number): number {
  while (pos > 0 && isWordChar(node, pos - 1)) pos--
  return pos
}

function expandRightToWord(node: ProseMirrorNode, pos: number, max: number): number {
  while (pos < max && isWordChar(node, pos)) pos++
  return pos
}

function hydrate(
  commit: Commit,
  schema: Schema,
  doc: ProseMirrorNode,
  id: string,
): ActiveDiff {
  const parentNode = schema.nodeFromJSON(commit.parent)
  const parsedSteps = commit.steps.map((step) => Step.fromJSON(schema, step))
  const changes = getChanges(doc, parentNode, parsedSteps)
  // Run prosemirror-changeset's simplifier first (merges word-internal
  // hunks into a single change) and then always expand each side to whole
  // word boundaries. simplifyChanges has a built-in exception for
  // single-character replacements that we explicitly override so a one-
  // letter typo still highlights the whole word.
  const simplified = simplifyChanges(changes, doc)
  const parentMax = parentNode.content.size
  const docMax = doc.content.size
  const fragments: CheckFragment[] = simplified.map((change, index) => ({
    index,
    fromA: expandLeftToWord(parentNode, change.fromA),
    toA: expandRightToWord(parentNode, change.toA, parentMax),
    fromB: expandLeftToWord(doc, change.fromB),
    toB: expandRightToWord(doc, change.toB, docMax),
  }))
  return { id, commit, parentNode, parsedSteps, fragments }
}

function mapDiffsForward(
  diffs: readonly ActiveDiff[],
  tr: { mapping: { map(pos: number, assoc?: number): number } },
): ActiveDiff[] {
  return diffs.map((diff) => ({
    ...diff,
    fragments: diff.fragments
      .map((f) => ({
        ...f,
        fromB: tr.mapping.map(f.fromB, 1),
        toB: tr.mapping.map(f.toB, -1),
      }))
      .filter((f) => f.fromB <= f.toB),
  }))
}

const aiDiffPluginExtension = definePlugin((): ProseMirrorPlugin => {
  return new ProseMirrorPlugin<AiDiffState>({
    key: aiDiffPluginKey,
    state: {
      init: (): AiDiffState => ({
        diffs: [],
        decorations: DecorationSet.empty,
      }),
      apply: (tr, prev, _oldState, newState): AiDiffState => {
        const meta = tr.getMeta(aiDiffPluginKey) as AiDiffMeta | undefined
        let diffs = prev.diffs

        if (tr.docChanged) {
          diffs = mapDiffsForward(diffs, tr)
        }

        if (meta) {
          if (meta.type === 'add') {
            diffs = [...diffs, meta.diff]
          } else if (meta.type === 'remove') {
            diffs = diffs.filter((d) => d.id !== meta.id)
          } else if (meta.type === 'clear') {
            diffs = []
          } else if (meta.type === 'removeFragment') {
            diffs = diffs
              .map((d): ActiveDiff | null => {
                if (d.id !== meta.id) return d
                const fragments = d.fragments.filter(
                  (f) => f.index !== meta.changeIndex,
                )
                if (fragments.length === 0) return null
                return { ...d, fragments }
              })
              .filter((d): d is ActiveDiff => d !== null)
          }
        }

        if (!meta && !tr.docChanged) return prev

        return {
          diffs,
          decorations: rebuildDecorations(diffs, newState.doc),
        }
      },
    },
    props: {
      decorations: (state): DecorationSet | undefined => {
        return aiDiffPluginKey.getState(state)?.decorations
      },
    },
  })
})

function addAiDiffCommand(commit: Commit, options?: AddAiDiffOptions): Command {
  return (state, dispatch) => {
    const id = options?.id ?? randomId()
    if (dispatch) {
      const diff = hydrate(commit, state.schema, state.doc, id)
      const tr = state.tr.setMeta(aiDiffPluginKey, {
        type: 'add',
        diff,
      } satisfies AiDiffMeta)
      tr.setMeta('addToHistory', false)
      dispatch(tr)
    }
    return true
  }
}

function acceptAiDiffCommand(id?: string): Command {
  return (state, dispatch) => {
    const pluginState = aiDiffPluginKey.getState(state)
    if (!pluginState || pluginState.diffs.length === 0) return false
    if (id && !pluginState.diffs.some((d) => d.id === id)) return false
    if (dispatch) {
      const meta: AiDiffMeta = id ? { type: 'remove', id } : { type: 'clear' }
      const tr = state.tr.setMeta(aiDiffPluginKey, meta)
      tr.setMeta('addToHistory', false)
      dispatch(tr)
    }
    return true
  }
}

function rejectAiDiffCommand(id?: string): Command {
  return (state, dispatch) => {
    const pluginState = aiDiffPluginKey.getState(state)
    if (!pluginState || pluginState.diffs.length === 0) return false

    const toRevert = id
      ? pluginState.diffs.filter((d) => d.id === id)
      : pluginState.diffs
    if (toRevert.length === 0) return false

    if (dispatch) {
      const tr = state.tr
      // Revert each diff's still-pending fragments by replacing them with
      // their original content. Process highest position first so earlier
      // positions don't shift.
      for (const diff of [...toRevert].reverse()) {
        const sorted = [...diff.fragments].sort((a, b) => b.fromB - a.fromB)
        for (const f of sorted) {
          const originalSlice = diff.parentNode.slice(f.fromA, f.toA)
          tr.replaceRange(f.fromB, f.toB, originalSlice)
        }
      }
      const meta: AiDiffMeta = id ? { type: 'remove', id } : { type: 'clear' }
      tr.setMeta(aiDiffPluginKey, meta)
      // Reject changes the doc — leave it in the undo stack so users can
      // recover from a misclicked Reject with Cmd+Z.
      dispatch(tr)
    }
    return true
  }
}

function acceptAiDiffFragmentCommand(id: string, changeIndex: number): Command {
  return (state, dispatch) => {
    const pluginState = aiDiffPluginKey.getState(state)
    const diff = pluginState?.diffs.find((d) => d.id === id)
    if (!diff || !diff.fragments.some((f) => f.index === changeIndex)) return false
    if (dispatch) {
      const tr = state.tr.setMeta(aiDiffPluginKey, {
        type: 'removeFragment',
        id,
        changeIndex,
      } satisfies AiDiffMeta)
      tr.setMeta('addToHistory', false)
      dispatch(tr)
    }
    return true
  }
}

function rejectAiDiffFragmentCommand(id: string, changeIndex: number): Command {
  return (state, dispatch) => {
    const pluginState = aiDiffPluginKey.getState(state)
    const diff = pluginState?.diffs.find((d) => d.id === id)
    if (!diff) return false
    const fragment = diff.fragments.find((f) => f.index === changeIndex)
    if (!fragment) return false

    if (dispatch) {
      const tr = state.tr
      const originalSlice = diff.parentNode.slice(fragment.fromA, fragment.toA)
      tr.replaceRange(fragment.fromB, fragment.toB, originalSlice)
      tr.setMeta(aiDiffPluginKey, {
        type: 'removeFragment',
        id,
        changeIndex,
      } satisfies AiDiffMeta)
      // Per-fragment reject changes the doc — keep it in the undo stack.
      dispatch(tr)
    }
    return true
  }
}

/**
 * Display an AI-generated `Commit` (from `@prosekit/extensions/commit`'s
 * `CommitRecorder`) as a per-fragment track-changes diff that the user
 * can accept or reject — either as a whole or one fragment at a time.
 *
 * Fragment boundaries are expanded to whole words via
 * `prosemirror-changeset`'s `simplifyChanges`, so a single-character typo
 * correction highlights the whole word.
 *
 * ## Usage
 *
 * ```ts
 * import { defineAiDiff } from '@prosekit/ai'
 * import { defineCommitRecorder, CommitRecorder } from '@prosekit/extensions/commit'
 * import { defineBasicExtension } from 'prosekit/basic'
 * import { createEditor, union } from 'prosekit/core'
 *
 * const recorder = new CommitRecorder()
 * const editor = createEditor({
 *   extension: union(
 *     defineBasicExtension(),
 *     defineCommitRecorder(recorder),
 *     defineAiDiff(),
 *   ),
 * })
 *
 * // Capture an AI edit as a Commit:
 * recorder.init(editor.view.state.doc)
 * editor.view.dispatch(applyAiEdits)
 * const commit = recorder.commit()
 *
 * // Show as a reviewable diff:
 * if (commit) editor.commands.addAiDiff(commit)
 * ```
 *
 * ## Rendered DOM
 *
 * Each fragment renders:
 * - An inserted-text span with class `prosekit-commit-addition`,
 *   `data-ai-diff-id`, and `data-ai-diff-change-index`.
 * - A widget showing the deleted text with class `prosekit-commit-deletion`
 *   (also tagged with the same data attributes).
 *
 * Import the styles via `@prosekit/extensions/commit/style.css`. Use the
 * data attributes (also exported as {@link AI_DIFF_ID_ATTR} and
 * {@link AI_DIFF_CHANGE_INDEX_ATTR}) in a delegated click handler to
 * identify which fragment the user interacted with.
 *
 * @public
 */
export function defineAiDiff(): AiDiffExtension {
  return union(
    aiDiffPluginExtension,
    defineCommands({
      addAiDiff: addAiDiffCommand,
      acceptAiDiff: acceptAiDiffCommand,
      rejectAiDiff: rejectAiDiffCommand,
      acceptAiDiffFragment: acceptAiDiffFragmentCommand,
      rejectAiDiffFragment: rejectAiDiffFragmentCommand,
    }),
  ) as AiDiffExtension
}
