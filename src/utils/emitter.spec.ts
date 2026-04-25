import { describe, it, expect } from 'vitest'
import { TypedEmitter } from './emitter'

type TestEvents = {
  foo: (value: number) => void
  bar: () => void
}

describe('TypedEmitter', () => {
  it('emits events to listeners', () => {
    const emitter = new TypedEmitter<TestEvents>()
    let called = 0
    emitter.on('foo', (v) => { called = v })
    emitter.emit('foo', 5)
    expect(called).toBe(5)
  })

  it('removes listeners with off', () => {
    const emitter = new TypedEmitter<TestEvents>()
    const listener = () => { }
    emitter.on('bar', listener)
    emitter.off('bar', listener)
    let triggered = false
    emitter.on('bar', () => { triggered = true })
    emitter.emit('bar')
    expect(triggered).toBe(true)
  })
})
