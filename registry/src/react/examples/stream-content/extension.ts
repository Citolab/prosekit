import {
  createStreamingPlugin,
  streamContentCommand,
} from '@prosekit/ai'
import { defineBasicExtension } from 'prosekit/basic'
import {
  defineCommands,
  union,
} from 'prosekit/core'
import { definePlugin } from 'prosekit/core'
import { defineCodeBlockShiki } from 'prosekit/extensions/code-block'
import { defineHorizontalRule } from 'prosekit/extensions/horizontal-rule'
import { defineMention } from 'prosekit/extensions/mention'
import { definePlaceholder } from 'prosekit/extensions/placeholder'

import { defineCodeBlockView } from '../../ui/code-block-view'

export function defineExtension() {
  return union(
    defineBasicExtension(),
    definePlaceholder({ placeholder: 'Press / for commands...' }),
    defineMention(),
    defineCodeBlockShiki(),
    defineHorizontalRule(),
    defineCodeBlockView(),
    definePlugin(createStreamingPlugin()),
    defineCommands({
      streamContent: () => (state, dispatch, view) => {
        const from = state.selection.from
        const to = state.selection.to
        const command = streamContentCommand({
          from,
          to,
          onStream: async (write) => {
            const parts = [
              '<p>This is the <strong>start</strong> of the streamed content.',
              ' Content appears <em>in real time</em> in the editor.',
              '</p><p>Let’s look at a list:</p><ul><li>',
              'First item</li><li>',
              'Second item</li><li>',
              'Third item</li></ul><p>',
              'Now a code block:</p><pre><code>',
              'const x = 10;\n',
              'console.log(x);',
              '</code></pre><p>',
              'Streamed content complete!</p>',
            ]

            for (const part of parts) {
              write(part)
              // Simulated network latency between chunks.
              await new Promise((resolve) => setTimeout(resolve, 200))
            }
          },
        })
        return command(state, dispatch, view)
      },
    }),
  )
}

export type EditorExtension = ReturnType<typeof defineExtension>
