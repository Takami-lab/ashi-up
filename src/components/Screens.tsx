import type { CameraErrorCode } from '../camera/camera'
import type { MotionId, MotionRecord, Side } from '../types'

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

const MOTION_LABEL: Record<MotionId, string> = { raise: '足上げ', step: '横ステップ' }
const SIDE_LABEL: Record<Side, string> = { right: '右', left: '左' }

/** 動作ごとの結果（○ 成功 / × 未達成）。履歴は保存しない */
export function FinishScreen({ records, onRestart }: { records: MotionRecord[]; onRestart(): void }) {
  const allClear = records.every((r) => r.result === 'success')
  return (
    <main className="screen">
      <h1 className={`title ${allClear ? 'success' : ''}`}>{allClear ? '成功!' : 'もう少し!'}</h1>
      <ul className="results">
        {records.map((r) => (
          <li key={`${r.side}-${r.motion}`} className={r.result === 'success' ? 'ok' : 'ng'}>
            <span>
              {SIDE_LABEL[r.side]}
              {MOTION_LABEL[r.motion]}
            </span>
            <span className="mark" aria-label={r.result === 'success' ? '成功' : '未達成'}>
              {r.result === 'success' ? '○' : '×'}
            </span>
          </li>
        ))}
      </ul>
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
