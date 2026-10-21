import type { Facing } from '../camera/camera'
import type { DebugInfo } from '../engine/trainingEngine'
import type { LegRaiseSpec } from '../types'

interface Props {
  spec: LegRaiseSpec
  onSpec(spec: LegRaiseSpec): void
  facing: Facing
  onFacing(f: Facing): void
  debug: DebugInfo | null
}

/** 開発者用パネル。URL に ?dev を付けたときだけ表示する（通常ユーザーには出さない） */
export function DevPanel({ spec, onSpec, facing, onFacing, debug }: Props) {
  const slider = (label: string, key: 'raiseRatio' | 'radiusRatio' | 'holdMs', min: number, max: number, step: number) => (
    <label>
      {label}: {spec[key]}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={spec[key]}
        onChange={(e) => onSpec({ ...spec, [key]: Number(e.target.value) })}
      />
    </label>
  )
  return (
    <details className="dev-panel">
      <summary>dev</summary>
      {slider('Target高さ(脚長比)', 'raiseRatio', 0.1, 0.6, 0.05)}
      {slider('Target半径(脚長比)', 'radiusRatio', 0.08, 0.3, 0.01)}
      {slider('保持時間(ms)', 'holdMs', 300, 2000, 100)}
      <div className="dev-row">
        <button onClick={() => onSpec({ ...spec, side: spec.side === 'right' ? 'left' : 'right' })}>
          足: {spec.side === 'right' ? '右' : '左'}
        </button>
        <button onClick={() => onFacing(facing === 'user' ? 'environment' : 'user')}>
          カメラ: {facing === 'user' ? '前面' : '背面'}
        </button>
      </div>
      {debug && (
        <pre>
          {`fps ${debug.fps.toFixed(0)}  ${debug.delegate}\nlegLen ${debug.legLength.toFixed(0)}px\ndist/r ${debug.ankleToTarget?.toFixed(2) ?? '-'}\nknee ${debug.kneeAngle?.toFixed(0) ?? '-'}°`}
        </pre>
      )}
    </details>
  )
}
