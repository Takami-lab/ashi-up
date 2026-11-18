import { useEffect, useRef, useState } from 'react'
import { CameraError, closeCamera, openCamera, type CameraErrorCode, type Facing } from '../camera/camera'
import { TrainingEngine, type DebugInfo } from '../engine/trainingEngine'
import type { PoseEstimator } from '../pose/poseEstimator'
import type { MotionId, MotionResult, Side, TrainingSpec, UiStatus } from '../types'

const MESSAGES: Record<UiStatus | 'loading', string> = {
  loading: '準備中…',
  noBody: '全身を映して',
  adjusting: 'まっすぐ立って',
  active: '',
  cleared: 'CLEAR!',
  timeout: '時間切れ',
}

const SIDE_LABEL = { right: '右', left: '左' } as const

const ACTIVE_MESSAGE: Record<MotionId, (side: Side) => string> = {
  raise: (s) => `${SIDE_LABEL[s]}足を上げて`,
  step: (s) => `${SIDE_LABEL[s]}足を横に踏み出して`,
}

interface Props {
  estimator: PoseEstimator
  spec: TrainingSpec
  facing: Facing
  motion: MotionId
  onResult(result: MotionResult, ms: number): void
  onCameraError(code: CameraErrorCode): void
  onDebug?(info: DebugInfo): void
}

/** 画面の向き。変わったらカメラを取り直し、向きに合った縦横の映像を得る */
function usePortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const on = () => setPortrait(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return portrait
}

export function TrainingScreen({ estimator, spec, facing, motion, onResult, onCameraError, onDebug }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<TrainingEngine | null>(null)
  const specRef = useRef(spec)
  const motionRef = useRef(motion)
  const [status, setStatus] = useState<UiStatus | 'loading'>('loading')
  const mirror = facing === 'user'
  const portrait = usePortrait()

  // コールバックは最新を参照しつつ、エンジンの再生成は避ける
  const cbRef = useRef({ onResult, onCameraError, onDebug })
  useEffect(() => {
    cbRef.current = { onResult, onCameraError, onDebug }
  })

  // カメラ起動 + エンジン開始。アンマウント／カメラ切替時にトラックを解放する
  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let engine: TrainingEngine | null = null
    const video = videoRef.current!
    const canvas = canvasRef.current!
    const stage = stageRef.current!

    const ro = new ResizeObserver(() => {
      engine?.resize(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1)
    })
    ro.observe(stage)

    ;(async () => {
      try {
        stream = await openCamera(facing, portrait)
        if (cancelled) return closeCamera(stream)
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        engine = new TrainingEngine(video, canvas, estimator, specRef.current, mirror, motionRef.current, {
          onStatus: setStatus,
          onProgress: (p) => {
            if (barRef.current) barRef.current.style.width = `${p * 100}%`
          },
          onResult: (r, ms) => cbRef.current.onResult(r, ms),
          onDebug: cbRef.current.onDebug && ((i) => cbRef.current.onDebug?.(i)),
        })
        engineRef.current = engine
        engine.resize(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1)
        engine.start()
      } catch (e) {
        if (!cancelled) cbRef.current.onCameraError(e instanceof CameraError ? e.code : 'unknown')
      }
    })()

    return () => {
      cancelled = true
      ro.disconnect()
      engine?.stop()
      engineRef.current = null
      closeCamera(stream)
      video.srcObject = null
    }
  }, [estimator, facing, mirror, portrait])

  // 開発者設定の変更を実行中のエンジンへ反映
  useEffect(() => {
    specRef.current = spec
    engineRef.current?.setSpec(spec)
  }, [spec])

  // 動作の切替（カメラは開いたまま、基準姿勢だけ取り直す）
  useEffect(() => {
    motionRef.current = motion
    engineRef.current?.setMotion(motion)
  }, [motion])

  return (
    <div className={`training ${status === 'cleared' ? 'is-cleared' : status === 'timeout' ? 'is-timeout' : ''}`}>
      <div className="instruction" role="status" aria-live="polite">
        {status === 'active' ? ACTIVE_MESSAGE[motion](spec.side) : MESSAGES[status]}
      </div>
      <div className="stage" ref={stageRef}>
        <video ref={videoRef} className={mirror ? 'mirrored' : ''} playsInline muted autoPlay />
        <canvas ref={canvasRef} />
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress-bar" ref={barRef} />
      </div>
    </div>
  )
}
