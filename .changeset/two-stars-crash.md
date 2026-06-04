---
"@prosekit/ai": minor
"@prosekit/extensions": minor
"prosekit": minor
"prosekit-registry": minor
---

Add `@prosekit/ai`, a package of primitives for wiring LLMs into a ProseKit editor.

What's included:

- `streamContent` / `streamContentCommand` — replace a range with content streamed from an async source. Tracks the live range through a plugin so the rest of the document stays editable while a generation is in flight, and renders an `is-streaming` decoration over the active region.
- `defineAiDiff` — render an AI-proposed rewrite of the document as inline insert/delete decorations with per-fragment accept / reject commands, built on `@prosekit/extensions/commit` and `prosemirror-changeset`.
- `html-bridge` — `serializeRangeToHtml`, `serializeSelectionToHtml`, `serializeDocToHtml`, `parseHtmlToSlice`, `parseHtmlToDoc` for moving content between the editor and an LLM.

Opinionated choices worth knowing:

- **HTML is the transfer format**, not Markdown or ProseMirror JSON. LLMs produce HTML reliably, the browser already has a forgiving parser for it, ProseMirror's `DOMParser` consumes the result without a schema-specific transformer, and partial HTML can be flushed at row-like close tags (`</p>`, `</li>`, `</tr>`, …) without writing a stream-aware parser. Markdown would require a converter on both ends and lose schema-specific marks; ProseMirror JSON would require the LLM to produce a schema it doesn't know.
- **Flush boundaries are HTML close tags**, not byte counts or token counts. `DEFAULT_FLUSH_TAGS` covers the common block elements; consumers can extend via `extraFlushTags`. Each flush re-parses the cumulative buffer and replaces the live range — simpler than incremental tree diffing, and the browser auto-closes still-open ancestors when we set `innerHTML`.
- **Position tracking is anchored to the doc tail**, not the slice size. `currentEnd = doc.content.size - tailSize` after each flush — this stays correct even when `tr.replace` adjusts open boundaries, where slice-size arithmetic would drift.
- **The streaming range is mapped through every transaction** so collaborative edits, IME composition, or other plugin transactions outside the range do not desync it. Inside the range, the view is soft-locked via `props.editable` while the cursor is in a streaming region.
- **The streaming plugin supports multiple concurrent streams** keyed by id. Most callers won't need this, but it's free given the mapping infrastructure.
- **`streamContentCommand` is fire-and-forget**, returning synchronously and logging errors. Callers that need to `await` completion or handle errors should use `streamContent` directly.
- **AI diff is built on `@prosekit/extensions/commit`** rather than a parallel changeset implementation, so accept / reject reuse the same change-decoration pipeline as the existing change-tracking extension.

Also includes matching Lit and React `ai-stream-content` examples in the registry that demonstrate `streamContent` against an OpenAI-compatible endpoint.
