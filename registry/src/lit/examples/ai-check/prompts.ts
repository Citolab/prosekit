export interface AiPrompt {
  label: string
  instruction: string
}

export const AI_PROMPTS: readonly AiPrompt[] = [
  {
    label: 'Spellcheck',
    instruction:
      'You are given an HTML document. Find spelling mistakes and obvious typos and replace ONLY those individual misspelled words with their correct spelling. Return the same HTML with all of the following preserved EXACTLY: every tag, attribute, heading, paragraph break, whitespace, punctuation, and every word that is spelled correctly. Do not rephrase, reorder, merge, split, or restructure anything. Only change individual misspelled words. If a word is correctly spelled, do not touch it.',
  },
  {
    label: 'Trim filler words',
    instruction:
      'You are given an HTML document. Remove only the individual filler words ("just", "really", "very", "actually", "basically", "literally", "kind of", "sort of") where they add no meaning. Return the same HTML with all of the following preserved EXACTLY: every tag, attribute, heading, paragraph break, whitespace, punctuation, and every other word. Do not rephrase, reorder, merge, split, or restructure anything. Only remove (or leave) the listed filler words.',
  },
] as const
