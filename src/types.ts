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
export type UiStatus = 'noBody' | 'adjusting' | 'active' | 'cleared'

/** 1つの動作トレーニングの定義。将来の動作追加（しゃがみ等）もここを拡張する */
export interface LegRaiseSpec {
  /** 上げる足 */
  side: Side
  /** 腰→足首の距離に対する目標挙上量（PoC暫定値。医学的根拠なし） */
  raiseRatio: number
  /** Target半径（腰→足首の距離に対する比） */
  radiusRatio: number
  /** Target内に連続して留まる必要がある時間 */
  holdMs: number
}

export const DEFAULT_SPEC: LegRaiseSpec = {
  side: 'right',
  raiseRatio: 0.3,
  radiusRatio: 0.15,
  holdMs: 700,
}
