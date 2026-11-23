import { describe, expect, it } from 'vitest'
import { rankFor } from '../src/logic/rank'
import type { MotionRecord } from '../src/types'

const rec = (ms: number, result: MotionRecord['result'] = 'success'): MotionRecord => ({ motion: 'raise', side: 'right', result, ms })

describe('rankFor', () => {
  it('平均所要時間で称号が決まる（境界は以下）', () => {
    expect(rankFor([rec(2000), rec(3000)])).toBe('名人')
    expect(rankFor([rec(3000), rec(3200)])).toBe('達人')
    expect(rankFor([rec(5000), rec(5000)])).toBe('達人')
    expect(rankFor([rec(5000), rec(5200)])).toBe('上級者')
    expect(rankFor([rec(9000)])).toBe('初級者')
  })
  it('時間切れがあれば称号なし', () => {
    expect(rankFor([rec(2000), rec(20000, 'timeout')])).toBeNull()
    expect(rankFor([])).toBeNull()
  })
})
