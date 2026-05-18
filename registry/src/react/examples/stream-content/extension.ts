import { createStreamingPlugin } from '@prosekit/ai'
import { defineBasicExtension } from 'prosekit/basic'
import { union } from 'prosekit/core'
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
  )
}

export type EditorExtension = ReturnType<typeof defineExtension>
