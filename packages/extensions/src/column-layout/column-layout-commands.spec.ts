import { union } from '@prosekit/core'
import { describe, expect, it } from 'vitest'

import { defineDoc } from '../doc'
import { defineParagraph } from '../paragraph'
import { setupTestFromExtension } from '../testing'
import { defineText } from '../text'

import { defineColumnLayout } from './index'

describe('column-layout commands', () => {
  it('can set selected content into 2 columns', () => {
    const { editor, n } = setupTestFromExtension(
      union(
        defineDoc(),
        defineText(),
        defineParagraph(),
        defineColumnLayout(),
      ),
    )

    const p = n.paragraph

    editor.set(n.doc(p('<a>Hello<b>')))
    editor.commands.setColumns(2)

    expect(editor.getDocJSON()).toEqual(
      n.doc(
        n.columnBlock(
          n.column(p('Hello')),
          n.column(p()),
        ),
      ).toJSON(),
    )
  })

  it('can unset columns and flatten the content', () => {
    const { editor, n } = setupTestFromExtension(
      union(
        defineDoc(),
        defineText(),
        defineParagraph(),
        defineColumnLayout(),
      ),
    )

    const p = n.paragraph

    editor.set(
      n.doc(
        n.columnBlock(
          n.column(p('One<a>')),
          n.column(p('Two')),
          n.column(p()),
        ),
      ),
    )

    editor.commands.unsetColumns()

    expect(editor.getDocJSON()).toEqual(
      n.doc(
        p('One'),
        p('Two'),
      ).toJSON(),
    )
  })
})
