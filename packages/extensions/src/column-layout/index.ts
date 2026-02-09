import { union, type Union } from '@prosekit/core'

import {
  defineColumnLayoutCommands,
  type ColumnLayoutCommandsExtension,
} from './column-layout-commands'
import { defineColumnLayoutPlugin } from './column-layout-plugin'
import {
  defineColumnLayoutSpec,
  type ColumnLayoutSpecExtension,
} from './column-layout-spec'
import type { ColumnLayoutOptions } from './column-layout-types'

/**
 * @internal
 */
export type ColumnLayoutExtension = Union<[
  ColumnLayoutSpecExtension,
  ColumnLayoutCommandsExtension
]>

/**
 * Defines a column layout extension with `setColumns`, `insertColumns`, and
 * `unsetColumns` commands.
 *
 * @public
 */
export function defineColumnLayout(
  options?: ColumnLayoutOptions,
): ColumnLayoutExtension {
  return union(
    defineColumnLayoutSpec(),
    defineColumnLayoutPlugin(),
    defineColumnLayoutCommands(options),
  )
}

export type { ColumnLayoutOptions } from './column-layout-types'
