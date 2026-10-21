import type { Pt, Size } from '../types'

export interface ViewTransform {
  /** 動画ピクセル座標 → 表示領域（CSSピクセル）。ミラー・フィット方式を考慮する */
  toDisplay(p: Pt): Pt
  /** 動画上の長さ → 表示上の長さ */
  scale: number
}

/**
 * 骨格・Target の座標（動画ピクセル）を、画面上の位置へ変換する唯一の関数。
 * <video> の object-fit と CSS の左右反転に対応する。
 */
export function createViewTransform(
  stage: Size,
  video: Size,
  fit: 'contain' | 'cover',
  mirror: boolean,
): ViewTransform {
  const sx = stage.w / video.w
  const sy = stage.h / video.h
  const scale = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy)
  const ox = (stage.w - video.w * scale) / 2
  const oy = (stage.h - video.h * scale) / 2
  return {
    scale,
    toDisplay: (p) => {
      const x = ox + p.x * scale
      return { x: mirror ? stage.w - x : x, y: oy + p.y * scale }
    },
  }
}
