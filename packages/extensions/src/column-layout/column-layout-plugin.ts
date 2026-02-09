import { definePlugin, type PlainExtension } from '@prosekit/core'
import { PluginKey, ProseMirrorPlugin } from '@prosekit/pm/state'

const key = new PluginKey('prosekit-column-layout')

/**
 * Defines the base ProseMirror plugin used by the column layout extension.
 *
 * @internal
 */
export function defineColumnLayoutPlugin(): PlainExtension {
  return definePlugin(new ProseMirrorPlugin({ key }))
}
