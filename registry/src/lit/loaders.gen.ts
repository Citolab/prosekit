// This file is generated from update-loader.ts

export const loaders = {
  'column-layout': () => import('./examples/column-layout').then((m) => m.registerLitEditor()),
  'minimal': () => import('./examples/minimal').then((m) => m.registerLitEditor()),
  'slash-menu': () => import('./examples/slash-menu').then((m) => m.registerLitEditor()),
}
