import { DOMParser } from '@prosekit/pm/model'
import type {
  Command,
  EditorState,
  Transaction,
} from '@prosekit/pm/state'
import {
  Plugin,
  PluginKey,
  Selection,
} from '@prosekit/pm/state'
import type { EditorView } from '@prosekit/pm/view'
import {
  Decoration,
  DecorationSet,
} from '@prosekit/pm/view'

/** A live streaming region in the document. */
interface StreamRange {
  from: number
  to: number
}

/** Plugin state: one entry per active stream, keyed by stream id. */
interface StreamingState {
  ranges: Map<string, StreamRange>
}

interface StreamingMeta {
  id: string
  type: 'start' | 'update' | 'end'
  from?: number
  to?: number
}

/**
 * Plugin key for the streaming-content plugin. Exposed so callers can read the
 * current set of streaming ranges from editor state if needed.
 */
export const streamingPluginKey: PluginKey<StreamingState> = new PluginKey<StreamingState>('streaming')

/**
 * State plugin for streaming-content. It:
 *   1. Tracks one or more streaming ranges keyed by id.
 *   2. Maps every active range through transaction mappings so concurrent
 *      edits or remote ops keep the range pointing at the right slice.
 *   3. Renders an inline decoration with class `is-streaming` over each
 *      range so the UI can show a shimmer / progress indicator.
 *   4. Marks the view as non-editable while the selection is inside any
 *      active range — soft lock against the user editing partially-rendered
 *      content.
 */
export function createStreamingPlugin(): Plugin<StreamingState> {
  return new Plugin<StreamingState>({
    key: streamingPluginKey,

    state: {
      init(): StreamingState {
        return { ranges: new Map() }
      },
      apply(tr: Transaction, oldState: StreamingState): StreamingState {
        const meta = tr.getMeta(streamingPluginKey) as StreamingMeta | undefined

        // Always remap existing ranges through this transaction first so that
        // intervening edits (collab, IME, etc.) don't desync the range.
        const next = new Map<string, StreamRange>()
        for (const [id, range] of oldState.ranges) {
          next.set(id, {
            from: tr.mapping.map(range.from),
            to: tr.mapping.map(range.to),
          })
        }

        if (meta) {
          if (meta.type === 'end') {
            next.delete(meta.id)
          } else if (meta.from !== undefined && meta.to !== undefined) {
            next.set(meta.id, { from: meta.from, to: meta.to })
          }
        }

        return { ranges: next }
      },
    },

    props: {
      decorations(state: EditorState): DecorationSet {
        const streaming = streamingPluginKey.getState(state)
        if (!streaming || streaming.ranges.size === 0) {
          return DecorationSet.empty
        }
        const decorations: Decoration[] = []
        for (const range of streaming.ranges.values()) {
          if (range.to > range.from) {
            decorations.push(
              Decoration.inline(range.from, range.to, { class: 'is-streaming' }),
            )
          }
        }
        return DecorationSet.create(state.doc, decorations)
      },

      editable(state: EditorState): boolean {
        const streaming = streamingPluginKey.getState(state)
        if (!streaming || streaming.ranges.size === 0) return true
        const cursor = state.selection.from
        for (const range of streaming.ranges.values()) {
          if (cursor >= range.from && cursor <= range.to) return false
        }
        return true
      },
    },
  })
}

/** Options accepted by both `streamContent` and `streamContentCommand`. */
export interface StreamContentOptions {
  /** Start of the range that will be replaced by streamed content. */
  from: number

  /** End of the range that will be replaced by streamed content. */
  to: number

  /**
   * Optional id used to namespace this stream. Required only when multiple
   * streams may run concurrently in the same editor. If omitted a unique id
   * is generated.
   */
  id?: string

  /**
   * Optional `AbortSignal`. When the signal aborts, the stream is finalized
   * (the plugin state is cleared) and `streamContent` rejects with the
   * signal's reason.
   */
  signal?: AbortSignal

  /**
   * Async callback that receives a `write` function. Each call to `write`
   * appends an HTML chunk to the streaming buffer. The buffer is re-parsed
   * and the document region is replaced when the buffer reaches a stable
   * parse boundary (or when the stream ends).
   */
  onStream: (write: (chunk: string) => void) => Promise<void> | void
}

/**
 * Close tags that mark a "row-like" boundary at which it is meaningful to
 * commit streamed content to the editor. After any of these closes, the
 * browser's HTML parser will auto-close any still-open ancestors when we
 * set `innerHTML`, so partial buffers parse cleanly.
 */
const FLUSH_TAG_RE
  = /<\/(?:p|li|tr|td|th|h[1-6]|pre|blockquote|ul|ol|table|thead|tbody|tfoot)\s*>/gi

/**
 * Find the position right after the LAST flush-tag close in `buffer` that
 * lies beyond `from`. Returns `from` when no new boundary has been emitted
 * since the previous flush.
 */
