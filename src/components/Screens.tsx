import type { CameraErrorCode } from '../camera/camera'

export type AppError = CameraErrorCode | 'model'

const ERROR_TEXT: Record<AppError, string> = {
  denied: 'カメラを許可してください',
  notfound: 'カメラが見つかりません',
  insecure: 'https で開いてください',
  unknown: 'カメラを使えません',
  model: '読み込めませんでした',
}

export function StartScreen({ ready, onStart }: { ready: boolean; onStart(): void }) {
  return (
    <main className="screen">
      <h1 className="title">足を上げましょう</h1>
      <button className="big-button" onClick={onStart} disabled={!ready}>
        {ready ? '開始' : '準備中…'}
      </button>
    </main>
  )
}

export function FinishScreen({ onRestart }: { onRestart(): void }) {
  return (
    <main className="screen">
      <h1 className="title success">成功!</h1>
      <button className="big-button" onClick={onRestart}>
        やり直す
      </button>
    </main>
  )
}

export function ErrorScreen({ error, onBack }: { error: AppError; onBack(): void }) {
  return (
    <main className="screen">
      <h1 className="title error">{ERROR_TEXT[error]}</h1>
      <button className="big-button" onClick={onBack}>
        もどる
      </button>
    </main>
  )
}
