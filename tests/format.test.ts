import { describe, expect, it } from 'vitest'
import { formatSeconds } from '../src/logic/format'

describe('formatSeconds', () => {
  it('msを小数1桁の秒にする', () => {
    expect(formatSeconds(3240)).toBe('3.2秒')
    expect(formatSeconds(20000)).toBe('20.0秒')
    expect(formatSeconds(0)).toBe('0.0秒')
  })
})
