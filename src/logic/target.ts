import type { Pt, LegRaiseSpec } from '../types'
import type { Baseline } from './calibration'

export interface Target {
  center: Pt
  radius: number
}

/**
 * 基準姿勢の足首の真上に Target を置く。体格（脚長）基準で、身体の動きには追従しない。
 * 画像座標は下向きが +y なので、上げるときは y を減らす。
 */
export function computeTarget(b: Baseline, spec: LegRaiseSpec): Target {
  return {
    center: { x: b.ankle.x, y: b.ankle.y - spec.raiseRatio * b.legLength },
    radius: spec.radiusRatio * b.legLength,
  }
}
