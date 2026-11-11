import { describe, expect, it } from 'vitest'
import { createViewTransform } from '../src/geometry/viewTransform'
import { StandingCalibrator } from '../src/logic/calibration'
import { lateralOffset, outwardSign, toBodyUnits } from '../src/logic/normalize'
import { ReachJudge } from '../src/logic/reachJudge'
import { computeTarget } from '../src/logic/target'
import { DEFAULT_SPEC, type Lm } from '../src/types'

const frame = { w: 720, h: 1280 }

/** 直立姿勢の合成ランドマーク。rightAnkleLift だけ右足首を上へ（px）。脚長は500px */
function pose(rightAnkleLift = 0, vis = 0.99): Lm[] {
  const lms: Lm[] = Array.from({ length: 33 }, () => ({ x: 360, y: 400, v: vis }))
  const set = (i: number, x: number, y: number) => (lms[i] = { x, y, v: vis })
  set(23, 420, 600)
  set(24, 300, 600)
  set(25, 420, 850)
  set(26, 300, 850 - rightAnkleLift / 2)
  set(27, 420, 1100)
  set(28, 300, 1100 - rightAnkleLift)
  return lms
}

function calibrated() {
  const cal = new StandingCalibrator('right')
  let r = cal.update(0, pose(), frame)
  for (let t = 33; t <= 1100; t += 33) r = cal.update(t, pose(), frame)
  return r
}

describe('StandingCalibrator', () => {
  it('立位が1秒続くと基準が取れる', () => {
    const cal = new StandingCalibrator('right')
    expect(cal.update(0, pose(), frame).status).toBe('adjusting')
    const r = calibrated()
    expect(r.status).toBe('ready')
    expect(r.baseline!.legLength).toBeCloseTo(500, 0)
  })

  it('全身が見えていなければ noBody', () => {
    expect(new StandingCalibrator('right').update(0, pose(0, 0.1), frame).status).toBe('noBody')
    expect(new StandingCalibrator('right').update(0, null, frame).status).toBe('noBody')
  })

  it('脚を上げている最中は基準を取らない', () => {
    const cal = new StandingCalibrator('right')
    let r = cal.update(0, pose(200), frame)
    for (let t = 33; t <= 1500; t += 33) r = cal.update(t, pose(200), frame)
    expect(r.status).not.toBe('ready')
  })
})

describe('Target と到達判定', () => {
  const target = computeTarget(calibrated().baseline!, DEFAULT_SPEC)

  it('Target は足首の真上、脚長の30%', () => {
    expect(target.center.x).toBeCloseTo(300, 0)
    expect(target.center.y).toBeCloseTo(1100 - 150, 0)
    expect(target.radius).toBeCloseTo(75, 0)
  })

  it('立位のままでは CLEAR にならない', () => {
    const j = new ReachJudge(700)
    let s
    for (let t = 0; t < 3000; t += 33) s = j.update(t, pose()[28], target)
    expect(s!.cleared).toBe(false)
  })

  it('0.7秒連続で入ると CLEAR（0.6秒では未達）', () => {
    const j = new ReachJudge(700)
    let s
    for (let t = 0; t < 600; t += 33) s = j.update(t, pose(150)[28], target)
    expect(s!.cleared).toBe(false)
    for (let t = 600; t < 800; t += 33) s = j.update(t, pose(150)[28], target)
    expect(s!.cleared).toBe(true)
  })

  it('信頼度が低い・外れると進捗が戻る', () => {
    const j = new ReachJudge(700)
    for (let t = 0; t < 500; t += 33) j.update(t, pose(150)[28], target)
    expect(j.update(530, pose(150, 0.2)[28], target).progress).toBe(0)
    for (let t = 560; t < 1000; t += 33) j.update(t, pose(150)[28], target)
    expect(j.update(1033, pose(0)[28], target).progress).toBe(0)
  })
})

describe('正規化', () => {
  const b = calibrated().baseline!

  it('腰幅が基準に入る', () => {
    expect(b.hipWidth).toBeCloseTo(120, 0)
  })

  it('横は腰幅比、縦は脚長比（上向き正）', () => {
    expect(toBodyUnits({ x: 300 - 120, y: 1100 - 250 }, b)).toEqual({ x: -1, y: 0.5 })
  })

  it('外向き方向は基準姿勢から決まる（右足が画像左側なら左向きが外）', () => {
    expect(outwardSign(b)).toBe(-1)
    expect(lateralOffset({ x: 300 - 120, y: 1100 }, b)).toBeCloseTo(1, 5)
    expect(lateralOffset({ x: 300 + 60, y: 1100 }, b)).toBeCloseTo(-0.5, 5)
  })

  it('カメラ距離（スケール）が変わっても同じ値になる', () => {
    const scale = (l: Lm[]) => l.map((p) => ({ ...p, x: p.x * 2, y: p.y * 2 }))
    const cal = new StandingCalibrator('right')
    let r = cal.update(0, scale(pose()), { w: 1440, h: 2560 })
    for (let t = 33; t <= 1100; t += 33) r = cal.update(t, scale(pose()), { w: 1440, h: 2560 })
    const b2 = r.baseline!
    expect(lateralOffset({ x: 600 - 240, y: 2200 }, b2)).toBeCloseTo(1, 5)
  })
})

describe('createViewTransform', () => {
  it('ミラー時は左右反転し、contain は中央寄せ', () => {
    const tf = createViewTransform({ w: 1000, h: 500 }, { w: 500, h: 500 }, 'contain', true)
    expect(tf.toDisplay({ x: 0, y: 0 })).toEqual({ x: 750, y: 0 })
    expect(tf.toDisplay({ x: 500, y: 500 })).toEqual({ x: 250, y: 500 })
  })
})
