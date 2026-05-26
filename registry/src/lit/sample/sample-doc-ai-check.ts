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
    h(1, 'AI Check — try the robot'),
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'bold' }],
          text: 'Click the robot in the top toolbar and pick a check. Each suggested word lights up; click it to accept or reject.',
        },
      ],
    },

    h(2, 'Spellcheck test'),
    p(
      "ProseMirror is a tookit for buidling rich-text editors on the web. It is desinged to be modluar, so you can pick the exatcly which features your editor needs and leave the others out. The libary is small but it is also flexable enough to suport collabrative editing.",
    ),

    h(2, 'Trim filler words test'),
    p(
      'I just really wanted to point out that ProseMirror is actually pretty powerful. Basically, you can literally extend it however you want, and it sort of just works. The schema system is kind of really flexible, and honestly the docs are very thorough. It actually takes some time to get used to, but it really is worth the effort.',
    ),
  ],
}
