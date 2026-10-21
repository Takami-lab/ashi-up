import type { Pt } from '../types'

/**
 * フォーム判定（膝の曲げ具合など）。Target到達判定（reachJudge）とは独立。
 * PoCでは成功条件に使わず、開発者パネルの表示のみに使う。
 */
export function kneeAngleDeg(hip: Pt, knee: Pt, ankle: Pt): number {
  const a = Math.atan2(hip.y - knee.y, hip.x - knee.x)
  const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x)
  let d = Math.abs(a - b) * (180 / Math.PI)
  if (d > 180) d = 360 - d
  return d
}
