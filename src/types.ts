/** 動画フレームのピクセル座標系の点（骨格・Target の判定はすべてこの座標系で行う） */
export interface Pt {
  x: number
  y: number
}

/** ピクセル座標に変換済みのランドマーク。v は推定信頼度（visibility） */
export interface Lm extends Pt {
  v: number
}

export interface Size {
  w: number
  h: number
}

export type Side = 'left' | 'right'

/** 画面に出す状態（文言はUI側で決める） */
export type UiStatus = 'noBody' | 'adjusting' | 'active' | 'cleared' | 'timeout'

export type MotionId = 'raise' | 'step'
export type MotionResult = 'success' | 'timeout'

/** 1動作の記録 */
export interface MotionRecord {
  motion: MotionId
  /** 対象の足 */
  side: Side
  result: MotionResult
  /** 基準姿勢の取得から結果が出るまでの時間 */
  ms: number
}

/** 動作トレーニングの定義（片足上げ・横ステップ）。パラメータは暫定値（docs/requirements.md） */
export interface TrainingSpec {
  /** 上げる足 */
  side: Side
  /** 腰→足首の距離に対する目標挙上量（PoC暫定値。医学的根拠なし） */
  raiseRatio: number
  /** Target半径（腰→足首の距離に対する比） */
  radiusRatio: number
  /** Target内に連続して留まる必要がある時間 */
  holdMs: number
  /** 横ステップ：外向き移動量の下限（腰幅比） */
  stepOffset: number
  /** 横ステップ：足首の上下ずれの上限（脚長比） */
  stepMaxLift: number
  /** 横ステップ：体幹ずれの上限（腰幅比） */
  stepMaxShift: number
  /** 基準姿勢の取得後、この時間内にクリアできなければ未達成 */
  timeoutMs: number
}

export const DEFAULT_SPEC: TrainingSpec = {
  side: 'right',
  raiseRatio: 0.3,
  radiusRatio: 0.15,
  holdMs: 700,
  stepOffset: 1.0,
  stepMaxLift: 0.15,
  stepMaxShift: 0.5,
  timeoutMs: 20000,
}
