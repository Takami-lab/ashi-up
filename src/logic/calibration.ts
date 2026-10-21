import { legIndices, LM, REQUIRED_BODY } from '../pose/landmarks'
import type { Lm, Pt, Side, Size } from '../types'
import { dist, mean, mid } from './math'

/** 直立姿勢の基準（動画ピクセル座標） */
export interface Baseline {
  /** 対象脚の腰・足首 */
  hip: Pt
  ankle: Pt
  /** 両腰の中点（身体の大きな移動の検知用） */
  hipCenter: Pt
  /** 対象脚の腰→足首の距離。体格の物差しとして使う */
  legLength: number
}

export type CalibStatus = 'noBody' | 'adjusting' | 'ready'

interface Sample extends Baseline {
  t: number
}

const MIN_VISIBILITY = 0.5
const FRAME_MARGIN = 0.01
const STABLE_MS = 1000
/** 安定とみなす最大のぶれ（脚長に対する比） */
const MAX_SPREAD = 0.08
/** 脚がどれだけ真っ直ぐか（腰-足首 / (腰-膝 + 膝-足首)） */
const MIN_STRAIGHTNESS = 0.9
/** 左右の脚長の比の下限（斜めから映った場合の差を許容） */
const MIN_LEG_SYMMETRY = 0.8

/** 全身が映り、真っ直ぐ立って静止している状態を検出し、基準姿勢を求める */
export class StandingCalibrator {
  private samples: Sample[] = []

  constructor(private side: Side) {}

  reset() {
    this.samples = []
  }

  update(t: number, lms: Lm[] | null, frame: Size): { status: CalibStatus; baseline?: Baseline } {
    if (!lms || !this.fullBodyInFrame(lms, frame)) {
      this.samples = []
      return { status: 'noBody' }
    }
    if (!this.isUpright(lms)) {
      this.samples = []
      return { status: 'adjusting' }
    }

    const leg = legIndices(this.side)
    const hip = lms[leg.hip]
    const ankle = lms[leg.ankle]
    this.samples.push({
      t,
      hip: { x: hip.x, y: hip.y },
      ankle: { x: ankle.x, y: ankle.y },
      hipCenter: mid(lms[LM.L_HIP], lms[LM.R_HIP]),
      legLength: dist(hip, ankle),
    })
    while (this.samples.length > 1 && t - this.samples[0].t > STABLE_MS + 300) this.samples.shift()

    const first = this.samples[0]
    if (t - first.t < STABLE_MS || !this.isStill()) return { status: 'adjusting' }

    const s = this.samples
    return {
      status: 'ready',
      baseline: {
        hip: mean(s.map((p) => p.hip)),
        ankle: mean(s.map((p) => p.ankle)),
        hipCenter: mean(s.map((p) => p.hipCenter)),
        legLength: s.reduce((sum, p) => sum + p.legLength, 0) / s.length,
      },
    }
  }

  private fullBodyInFrame(lms: Lm[], frame: Size) {
    const mx = frame.w * FRAME_MARGIN
    const my = frame.h * FRAME_MARGIN
    return REQUIRED_BODY.every((i) => {
      const p = lms[i]
      return p.v >= MIN_VISIBILITY && p.x > mx && p.x < frame.w - mx && p.y > my && p.y < frame.h - my
    })
  }

  /** 両脚が下向きに伸びている（しゃがみ・横向き・脚上げ中を除外） */
  private isUpright(lms: Lm[]) {
    const lengths = [LM.L_HIP, LM.R_HIP].map((hipIdx) => dist(lms[hipIdx], lms[hipIdx + 4]))
    // 左右の脚長が大きく違う＝片足が上がっている
    if (Math.min(...lengths) / Math.max(...lengths) < MIN_LEG_SYMMETRY) return false
    return [LM.L_HIP, LM.R_HIP].every((hipIdx) => {
      const hip = lms[hipIdx]
      const knee = lms[hipIdx + 2]
      const ankle = lms[hipIdx + 4]
      const straight = dist(hip, ankle) / (dist(hip, knee) + dist(knee, ankle))
      return hip.y < knee.y && knee.y < ankle.y && straight >= MIN_STRAIGHTNESS
    })
  }

  private isStill() {
    const s = this.samples
    const L = s.reduce((sum, p) => sum + p.legLength, 0) / s.length
    const extent = (pick: (p: Sample) => Pt) => {
      const xs = s.map((p) => pick(p).x)
      const ys = s.map((p) => pick(p).y)
      return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    }
    return Math.max(extent((p) => p.ankle), extent((p) => p.hipCenter)) / L < MAX_SPREAD
  }
}
