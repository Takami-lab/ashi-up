import { createViewTransform } from '../geometry/viewTransform'
import { StandingCalibrator, type Baseline } from '../logic/calibration'
import { kneeAngleDeg } from '../logic/formJudge'
import { dist, mid } from '../logic/math'
import { PersonTracker } from '../logic/personTracker'
import { ReachJudge } from '../logic/reachJudge'
import { computeStepTarget, StepJudge } from '../logic/stepJudge'
import { computeTarget } from '../logic/target'
import { legIndices, LM } from '../pose/landmarks'
import type { PoseEstimator } from '../pose/poseEstimator'
import { LandmarkSmoother } from '../pose/smoothing'
import { drawOverlay, type OverlayState } from '../render/overlay'
import type { Lm, MotionId, MotionResult, Size, TrainingSpec, UiStatus } from '../types'

const MIN_FRAME_INTERVAL_MS = 33
const CLEAR_DISPLAY_MS = 1200
/** 腰が見えない状態がこれ以上続いたら基準を取り直す */
const LOST_RECALIBRATE_MS = 2000
/** 腰が基準位置から脚長×この比以上ずれた状態が続いたら取り直す */
const MOVED_RATIO = 0.6
const MOVED_RECALIBRATE_MS = 1500

export interface EngineCallbacks {
  onStatus(status: UiStatus): void
  /** 毎フレーム呼ばれる（Reactの再描画を伴わない用途のみ） */
  onProgress(progress: number): void
  /** 動作が終わった（成功／時間切れ）。結果表示の後に1回だけ呼ばれる */
  onResult(result: MotionResult, ms: number): void
  onDebug?(info: DebugInfo): void
}

export interface DebugInfo {
  fps: number
  delegate: string
  legLength: number
  ankleToTarget: number | null
  kneeAngle: number | null
  /** 検出された人数 */
  persons: number
  /** 対象の1人を追跡中か */
  locked: boolean
}

/**
 * カメラ映像を推論し、キャリブレーション → 到達判定 → 描画を回す。
 * React の描画サイクルとは独立（状態が変わったときだけコールバックで通知する）。
 */
export class TrainingEngine {
  private smoother = new LandmarkSmoother(0.5)
  /** トレーニングを行う1人を選び、全フローで同じ人物を追う */
  private tracker = new PersonTracker()
  private personCount = 0
  private calibrator: StandingCalibrator
  private judge: ReachJudge
  private stepJudge = new StepJudge()
  private activeSince = 0
  private baseline: Baseline | null = null
  private status: UiStatus | null = null
  private raf = 0
  private stopped = false
  private lastVideoTime = -1
  private lastInferAt = 0
  private lostMs = 0
  private movedMs = 0
  private lastFrameT: number | null = null
  private clearTimer = 0
  private fpsCount = 0
  private fpsSince = performance.now()
  private fps = 0
  private lastDebugAt = 0

  private stage: Size = { w: 1, h: 1 }
  private ctx: CanvasRenderingContext2D
  private overlay: Omit<OverlayState, 'tf'> = {
    landmarks: null,
    ankleIdx: 0,
    target: null,
    inside: false,
    progress: 0,
  }
  private videoSize: Size = { w: 1, h: 1 }

  constructor(
    private video: HTMLVideoElement,
    private canvas: HTMLCanvasElement,
    private estimator: PoseEstimator,
    private spec: TrainingSpec,
    private mirror: boolean,
    private motion: MotionId,
    private cb: EngineCallbacks,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.calibrator = new StandingCalibrator(spec.side)
    this.judge = new ReachJudge(spec.holdMs)
    this.overlay.ankleIdx = legIndices(spec.side).ankle
  }

  start() {
    this.raf = requestAnimationFrame(this.tick)
  }

  stop() {
    this.stopped = true
    cancelAnimationFrame(this.raf)
    clearTimeout(this.clearTimer)
  }

  /** 次の動作へ切り替える。基準姿勢を取り直す（全身が映る立位に戻ってもらう） */
  setMotion(motion: MotionId) {
    clearTimeout(this.clearTimer)
    this.motion = motion
    this.recalibrate()
  }

  /** 開発者設定の反映（Targetの高さなど）。対象の足が変わる場合は基準を取り直す */
  setSpec(spec: TrainingSpec) {
    if (spec.side !== this.spec.side) {
      this.calibrator = new StandingCalibrator(spec.side)
      this.overlay.ankleIdx = legIndices(spec.side).ankle
      this.recalibrate()
    }
    this.spec = spec
    this.judge.setHoldMs(spec.holdMs)
    this.refreshTarget()
    this.render()
  }

  /** 表示領域のサイズ変更（画面回転・リサイズ） */
  resize(w: number, h: number, dpr: number) {
    this.stage = { w, h }
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.render()
  }

  private tick = (now: number) => {
    if (this.stopped) return
    this.raf = requestAnimationFrame(this.tick)
    const v = this.video
    if (v.readyState < 2 || v.videoWidth === 0) return
    if (v.currentTime === this.lastVideoTime || now - this.lastInferAt < MIN_FRAME_INTERVAL_MS) return
    this.lastVideoTime = v.currentTime
    this.lastInferAt = now
    this.videoSize = { w: v.videoWidth, h: v.videoHeight }

    const poses = this.estimator.detect(v, now).map((p) =>
      p.map((q) => ({ x: q.x * v.videoWidth, y: q.y * v.videoHeight, v: q.visibility ?? 0 })),
    )
    this.personCount = poses.length
    const raw = this.tracker.select(now, poses, this.videoSize)
    const lms = raw ? this.smoother.apply(raw) : null
    if (!raw) this.smoother.reset()
    this.process(now, lms)
    this.render()
    this.updateFps(now)
  }

