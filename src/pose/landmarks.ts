import type { Side } from '../types'

/** MediaPipe Pose のランドマーク番号（人物の解剖学的な左右） */
export const LM = {
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const

export interface LegIdx {
  hip: number
  knee: number
  ankle: number
}

export function legIndices(side: Side): LegIdx {
  return side === 'right'
    ? { hip: LM.R_HIP, knee: LM.R_KNEE, ankle: LM.R_ANKLE }
    : { hip: LM.L_HIP, knee: LM.L_KNEE, ankle: LM.L_ANKLE }
}

/** 全身が映っているとみなすために必要なランドマーク（腰・膝・足首） */
export const REQUIRED_BODY = [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE]

/** 描画する骨格のランドマーク範囲（顔・手指を除く） */
export const DRAWN_INDICES = new Set([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])
