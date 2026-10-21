import { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { ViewTransform } from '../geometry/viewTransform'
import type { Target } from '../logic/target'
import { DRAWN_INDICES } from '../pose/landmarks'
import type { Lm, Size } from '../types'

const BLUE = '#1e6fd9'
const GREEN = '#1faa59'
const ANKLE_COLOR = '#ff7a00'

const BODY_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS.filter(
  (c) => DRAWN_INDICES.has(c.start) && DRAWN_INDICES.has(c.end),
)

export interface OverlayState {
  tf: ViewTransform
  /** 動画ピクセル座標の（平滑化済み）ランドマーク */
  landmarks: Lm[] | null
  /** ハイライトする足首の番号 */
  ankleIdx: number
  target: Target | null
  inside: boolean
  progress: number
}

/** 骨格とTargetを描画する。座標はすべて tf で表示座標へ変換する */
export function drawOverlay(ctx: CanvasRenderingContext2D, stage: Size, s: OverlayState) {
  ctx.clearRect(0, 0, stage.w, stage.h)
  ctx.lineCap = 'round'
  const { tf } = s

  if (s.landmarks) {
    const pts = s.landmarks.map((p) => ({ ...tf.toDisplay(p), v: p.v }))
    for (const [width, color] of [
      [5, 'rgba(255,255,255,0.85)'],
      [2.5, BLUE],
    ] as const) {
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.beginPath()
      for (const { start, end } of BODY_CONNECTIONS) {
        const a = pts[start]
        const b = pts[end]
        if (a.v < 0.3 || b.v < 0.3) continue
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }
    ctx.lineWidth = 2
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = BLUE
    for (const i of DRAWN_INDICES) {
      const p = pts[i]
      if (i === s.ankleIdx || p.v < 0.3) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  if (s.target) {
    const c = tf.toDisplay(s.target.center)
    const r = s.target.radius * tf.scale
    const color = s.inside ? GREEN : BLUE
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.fillStyle = s.inside ? 'rgba(31,170,89,0.3)' : 'rgba(30,111,217,0.15)'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    ctx.lineWidth = 5
    ctx.strokeStyle = color
    ctx.stroke()

    if (s.progress > 0) {
      ctx.beginPath()
      ctx.arc(c.x, c.y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.progress)
      ctx.lineWidth = 8
      ctx.strokeStyle = GREEN
      ctx.stroke()
    }
  }

  // 足首は最前面に目立つ色で
  if (s.landmarks) {
    const a = s.landmarks[s.ankleIdx]
    if (a.v >= 0.3) {
      const p = tf.toDisplay(a)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2)
      ctx.fillStyle = ANKLE_COLOR
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#fff'
      ctx.stroke()
    }
  }
}