  private process(t: number, lms: Lm[] | null) {
    const dt = this.lastFrameT === null ? 0 : Math.min(t - this.lastFrameT, 200)
    this.lastFrameT = t
    this.overlay.landmarks = lms

    if (this.status === 'cleared' || this.status === 'timeout') return

    if (!this.baseline) {
      const r = this.calibrator.update(t, lms, this.videoSize)
      if (r.status === 'ready' && r.baseline) {
        this.baseline = r.baseline
        this.tracker.confirm()
        this.judge.reset()
        this.stepJudge.reset()
        this.activeSince = t
        this.lostMs = this.movedMs = 0
        this.refreshTarget()
        this.setStatus('active')
      } else {
        this.overlay.target = null
        this.overlay.inside = false
        this.overlay.progress = 0
        this.setStatus(r.status === 'noBody' ? 'noBody' : 'adjusting')
      }
      this.cb.onProgress(0)
      return
    }

    // --- 基準取得済み：到達判定 ---
    if (this.bodyWentAway(lms, dt)) {
      this.recalibrate()
      return
    }
    const target = this.overlay.target!
    const ankle = lms ? lms[legIndices(this.spec.side).ankle] : null
    const hips = lms && lms[LM.L_HIP].v >= 0.5 && lms[LM.R_HIP].v >= 0.5 ? mid(lms[LM.L_HIP], lms[LM.R_HIP]) : null
    const r =
      this.motion === 'raise'
        ? this.judge.update(t, ankle, target)
        : this.stepJudge.update(t, ankle, hips, this.baseline, this.spec)
    this.overlay.inside = r.inside
    this.overlay.progress = r.progress
    this.cb.onProgress(r.progress)
    if (r.cleared) this.finish('success', t)
    else if (t - this.activeSince >= this.spec.timeoutMs) this.finish('timeout', t)
    this.emitDebug(t, lms, ankle)
  }

  private finish(result: MotionResult, t: number) {
    const ms = Math.round(t - this.activeSince)
    this.setStatus(result === 'success' ? 'cleared' : 'timeout')
    this.clearTimer = window.setTimeout(() => this.cb.onResult(result, ms), CLEAR_DISPLAY_MS)
  }

  /** 人物がカメラから大きく外れた／動いたかどうか。外れていれば基準を取り直す */
  private bodyWentAway(lms: Lm[] | null, dt: number) {
    const b = this.baseline!
    const hipsSeen = lms && lms[LM.L_HIP].v >= 0.5 && lms[LM.R_HIP].v >= 0.5
    if (!hipsSeen) {
      this.lostMs += dt
      return this.lostMs > LOST_RECALIBRATE_MS
    }
    this.lostMs = 0
    const moved = dist(mid(lms[LM.L_HIP], lms[LM.R_HIP]), b.hipCenter) > MOVED_RATIO * b.legLength
    this.movedMs = moved ? this.movedMs + dt : 0
    return this.movedMs > MOVED_RECALIBRATE_MS
  }

  private recalibrate() {
    this.baseline = null
    this.calibrator.reset()
    this.judge.reset()
    this.stepJudge.reset()
    this.overlay.target = null
    this.overlay.inside = false
    this.overlay.progress = 0
    this.lostMs = this.movedMs = 0
    this.setStatus('adjusting')
  }

  private refreshTarget() {
    const b = this.baseline
    this.overlay.target = !b ? null : this.motion === 'raise' ? computeTarget(b, this.spec) : computeStepTarget(b, this.spec)
  }

  private setStatus(s: UiStatus) {
    if (s === this.status) return
    this.status = s
    this.cb.onStatus(s)
  }

  private render() {
    // 画面と映像の縦横が一致するときは画面いっぱい（cover）、違うときは全体表示（contain）
    const fit = this.stage.w < this.stage.h === this.videoSize.w < this.videoSize.h ? 'cover' : 'contain'
    this.video.style.objectFit = fit
    const tf = createViewTransform(this.stage, this.videoSize, fit, this.mirror)
    drawOverlay(this.ctx, this.stage, { ...this.overlay, tf })
  }

  private updateFps(now: number) {
    this.fpsCount++
    if (now - this.fpsSince >= 1000) {
      this.fps = (this.fpsCount * 1000) / (now - this.fpsSince)
      this.fpsCount = 0
      this.fpsSince = now
    }
  }

  private emitDebug(now: number, lms: Lm[] | null, ankle: Lm | null) {
    if (!this.cb.onDebug || now - this.lastDebugAt < 200) return
    this.lastDebugAt = now
    const leg = legIndices(this.spec.side)
    this.cb.onDebug({
      fps: this.fps,
      delegate: this.estimator.delegate,
      legLength: this.baseline?.legLength ?? 0,
      ankleToTarget: ankle && this.overlay.target ? dist(ankle, this.overlay.target.center) / this.overlay.target.radius : null,
      kneeAngle: lms ? kneeAngleDeg(lms[leg.hip], lms[leg.knee], lms[leg.ankle]) : null,
      persons: this.personCount,
      locked: this.tracker.locked,
    })
  }
}
