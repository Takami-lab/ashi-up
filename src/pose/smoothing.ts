import type { Lm } from '../types'

/** 指数移動平均でランドマークの座標ノイズを抑える（visibility は最新値を使う） */
export class LandmarkSmoother {
  private prev: Lm[] | null = null

  /** alpha: 新しい値の重み（小さいほど滑らかだが遅れる） */
  constructor(private alpha = 0.5) {}

  reset() {
    this.prev = null
  }

  apply(lms: Lm[]): Lm[] {
    const a = this.alpha
    const prev = this.prev
    const out = lms.map((p, i) => {
      const q = prev?.[i]
      return q ? { x: q.x + (p.x - q.x) * a, y: q.y + (p.y - q.y) * a, v: p.v } : { ...p }
    })
    this.prev = out
    return out
  }
}
