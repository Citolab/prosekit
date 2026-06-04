export interface AiPrompt {
  label: string
  instruction: string
}

export const AI_PROMPTS: readonly AiPrompt[] = [
  {
    label: 'Improve writing',
    instruction:
      'Improve the writing of the following text. Keep the meaning, fix grammar, clarity, and flow.',
  },
  {
    label: 'Make longer',
    instruction:
      'Expand the following text. Keep the same tone and meaning, add detail and depth.',
  },
  {
    label: 'Make shorter',
    instruction:
      'Shorten the following text. Keep the meaning, remove redundancy.',
  },
  {
    label: 'Simplify',
    instruction:
      'Rewrite the following text in simpler language. Keep the meaning, use plain words and shorter sentences.',
  },
] as const

export interface AiCreateRequestDetail {
  from: number
  to: number
  prompt: AiPrompt
}
