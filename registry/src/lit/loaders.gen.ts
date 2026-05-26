// This file is generated from update-loader.ts

export const loaders = {
  'ai-chat': () => import('./examples/ai-chat').then((m) => m.registerLitEditor()),
  'ai-check': () => import('./examples/ai-check').then((m) => m.registerLitEditor()),
  'ai-create': () => import('./examples/ai-create').then((m) => m.registerLitEditor()),
  'block-handle': () => import('./examples/block-handle').then((m) => m.registerLitEditor()),
  'code-block': () => import('./examples/code-block').then((m) => m.registerLitEditor()),
  'inline-menu': () => import('./examples/inline-menu').then((m) => m.registerLitEditor()),
  'minimal': () => import('./examples/minimal').then((m) => m.registerLitEditor()),
  'slash-menu': () => import('./examples/slash-menu').then((m) => m.registerLitEditor()),
  'stream-content': () => import('./examples/stream-content').then((m) => m.registerLitEditor()),
  'table': () => import('./examples/table').then((m) => m.registerLitEditor()),
  'toolbar': () => import('./examples/toolbar').then((m) => m.registerLitEditor()),
}
