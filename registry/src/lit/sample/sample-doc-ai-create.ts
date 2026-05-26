import type { NodeJSON } from 'prosekit/core'

function p(text: string): NodeJSON {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function h(level: 1 | 2 | 3, text: string): NodeJSON {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

export const sampleContent: NodeJSON = {
  type: 'doc',
  content: [
    h(1, 'AI Create — try the wand'),
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'bold' }],
          text: 'Place the cursor anywhere in a paragraph (or select text) and click the wand in the top toolbar.',
        },
      ],
    },

    h(2, 'Make shorter'),
    p(
      'It is, generally speaking and broadly considered across the industry, a widely accepted and largely uncontested fact that the introduction of a structured document model — one that is, at its foundation, both well-typed and explicitly described by a formal schema — tends, in the vast majority of practical use cases that one might reasonably encounter, to result in editors which exhibit substantially improved reliability and which, perhaps even more importantly, are markedly easier for downstream developers to reason about and to extend over time.',
    ),

    h(2, 'Make longer'),
    p('ProseMirror uses a schema. The schema describes what nodes are allowed.'),

    h(2, 'Simplify'),
    p(
      'The transactional model employed by ProseMirror necessitates that any mutation of the underlying document state be expressed as a sequence of discrete, individually-invertible step descriptors, which are subsequently composed into a transaction object whose mapping function maintains positional fidelity across the application of arbitrarily-ordered concurrent modifications.',
    ),

    h(2, 'Improve writing'),
    p(
      'ProseMirror its very modular, you can configure it however and the plugins they let you extend the behavior. When you build a editor with it, you basically defining a schema first, and after that you adding the plugins what you need. The learning curve is steep but its worth it because once you get it the system is really powerfull.',
    ),
  ],
}
