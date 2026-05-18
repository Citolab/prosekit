'use client'

import type { Editor } from 'prosekit/core'
import { useEditorDerivedValue } from 'prosekit/react'

import { Button } from '../../ui/button'

import type { EditorExtension } from './extension'

function getToolbarItems(editor: Editor<EditorExtension>) {
  return {
    streamContent: {
      canExec: editor.commands.streamContent.canExec(),
      command: () => editor.commands.streamContent(),
    },
  }
}

export default function Toolbar() {
  const items = useEditorDerivedValue(getToolbarItems)

  return (
    <div className="CSS_TOOLBAR">
      <Button
        pressed={false}
        disabled={!items.streamContent.canExec}
        onClick={items.streamContent.command}
        tooltip="Start streaming demo content"
      >
        Stream content
      </Button>
    </div>
  )
}
