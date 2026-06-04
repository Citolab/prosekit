# Plan: Replace `ai-chat.css` with Tailwind utility classes

## Goal

Delete `registry/src/lit/examples/ai-chat/ai-chat.css` by moving its 5 rules into Tailwind classes on the elements that currently consume the named classes. Eliminates one of the only remaining `.css` files in the AI examples and matches the project convention for example-specific chrome.

---

## Phase 0 — Findings (discovery complete)

### What the CSS does

`registry/src/lit/examples/ai-chat/ai-chat.css` (41 lines) defines 5 rules:

| Selector | Properties | Used at |
|---|---|---|
| `.ai-chat-sidebar` | `position: fixed; top/right/bottom: 0; width: 20rem; flex column; border-left 1px gray-200; background: canvas; z-index: 10` | `chat-sidebar.ts:270` (`<aside class="ai-chat-sidebar">`) |
| `.dark .ai-chat-sidebar` | `border-left-color: gray-700` | (same element under dark mode) |
| `.ai-chat-thread` | `flex 1 1 auto; overflow-y: auto; padding: 0.5rem; flex column; gap 0.5rem; text 0.875rem` | `chat-sidebar.ts:283` (`<div class="ai-chat-thread">`) |
| `.ai-chat-msg-role` | `text 0.7rem; color gray-500; text-transform uppercase` | `chat-sidebar.ts:229` and `:237` (`<div class="ai-chat-msg-role">`) |
| `.ai-chat-msg-assistant > :first-child / :last-child` | reset `margin-top` / `margin-bottom` to 0 | `chat-sidebar.ts:239` (`<div class="ai-chat-msg-assistant">`) |

### CSS import to remove

`registry/src/lit/examples/ai-chat/editor.ts:4` — `import './ai-chat.css'`

### Convention check

`registry/CONTRIBUTING.md` (verified in earlier check) explicitly allows raw Tailwind for "example-specific chrome (sidebars, chat windows, config forms) that has no shared component equivalent." The sidebar IS that kind of chrome — there's no CSS_* token for a fixed sidebar. So **raw Tailwind, not a new CSS_* token**.

### Tailwind mapping (verified against existing files)

- `position: fixed; top: 0; right: 0; bottom: 0` → `fixed inset-y-0 right-0`
- `width: 20rem` → `w-80`
- `display: flex; flex-direction: column` → `flex flex-col`
- `border-left: 1px solid rgb(229 231 235)` + dark `rgb(55 65 81)` → `border-l border-gray-200 dark:border-gray-700`
- `background: canvas` → `bg-[canvas]` (this exact arbitrary value is already used in `registry/src/classes.ts:24` for `CSS_INPUT`, confirming the pattern)
- `z-index: 10` → `z-10`
- `flex: 1 1 auto` → `flex-1`
- `overflow-y: auto` → `overflow-y-auto`
- `padding: 0.5rem` → `p-2`
- `gap: 0.5rem` → `gap-2`
- `font-size: 0.875rem` → `text-sm`
- `font-size: 0.7rem` → `text-xs` (closest Tailwind = 0.75rem — visually indistinguishable; documented deviation)
- `color: rgb(107 114 128)` → `text-gray-500`
- `text-transform: uppercase` → `uppercase`
- `> :first-child { margin-top: 0 }` → `[&>:first-child]:mt-0` (Tailwind arbitrary variant)
- `> :last-child { margin-bottom: 0 }` → `[&>:last-child]:mb-0`

### Anti-patterns to avoid

- Don't introduce a new `CSS_SIDEBAR` token — there's no other sidebar in the codebase to share it with; that's premature abstraction.
- Don't change the dark border color to `dark:border-gray-800` unless aligning to the toolbar baseline is desired. The existing CSS uses gray-700; `dark:border-gray-700` preserves visual parity. Flag for reviewer.
- Don't drop the named classes that are also used as `data-testid` anchors. `ai-chat-sidebar` appears as `data-testid` in tests (`chat-sidebar.ts:270` and `chat-toolbar.ts:24`). Keep `data-testid="ai-chat-sidebar"` — only the styling moves to Tailwind.

