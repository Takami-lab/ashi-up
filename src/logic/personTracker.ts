import { LM, REQUIRED_BODY } from '../pose/landmarks'
import type { Lm, Pt, Size } from '../types'
import { dist, mid } from './math'

const MIN_VISIBILITY = 0.5
const FRAME_MARGIN = 0.01
/** 脚長（腰→足首）が画面の高さに対してこれ未満の人物は、遠すぎるとして対象にしない */
const MIN_LEG_RATIO = 0.12
/** 対象を取り込んだだけ（基準姿勢の取得前）の人物が、これ以上見えなければ解除する */
const TENTATIVE_RELEASE_MS = 1000
/** 基準姿勢まで取れた人物が、これ以上見えなければ解除する（全フローを同じ人物で行うため長め） */
const LOCKED_RELEASE_MS = 15000
/** 同一人物とみなす腰の移動距離の上限（脚長比）。見失っている時間に応じて広げる */
const GATE_BASE = 0.4
const GATE_PER_SEC = 0.2
const GATE_MAX = 0.8

/** 全身（腰・膝・足首）が信頼度つきで画面内に映っているか */
export function isFullBodyInFrame(lms: Lm[], frame: Size): boolean {
  const mx = frame.w * FRAME_MARGIN
  const my = frame.h * FRAME_MARGIN
  return REQUIRED_BODY.every((i) => {
    const p = lms[i]
    return p.v >= MIN_VISIBILITY && p.x > mx && p.x < frame.w - mx && p.y > my && p.y < frame.h - my
  })
}

/** 両脚が下へ伸びている（腰 < 膝 < 足首）。着席・しゃがみ・横向きの人物を除く */
export function isStanding(lms: Lm[]): boolean {
  return [LM.L_HIP, LM.R_HIP].every((h) => lms[h].y < lms[h + 2].y && lms[h + 2].y < lms[h + 4].y)
}

/** 両腰が見えていれば腰の中点 */
export function hipCenter(lms: Lm[]): Pt | null {
  const l = lms[LM.L_HIP]
  const r = lms[LM.R_HIP]
  return l.v >= MIN_VISIBILITY && r.v >= MIN_VISIBILITY ? mid(l, r) : null
}

function legLength(lms: Lm[]): number {
  return (dist(lms[LM.L_HIP], lms[LM.L_ANKLE]) + dist(lms[LM.R_HIP], lms[LM.R_ANKLE])) / 2
}

interface Anchor {
  center: Pt
  /** 脚長（px）。移動距離の物差し */
  scale: number
  /** 基準姿勢まで取れた人物か */
  confirmed: boolean
  lastSeenT: number
}

/**
 * 複数人が映る場面で、トレーニングを行う1人を選び、以後は同じ人物だけを追う。
 *
 * - 最初は「全身が映り、立っている」人物（複数なら最も大きい人物）を対象にする。
 *   着席していて上半身しか映らない人物は対象にならない。
 * - 対象になった後は、直前の腰の位置に最も近い人物だけを同一人物とみなす（位置の連続性）。
 *   ほかの人物が全身で映っても、対象は切り替わらない。
 * - 基準姿勢が取れた後は {@link confirm} で確定する。確定後は長く見失うまで解除しない。
 */
export class PersonTracker {
  private anchor: Anchor | null = null

  get locked(): boolean {
    return this.anchor !== null
  }

  reset() {
    this.anchor = null
  }

  /** 基準姿勢が取れた人物を確定する */
  confirm() {
    if (this.anchor) this.anchor.confirmed = true
  }

  /** 検出された全員（ピクセル座標）から対象の1人を返す。いなければ null */
  select(t: number, poses: Lm[][], frame: Size): Lm[] | null {
    const a = this.anchor
    if (a) {
      const gate = Math.min(GATE_BASE + (GATE_PER_SEC * (t - a.lastSeenT)) / 1000, GATE_MAX) * a.scale
      let best: Lm[] | null = null
      let bestC: Pt | null = null
      let bestD = Infinity
      for (const p of poses) {
        const c = hipCenter(p)
        if (!c) continue
        const d = dist(c, a.center)
        if (d <= gate && d < bestD) {
          best = p
          bestC = c
          bestD = d
        }
      }
      if (best && bestC) {
        a.center = bestC
        a.lastSeenT = t
        return best
      }
      if (t - a.lastSeenT <= (a.confirmed ? LOCKED_RELEASE_MS : TENTATIVE_RELEASE_MS)) return null
      this.anchor = null
    }

    let best: Lm[] | null = null
    let bestLen = 0
    for (const p of poses) {
      if (!isFullBodyInFrame(p, frame) || !isStanding(p)) continue
      const len = legLength(p)
      if (len >= MIN_LEG_RATIO * frame.h && len > bestLen) {
        best = p
        bestLen = len
      }
    }
    const c = best && hipCenter(best)
    if (!best || !c) return null
    this.anchor = { center: c, scale: bestLen, confirmed: false, lastSeenT: t }
    return best
  }
}
