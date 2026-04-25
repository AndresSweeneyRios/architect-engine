export type Scene = () => Promise<{ init: () => Promise<() => void> }>

export const scenes = Object.freeze({
  SITE_22: () => import('./SITE_22'),
})

export const DEFAULT_SCENE = scenes.SITE_22
