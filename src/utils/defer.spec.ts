import { describe, it, expect, vi } from 'vitest'
import { defer, until } from './defer'

describe('defer', () => {
  it('resolves with provided value', async () => {
    const d = defer<number>()
    setTimeout(() => d.resolve(42), 0)
    await expect(d.promise).resolves.toBe(42)
  })

  it('rejects with provided reason', async () => {
    const d = defer<number>()
    setTimeout(() => d.reject(new Error('fail')), 0)
    await expect(d.promise).rejects.toThrow('fail')
  })
})

describe('until', () => {
  it('resolves when condition becomes true', async () => {
    let value = false
    const rafMock = vi.fn((cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 0)
      return 0
    })
    vi.stubGlobal('requestAnimationFrame', rafMock)
    setTimeout(() => {
      value = true
    }, 5)
    await until(() => value)
    expect(value).toBe(true)
    vi.unstubAllGlobals()
  })
})
