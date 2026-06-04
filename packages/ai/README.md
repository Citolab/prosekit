# @prosekit/ai

AI-related extensions for ProseKit. Provides utilities for streaming AI-generated content into the editor, tracking AI-suggested changes as a diff, and serializing ranges of the document to and from HTML for prompting.

## Installation

```bash
npm install @prosekit/ai
```

## Exports

- `streamContent`, `streamContentCommand`, `createStreamingPlugin`, `streamingPluginKey`, `DEFAULT_FLUSH_TAGS` — stream HTML chunks into a target range with safe flush boundaries.
- `defineAiDiff`, `aiDiffPluginKey`, `AI_DIFF_CHANGE_INDEX_ATTR`, `AI_DIFF_ID_ATTR` — track AI-suggested insertions and deletions as decorations that can be accepted or rejected.
- `parseHtmlToDoc`, `parseHtmlToSlice`, `serializeDocToHtml`, `serializeRangeToHtml`, `serializeSelectionToHtml` — bridge between ProseMirror documents and HTML for prompting LLMs.

See the `ai-stream-content` examples in the registry for end-to-end usage with the Vercel AI SDK.
