export function GetViewbox(view: object): IViewbox | null {
  const handler = view as Partial<IViewboxHandler>

  if (!handler.GetViewboxEnabled?.()) {
    return null
  }

  return handler.GetViewbox?.bind(view)() ?? null
}

export interface IViewbox {
  x1: number
  x2: number
  y1: number
  y2: number
  depth: number
}

export interface IViewboxHandler {
  GetViewbox(): IViewbox
  GetViewboxEnabled(): boolean
}
