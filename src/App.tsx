import { useEffect, useState } from 'react'
import type { Facing } from './camera/camera'
import { DevPanel } from './components/DevPanel'
import { ErrorScreen, FinishScreen, StartScreen, type AppError } from './components/Screens'
import { TrainingScreen } from './components/TrainingScreen'
import type { DebugInfo } from './engine/trainingEngine'
import { PoseEstimator } from './pose/poseEstimator'
import { DEFAULT_SPEC, type LegRaiseSpec } from './types'

type Phase = 'start' | 'training' | 'finish' | 'error'

const DEV = new URLSearchParams(window.location.search).has('dev')

export default function App() {
  const [phase, setPhase] = useState<Phase>('start')
  const [error, setError] = useState<AppError>('unknown')
  const [estimator, setEstimator] = useState<PoseEstimator | null>(null)
  const [spec, setSpec] = useState<LegRaiseSpec>(DEFAULT_SPEC)
  const [facing, setFacing] = useState<Facing>('user')
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

  const fail = (e: AppError) => {
    setError(e)
    setPhase('error')
  }

  return (
    <>
      {phase === 'start' && <StartScreen ready={!!estimator} onStart={() => setPhase('training')} />}
      {phase === 'training' && estimator && (
        <TrainingScreen
          estimator={estimator}
          spec={spec}
          facing={facing}
          onCleared={() => setPhase('finish')}
          onCameraError={fail}
          onDebug={DEV ? setDebug : undefined}
        />
      )}
      {phase === 'finish' && <FinishScreen onRestart={() => setPhase('training')} />}
      {phase === 'error' && <ErrorScreen error={error} onBack={() => (error === 'model' ? location.reload() : setPhase('start'))} />}
      {DEV && phase !== 'finish' && (
        <DevPanel spec={spec} onSpec={setSpec} facing={facing} onFacing={setFacing} debug={debug} />
      )}
    </>
  )
}
