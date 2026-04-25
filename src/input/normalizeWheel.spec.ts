import { describe, it, expect } from 'vitest'
import normalizeWheel from './normalizeWheel'

describe('normalizeWheel', () => {
  it('normalizes deltaX and deltaY', () => {
    const event = { deltaX: 10, deltaY: -20, deltaMode: 0 } as WheelEvent
    const result = normalizeWheel(event)
    expect(result.pixelX).toBe(10)
    expect(result.pixelY).toBe(-20)
    expect(result.spinX).toBe(1)
    expect(result.spinY).toBe(-1)
  })
})
