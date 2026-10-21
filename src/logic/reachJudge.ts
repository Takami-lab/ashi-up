import type { Lm } from '../types'
import { dist } from './math'
import type { Target } from './target'

const MIN_VISIBILITY = 0.5
/** 一度入ったら少し外れても許容する（境界でのちらつき防止） */
const EXIT_MARGIN = 1.2
/** フレーム落ち時に長い空白を達成時間に加算しない */
const MAX_DT_MS = 200

export interface ReachState {
  inside: boolean
  /** 0..1 */
  progress: number
  cleared: boolean
}

/**
 * Target への到達判定。足首がTarget内に holdMs 連続で留まれば成功。
 * 足首が未検出・低信頼のときは判定を止めて進捗を戻す。
 * （フォーム判定 formJudge とは独立）
 */
export class ReachJudge {
  private heldMs = 0
  private inside = false
  private lastT: number | null = null
  private cleared = false

  constructor(private holdMs: number) {}

  setHoldMs(ms: number) {
    this.holdMs = ms
  }

  reset() {
    this.heldMs = 0
    this.inside = false
    this.lastT = null
    this.cleared = false
  }

  update(t: number, ankle: Lm | null, target: Target): ReachState {
    const dt = this.lastT === null ? 0 : Math.min(t - this.lastT, MAX_DT_MS)
    this.lastT = t

    if (!ankle || ankle.v < MIN_VISIBILITY) {
      this.heldMs = 0
      this.inside = false
    } else {
      const limit = target.radius * (this.inside ? EXIT_MARGIN : 1)
      this.inside = dist(ankle, target.center) <= limit
      this.heldMs = this.inside ? this.heldMs + dt : 0
    }
    if (this.heldMs >= this.holdMs) this.cleared = true
    return { inside: this.inside, progress: Math.min(this.heldMs / this.holdMs, 1), cleared: this.cleared }
  }
}
