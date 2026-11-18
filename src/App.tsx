import { useEffect, useMemo, useState } from 'react'
import type { Facing } from './camera/camera'
import { DevPanel } from './components/DevPanel'
import { ErrorScreen, FinishScreen, StartScreen, type AppError } from './components/Screens'
import { TrainingScreen } from './components/TrainingScreen'
import type { DebugInfo } from './engine/trainingEngine'
import { PoseEstimator } from './pose/poseEstimator'
import { DEFAULT_SPEC, type MotionId, type MotionRecord, type MotionResult, type Side, type TrainingSpec } from './types'

/** 実施する動作の順序（右：片足上げ → 横ステップ、続けて左：片足上げ → 横ステップ） */
const SEQUENCE: { motion: MotionId; side: Side }[] = [
  { motion: 'raise', side: 'right' },
  { motion: 'step', side: 'right' },
  { motion: 'raise', side: 'left' },
  { motion: 'step', side: 'left' },
]

type Phase = 'start' | 'training' | 'finish' | 'error'

const DEV = new URLSearchParams(window.location.search).has('dev')

export default function App() {
  const [phase, setPhase] = useState<Phase>('start')
  const [error, setError] = useState<AppError>('unknown')
  const [estimator, setEstimator] = useState<PoseEstimator | null>(null)
  const [spec, setSpec] = useState<TrainingSpec>(DEFAULT_SPEC)
  const [facing, setFacing] = useState<Facing>('user')
  const [motionIdx, setMotionIdx] = useState(0)
  const [records, setRecords] = useState<MotionRecord[]>([])
  const [debug, setDebug] = useState<DebugInfo | null>(null)

  // MediaPipe は起動時に読み込む（Startボタンは完了まで押せない）
  useEffect(() => {
    let cancelled = false
    let created: PoseEstimator | null = null
    PoseEstimator.create().then(
      (e) => {
        created = e
        if (cancelled) e.close()
        else setEstimator(e)
      },
      (e) => {
        console.error(e)
        if (!cancelled) {
          setError('model')
          setPhase('error')
        }
      },
    )
    return () => {
      cancelled = true
      created?.close()
    }
  }, [])

  const current = SEQUENCE[motionIdx]
  // 対象の足は動作順序で決まる（開発者設定の値は足以外を使う）
  const activeSpec = useMemo(() => ({ ...spec, side: current.side }), [spec, current.side])

  const start = () => {
    setMotionIdx(0)
    setRecords([])
    setPhase('training')
  }

  const onResult = (result: MotionResult, ms: number) => {
    setRecords((rs) => [...rs, { ...SEQUENCE[motionIdx], result, ms }])
    if (motionIdx + 1 < SEQUENCE.length) setMotionIdx(motionIdx + 1)
    else setPhase('finish')
  }

  const fail = (e: AppError) => {
    setError(e)
    setPhase('error')
  }

  return (
    <>
      {phase === 'start' && <StartScreen ready={!!estimator} onStart={start} />}
      {phase === 'training' && estimator && (
        <TrainingScreen
          estimator={estimator}
          spec={activeSpec}
          facing={facing}
          motion={current.motion}
          onResult={onResult}
          onCameraError={fail}
          onDebug={DEV ? setDebug : undefined}
        />
      )}
      {phase === 'finish' && <FinishScreen records={records} onRestart={start} />}
      {phase === 'error' && <ErrorScreen error={error} onBack={() => (error === 'model' ? location.reload() : setPhase('start'))} />}
      {DEV && phase !== 'finish' && (
        <DevPanel spec={spec} onSpec={setSpec} facing={facing} onFacing={setFacing} debug={debug} />
      )}
    </>
  )
}
