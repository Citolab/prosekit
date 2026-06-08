const SYSTEM_PROMPT
  = `You are a chat assistant embedded next to a rich-text editor. You help the user understand, summarise and rewrite the document they are editing.

When useful, structure your reply as well-formed HTML. Allowed tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <code>, <pre>, <blockquote>.

If the answer is a single sentence, return a single <p>. Do not include <html>, <head>, <body>, <div>, <span>, class, style, ids, markdown, code fences, or commentary about the HTML — just the content itself.`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OpenAIChatStreamOptions {
  endpoint: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  documentHtml: string
  selectionHtml?: string
  write: (chunk: string) => void
  signal?: AbortSignal
}

interface ChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
  error?: { message?: string }
}

export async function streamChatFromOpenAI(options: OpenAIChatStreamOptions): Promise<void> {
  const { endpoint, apiKey, model, messages, documentHtml, selectionHtml, write, signal } = options

  const contextBlock
    = `<document>\n${documentHtml}\n</document>`
    + (selectionHtml ? `\n\n<selection>\n${selectionHtml}\n</selection>` : '')

  const systemContent = `${SYSTEM_PROMPT}\n\n${contextBlock}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        ...messages,
      ],
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
    let chunk: ChatCompletionChunk
    try {
      chunk = JSON.parse(payload) as ChatCompletionChunk
    } catch {
      continue
    }
    if (chunk.error?.message) {
      throw new Error(chunk.error.message)
    }
    const content = chunk.choices?.[0]?.delta?.content
    if (typeof content === 'string') {
      write(content)
    }
  }
}
