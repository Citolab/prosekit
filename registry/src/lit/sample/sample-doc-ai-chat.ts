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
    h(1, 'AI Chat — talk to your document'),
    p(
      'Open the chat sidebar with the speech-bubble button in the top toolbar. Ask the assistant about what is in this document, request a summary, or select some text first to scope the conversation to that selection.',
    ),

    h(2, 'About this demo'),
    p(
      'The assistant streams answers from an Azure Foundry OpenAI-compatible endpoint. Each response can be copied to the clipboard or inserted directly into the document at the cursor.',
    ),

    h(2, 'A short sample paragraph'),
    p(
      'Niels Wennemars (21) became the first Dutch person ever to win the annual cheese-rolling race in England. The event takes place on a 180-meter steep hill near Gloucester, where contestants run down after a wheel of cheese; whoever reaches the bottom first wins. Niels tumbled across the finish line and surprised both international and local competitors.',
    ),

    h(2, 'Things to try'),
    p('Ask: "What does this document say?"'),
    p('Ask: "Summarise the cheese-rolling paragraph in one sentence."'),
    p('Select a paragraph, then ask: "Rewrite this in a more formal tone."'),
  ],
}
