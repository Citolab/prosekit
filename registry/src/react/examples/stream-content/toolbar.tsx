'use client'

import { streamContent } from '@prosekit/ai'
import { useEditor } from 'prosekit/react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { EditorExtension } from './extension'
import { streamFromOpenAI } from './openai'

const API_KEY_STORAGE_KEY = 'prosekit-stream-content-api-key'
const MODEL_STORAGE_KEY = 'prosekit-stream-content-model'
const DEFAULT_MODEL = 'gpt-4o-mini'

function readStorage(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage might be disabled; ignore.
  }
}

export default function Toolbar() {
  const editor = useEditor<EditorExtension>({ update: false })
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('Write a short article about prosemirror.')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Hydrate from localStorage on mount so SSR doesn't cause a mismatch.
  useEffect(() => {
    setApiKey(readStorage(API_KEY_STORAGE_KEY))
    setModel(readStorage(MODEL_STORAGE_KEY, DEFAULT_MODEL))
  }, [])

  useEffect(() => writeStorage(API_KEY_STORAGE_KEY, apiKey), [apiKey])
  useEffect(() => writeStorage(MODEL_STORAGE_KEY, model), [model])

  const run = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!apiKey || !prompt || streaming) return

      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)

      const { from, to } = editor.view.state.selection
      try {
        await streamContent(editor.view, {
          from,
          to,
          signal: controller.signal,
          onStream: (write) =>
            streamFromOpenAI({
              apiKey,
              model: model || DEFAULT_MODEL,
              prompt,
              write,
              signal: controller.signal,
            }),
        })
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          console.error('streamContent failed:', error)
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setStreaming(false)
      }
    },
    [editor, apiKey, model, prompt, streaming],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <form onSubmit={run} className="CSS_TOOLBAR not-content flex-col items-stretch gap-2">
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Azure Foundry API key (stored in localStorage)"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm w-full"
      />
      <div className="flex gap-2 items-center w-full">
        <input
          type="text"
          spellCheck={false}
          placeholder={`Model (default: ${DEFAULT_MODEL})`}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm w-40 shrink-0"
        />
        <input
          type="text"
          placeholder="Prompt the AI…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm flex-1"
        />
        {streaming
          ? (
            <button
              type="button"
              onClick={stop}
              className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Stop
            </button>
          )
          : (
            <button
              type="submit"
              disabled={!apiKey || !prompt}
              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          )}
      </div>
    </form>
  )
}
