export const COLUMN_NODE_NAME = 'column'
export const COLUMN_BLOCK_NODE_NAME = 'columnBlock'

export interface ColumnLayoutOptions {
  /**
   * Allow creating nested column blocks inside columns.
   *
   * @default false
   */
  nestedColumns?: boolean
}
