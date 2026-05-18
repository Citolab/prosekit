/**
 * Azure AI Foundry endpoint hosting an OpenAI-compatible Responses API.
 * `model` corresponds to the deployment name on this resource.
 */
const ENDPOINT
  = 'https://patrick-codex-vibecode-resource.services.ai.azure.com/openai/v1/responses'

const SYSTEM_PROMPT
  = `You are a writing assistant whose output is rendered as rich-text inside a ProseMirror editor.

Respond with well-formed HTML only. Allowed tags: <p>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <code>, <pre>, <blockquote>.

Do not include <html>, <head>, <body>, <div>, <span>, class, style, ids, markdown, code fences, or commentary about the HTML — just the content itself.`

export interface OpenAIStreamOptions {
  apiKey: string
  model: string
  prompt: string
  write: (chunk: string) => void
  signal?: AbortSignal
}

interface ResponsesStreamEvent {
  type?: string
  delta?: string
  response?: { error?: { message?: string } }
  error?: { message?: string }
}

/**
 * Call the Azure Foundry Responses streaming endpoint and forward each
 * text delta to `write`. Server-Sent Events arrive as `event: <type>` +
 * `data: <json>` pairs separated by blank lines. We only forward
 * `response.output_text.delta` events.
 */
export async function streamFromOpenAI(options: OpenAIStreamOptions): Promise<void> {
  const { apiKey, model, prompt, write, signal } = options

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      input: prompt,
      stream: true,
    }),
    signal,
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new Error(`AI request failed (${response.status}): ${detail}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      handleEvent(block, write)
    }
  }
}

function handleEvent(block: string, write: (chunk: string) => void): void {
  for (const line of block.split('\n')) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice('data:'.length).trim()
    if (!payload || payload === '[DONE]') continue
    let event: ResponsesStreamEvent
    try {
      event = JSON.parse(payload) as ResponsesStreamEvent
    } catch {
      continue
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      write(event.delta)
    } else if (event.type === 'response.failed' || event.type === 'error') {
      const message = event.response?.error?.message ?? event.error?.message ?? 'AI response failed'
      throw new Error(message)
    }
  }
}
