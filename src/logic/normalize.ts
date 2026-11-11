import type { Pt } from '../types'
import type { Baseline } from './calibration'

/**
 * 体格・カメラ距離に依存しない量へ換算する（docs/requirements.md 共通定義）。
 * 縦方向は脚長 L、横方向は腰幅 W を物差しにする。
 */

/** 基準の足首を原点とした相対位置を、(横: 腰幅比, 縦: 脚長比・上向きが正) で返す */
export function toBodyUnits(p: Pt, b: Baseline): Pt {
  return { x: (p.x - b.ankle.x) / b.hipWidth, y: (b.ankle.y - p.y) / b.legLength }
}

/** 基準姿勢で右足（対象足）が画像のどちら側か。外向き方向 = +1（右向き）/ -1（左向き） */
export function outwardSign(b: Baseline): 1 | -1 {
  return b.ankle.x >= b.hipCenter.x ? 1 : -1
}

/** 外向きの横移動量（腰幅比）。正で外へ出ている */
export function lateralOffset(ankle: Pt, b: Baseline): number {
  return (outwardSign(b) * (ankle.x - b.ankle.x)) / b.hipWidth
}