function findFlushBoundary(buffer: string, from: number): number {
  FLUSH_TAG_RE.lastIndex = from
  let end = from
  while (FLUSH_TAG_RE.exec(buffer) !== null) {
    end = FLUSH_TAG_RE.lastIndex
  }
  return end
}

/**
 * Strip a trailing unclosed `<…` token so `innerHTML =` doesn't treat
 * partial markup as malformed text. Used on the final flush where we
 * commit everything left in the buffer.
 */
function trimTrailingPartialTag(buffer: string): string {
  const lastOpen = buffer.lastIndexOf('<')
  const lastClose = buffer.lastIndexOf('>')
  return lastOpen > lastClose ? buffer.slice(0, lastOpen) : buffer
}

let streamCounter = 0

/**
 * Async implementation of the streaming-content command. Resolves when the
 * stream ends, rejects on abort or `onStream` errors. Errors and aborts both
 * cleanly clear the plugin state for this stream id.
 */
export async function streamContent(
  view: EditorView,
  options: StreamContentOptions,
): Promise<void> {
  const { from, to, onStream, signal } = options
  const id = options.id ?? `stream-${++streamCounter}`

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  }

  const schema = view.state.schema
  const domParser = DOMParser.fromSchema(schema)
  const tempDiv = document.createElement('div')

  let htmlBuffer = ''
  let lastFlushedLength = 0

  // Open the stream: delete the original range and mark the plugin state.
  {
    const tr = view.state.tr
    if (to > from) tr.delete(from, to)
    const meta: StreamingMeta = { id, type: 'start', from, to: from }
    tr.setMeta(streamingPluginKey, meta)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
  }

  // Anchor the end of the streaming range to the doc tail. After every
  // transaction `currentEnd = doc.content.size - tailSize`. This decouples
  // position tracking from `slice.size` arithmetic, which can drift when
  // `tr.replace` adjusts open boundaries.
  const tailSize = view.state.doc.content.size - from
  let currentEnd = from

  const flush = (final: boolean): void => {
    // Non-final: commit up to the latest row-like close tag. Final: commit
    // everything left, stripping any trailing unclosed `<…` so the browser's
    // HTML parser doesn't choke. The browser auto-closes any still-open
    // ancestors (e.g. `<tbody>`, `<table>`) when we set `innerHTML`, so the
    // parsed slice is always well-formed.
    const targetLength = final
      ? trimTrailingPartialTag(htmlBuffer).length
      : findFlushBoundary(htmlBuffer, lastFlushedLength)
    if (targetLength <= lastFlushedLength) return
    lastFlushedLength = targetLength

    tempDiv.innerHTML = htmlBuffer.slice(0, targetLength)
    const slice = domParser.parseSlice(tempDiv)

    const tr = view.state.tr
    tr.replace(from, currentEnd, slice)
    currentEnd = tr.doc.content.size - tailSize

    // Use Selection.near so we land in inline content even when the streamed
    // tail ends on a block boundary (e.g. an empty list item).
    tr.setSelection(Selection.near(tr.doc.resolve(currentEnd)))
    tr.scrollIntoView()

    const meta: StreamingMeta = {
      id,
      type: 'update',
      from,
      to: currentEnd,
    }
    tr.setMeta(streamingPluginKey, meta)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
  }

  const finalize = (): void => {
    const tr = view.state.tr
    const meta: StreamingMeta = { id, type: 'end' }
    tr.setMeta(streamingPluginKey, meta)
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
  }

  const onAbort = (): void => {
    // Best-effort cleanup. If the next flush would have happened we skip it;
    // anything already committed stays in the document.
    finalize()
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const write = (chunk: string): void => {
    if (signal?.aborted) return
    htmlBuffer += chunk
    flush(false)
  }

  try {
    await onStream(write)
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    }
    // Always flush whatever remains, even mid-tag (the stream is over so
    // there is no more chunk coming to complete it).
    flush(true)
    finalize()
  } catch (error) {
    finalize()
    throw error
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Wrap `streamContent` in a ProseMirror `Command`. The command returns
 * synchronously (`true` when a view is available); the actual streaming work
 * runs asynchronously. Errors from the async stream are surfaced via
 * `console.error` — use {@link streamContent} directly if you need to await
 * the stream or catch its errors.
 */
export function streamContentCommand(
  options: StreamContentOptions,
): Command {
  return (
    _state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined,
    view: EditorView | undefined,
  ): boolean => {
    if (!view) return false
    if (!dispatch) return true

    // Detach so the command itself returns synchronously. The first
    // dispatch (stream start) happens on the next microtask.
    void Promise.resolve().then(() =>
      streamContent(view, options).catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'AbortError') return
        console.error('streamContent failed:', error)
      }),
    )
    return true
  }
}
