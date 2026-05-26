---
title: AI Overview
description: Provider-agnostic AI primitives for ProseKit editors
---

The `@prosekit/ai` package ships the editor-side primitives needed to build AI features on top of ProseKit. It is **provider-agnostic**: nothing in this package knows about OpenAI, Anthropic, Azure or any specific wire format. You wire your own model call; the package handles the ProseMirror side.

## What's in the package

```ts
import {
  // Streaming text into the editor
  streamContent,
  streamContentCommand,
  createStreamingPlugin,
  streamingPluginKey,
  DEFAULT_FLUSH_TAGS,
  type StreamContentOptions,

  // Reviewing AI changes as an inline diff
  defineAiDiff,
  aiDiffPluginKey,
  AI_DIFF_ID_ATTR,
  AI_DIFF_CHANGE_INDEX_ATTR,
  type AiDiffExtension,
  type AiDiffState,
  type AddAiDiffOptions,

  // Schema-faithful HTML ⇄ ProseMirror bridge
  serializeDocToHtml,
  serializeRangeToHtml,
  serializeSelectionToHtml,
  parseHtmlToSlice,
  parseHtmlToDoc,
} from '@prosekit/ai'
```

Three groups, three concerns:

1. **Streaming.** Pipe model output into the editor as it arrives. `streamContent` accepts an `onStream(write)` callback you fulfill by calling your model — every text chunk you pass to `write` is parsed at block boundaries and applied as a transaction, so the user sees the document grow live.
2. **Diff review.** `defineAiDiff` turns an AI-produced replacement into an inline diff with per-fragment accept/reject. Built on top of [`prosemirror-changeset`](https://github.com/ProseMirror/prosemirror-changeset) and the [Commit](/extensions/commit) extension.
3. **HTML bridge.** Five small helpers that serialize the document, a range, or the current selection to HTML, and parse model-produced HTML back into a `Slice` or a top-level `Node`. They use the editor's own schema, so headings stay headings, custom node types round-trip cleanly, and there are no global-`document` assumptions (the helpers read `editor.view.dom.ownerDocument`, which keeps them working in iframed and popup contexts).

## Example stories

The same patterns rendered as forkable demos:

- [`ai-create`](/examples/ai-create) — popover-driven rewrite of a selection (Replace / Add below / Cancel / Try again).
- [`ai-check`](/examples/ai-check) — whole-document review with per-fragment accept/reject, built on `defineAiDiff`.
- [`ai-chat`](/examples/ai-chat) — companion chat sidebar that operates on the current selection (or the whole document if nothing is selected).
- [`stream-content`](/examples/stream-content) — minimal demo of `streamContent` with an endpoint + API-key form.

Each example is a shadcn-style starting point. Fork the folder, replace the model call, restyle.

## Design choices

### Provider-agnostic by construction

The package contains zero references to specific AI providers. There is no `streamFromOpenAI`, no `streamFromAnthropic`, no `instructions` field, no SSE event names. The example folders each carry their own thin `openai.ts` (or whatever you choose to put there) that calls your service and forwards text chunks. If you swap providers, you change the example file; nothing in `@prosekit/ai` moves.

This is deliberate. ProseKit's value proposition is bring-your-own-schema; the AI package mirrors that with bring-your-own-model. We resist the temptation to ship a `chat()` / `complete()` façade because the three reference examples have fundamentally different state machines (preview-then-apply vs diff-then-accept vs append-to-thread) and any unifying interface ends up as a `mode` flag with branching behavior.

### HTML, not Markdown

The HTML bridge is the only serialization layer in the package. We deliberately do not ship a markdown bridge.

- ProseMirror's schema can describe nodes and marks that markdown cannot: custom elements (e.g. `<qti-choice-interaction>`), attributes beyond href/title, sub/sup, underline, font-family, complex tables.
- `DOMSerializer.fromSchema(schema)` is schema-complete by construction — whatever your schema describes round-trips. Markdown serialization would require per-node `toMarkdown` and per-token parsers, which is a tax extension authors should not pay.
- Modern models emit clean HTML when instructed to. The "markdown is more natural to LLMs" intuition was true two years ago; today it is a small token-cost difference, not a quality difference.

If you have a prose-only schema and want markdown, the [markdown extension](/guides/markdown) can serialize/parse your document outside of `@prosekit/ai` — keep your model call producing markdown, parse it with `defaultMarkdownParser`, and apply the result with `replaceRange`.

### No request-lifecycle abstraction

There is no `AiRequest` class, no `useAiStream()` hook, no state machine wrapping `AbortController` + buffer + status. The three reference examples each implement that plumbing locally (~30 lines) because the lifecycles are not interchangeable: `ai-create` previews before applying, `ai-check` applies immediately as a diff overlay, `ai-chat` never applies unless the user clicks Insert. Sharing that code would force a contract that fits none of them well.

If you build a fourth pattern, copy the lifecycle plumbing from whichever existing example is closest, then change what you need.

### Endpoints and keys live in user storage

The example folders read endpoint URL and API key from `localStorage` (`prosekit-stream-content-endpoint`, `prosekit-stream-content-api-key`, `prosekit-stream-content-model`). Nothing is hardcoded — a user copying any of these demos must paste their own endpoint before the demos do anything. This is a property of the examples; the package itself has no opinion about how you supply credentials.

## When to reach for what

| You want to… | Use |
|---|---|
| Stream model output into the doc as it arrives | `streamContent` + `createStreamingPlugin` |
| Show AI changes as an inline diff before accepting them | `defineAiDiff` + [`defineCommitRecorder`](/extensions/commit) |
| Send the current document or selection to a model | `serializeDocToHtml` / `serializeSelectionToHtml` |
| Apply a model's HTML reply to the editor | `parseHtmlToSlice` (for a range) or `parseHtmlToDoc` (for the whole document) |
| Define a menu of one-shot prompts | a `readonly { label, instruction }[]` array — no helper needed |

## API Reference

- [@prosekit/ai](/references/ai)
