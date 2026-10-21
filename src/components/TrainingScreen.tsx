import { useEffect, useRef, useState } from 'react'
import { CameraError, closeCamera, openCamera, type CameraErrorCode, type Facing } from '../camera/camera'
import { TrainingEngine, type DebugInfo } from '../engine/trainingEngine'
import type { PoseEstimator } from '../pose/poseEstimator'
import type { LegRaiseSpec, UiStatus } from '../types'

const MESSAGES: Record<UiStatus | 'loading', string> = {
  loading: '準備中…',
  noBody: '全身を映して',
  adjusting: 'まっすぐ立って',
  active: '足を上げて',
  cleared: 'CLEAR!',
}

interface Props {
  estimator: PoseEstimator
  spec: LegRaiseSpec
  facing: Facing
  onCleared(): void
  onCameraError(code: CameraErrorCode): void
  onDebug?(info: DebugInfo): void
}

export function TrainingScreen({ estimator, spec, facing, onCleared, onCameraError, onDebug }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<TrainingEngine | null>(null)
  const specRef = useRef(spec)
  const [status, setStatus] = useState<UiStatus | 'loading'>('loading')
  const mirror = facing === 'user'

  // コールバックは最新を参照しつつ、エンジンの再生成は避ける
  const cbRef = useRef({ onCleared, onCameraError, onDebug })
  useEffect(() => {
    cbRef.current = { onCleared, onCameraError, onDebug }
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
        stream = await openCamera(facing)
        if (cancelled) return closeCamera(stream)
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        engine = new TrainingEngine(video, canvas, estimator, specRef.current, mirror, {
          onStatus: setStatus,
          onProgress: (p) => {
            if (barRef.current) barRef.current.style.width = `${p * 100}%`
          },
          onCleared: () => cbRef.current.onCleared(),
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
  }, [estimator, facing, mirror])

  // 開発者設定の変更を実行中のエンジンへ反映
  useEffect(() => {
    specRef.current = spec
    engineRef.current?.setSpec(spec)
  }, [spec])

  return (
    <div className={`training ${status === 'cleared' ? 'is-cleared' : ''}`}>
      <div className="instruction" role="status" aria-live="polite">
        {MESSAGES[status]}
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