---

## Phase 1 — Replace classes inline in `chat-sidebar.ts`

### What to do

Edit `/Users/patrickklein/Projects/Editor/Prosekit/registry/src/lit/examples/ai-chat/chat-sidebar.ts` at the four call sites. Replace each named class with the Tailwind utility string from the mapping table. Keep `data-testid` attributes untouched.

### Concrete edits

**Line 229** — role label (user):
```ts
// before
<div class="ai-chat-msg-role">You · ${m.scope}</div>
// after
<div class="text-xs text-gray-500 uppercase">You · ${m.scope}</div>
```

**Line 237** — role label (assistant): identical replacement.

**Line 239** — assistant message body:
```ts
// before
class="ai-chat-msg-assistant"
// after
class="[&>:first-child]:mt-0 [&>:last-child]:mb-0"
```

**Line 270** — sidebar shell:
```ts
// before
<aside class="ai-chat-sidebar" data-testid="ai-chat-sidebar">
// after
<aside class="fixed inset-y-0 right-0 w-80 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-[canvas] z-10" data-testid="ai-chat-sidebar">
```

**Line 283** — chat thread container:
```ts
// before
<div ${ref(this.threadRef)} class="ai-chat-thread">
// after
<div ${ref(this.threadRef)} class="flex-1 overflow-y-auto p-2 flex flex-col gap-2 text-sm">
```

### Verification

- `grep -rn "ai-chat-sidebar\|ai-chat-thread\|ai-chat-msg-role\|ai-chat-msg-assistant" registry/src/lit/examples/ai-chat/` should return only the `data-testid="ai-chat-sidebar"` line and the `'ai-chat-toggle'` event (which is unrelated — different name pattern with `-toggle` suffix).
- The CustomElement names like `lit-ai-chat-sidebar` are not affected — those are component tags, not class names.

### Anti-pattern guards

- Don't delete `data-testid` values — tests rely on them.
- Don't merge `class=""` into the test attribute string; keep them as separate attributes.
- If you find any class name still referenced after edits, do NOT add a backwards-compat alias in CSS — fix the missed reference and re-run grep.

---

## Phase 2 — Remove the CSS file and its import

### What to do

1. Delete the import from [editor.ts:4](registry/src/lit/examples/ai-chat/editor.ts#L4):
   ```ts
   // remove this line entirely
   import './ai-chat.css'
   ```

2. Delete the file: `rm registry/src/lit/examples/ai-chat/ai-chat.css`

### Verification

- `ls registry/src/lit/examples/ai-chat/` shows no `.css` files.
- `grep -rn "ai-chat.css" registry/` returns nothing.
- The website dev server (`pnpm dev`) loads the ai-chat story without 404s.
- Visually: sidebar opens at right with correct width, border, and dark-mode border color; thread scrolls; role labels are tiny uppercase gray; assistant message has no leading/trailing margin spillover.

### Anti-pattern guards

- Don't leave the import as `// import './ai-chat.css'` — delete the line completely.
- Don't keep the css file with an empty body "for later" — delete it.

---

## Phase 3 — Final verification

### What to do

1. `pnpm run fix` — formatters and lint clean.
2. `pnpm run typecheck` — 0 errors.
3. `pnpm run build` — succeeds.
4. Visual: load the `ai-chat` story in the website dev server. Open the chat sidebar. Compare against a screenshot from `feat/ai-chat` branch *before* this change. Differences should be limited to:
   - text-xs vs 0.7rem — imperceptible
   - any other diff is a regression and must be reverted

### Sign-off checklist

- [ ] `ai-chat.css` deleted
- [ ] `import './ai-chat.css'` removed from editor.ts
- [ ] 5 class strings replaced in chat-sidebar.ts
- [ ] `data-testid="ai-chat-sidebar"` preserved
- [ ] No grep hits for old class names anywhere in registry
- [ ] Dev server renders sidebar with correct layout in light + dark mode

---

## Estimated effort

15-20 minutes including dev-server visual check.
