import type { Lm, Pt, TrainingSpec } from '../types'
import type { Baseline } from './calibration'
import { dist } from './math'
import { lateralOffset, outwardSign } from './normalize'
import type { ReachState } from './reachJudge'
import type { Target } from './target'

const MIN_VISIBILITY = 0.5
const MAX_DT_MS = 200

/** 横ステップの目標（足首を出す位置の目安）。docs/requirements.md §2 */
export function computeStepTarget(b: Baseline, spec: TrainingSpec): Target {
  return {
    center: { x: b.ankle.x + outwardSign(b) * spec.stepOffset * b.hipWidth, y: b.ankle.y },
    radius: spec.radiusRatio * b.legLength,
  }
}

/** C_step：外へ腰幅×stepOffset 以上、足は接地したまま、体幹は大きくずれない */
export function stepCondition(ankle: Lm | null, hips: Pt | null, b: Baseline, spec: TrainingSpec): boolean {
  if (!ankle || ankle.v < MIN_VISIBILITY || !hips) return false
  const lift = Math.abs(ankle.y - b.ankle.y) / b.legLength
  const shift = dist(hips, b.hipCenter) / b.hipWidth
  return lateralOffset(ankle, b) >= spec.stepOffset && lift <= spec.stepMaxLift && shift <= spec.stepMaxShift
}

/** C_step が holdMs 連続で成立したら成功（足上げの ReachJudge とは独立） */
export class StepJudge {
  private heldMs = 0
  private lastT: number | null = null
  private cleared = false

  reset() {
    this.heldMs = 0
    this.lastT = null
    this.cleared = false
  }

  update(t: number, ankle: Lm | null, hips: Pt | null, b: Baseline, spec: TrainingSpec): ReachState {
    const dt = this.lastT === null ? 0 : Math.min(t - this.lastT, MAX_DT_MS)
    this.lastT = t
    const inside = stepCondition(ankle, hips, b, spec)
    this.heldMs = inside ? this.heldMs + dt : 0
    if (this.heldMs >= spec.holdMs) this.cleared = true
    return { inside, progress: Math.min(this.heldMs / spec.holdMs, 1), cleared: this.cleared }
  }
}
