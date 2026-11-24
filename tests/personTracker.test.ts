import { describe, expect, it } from 'vitest'
import { PersonTracker } from '../src/logic/personTracker'
import type { Lm } from '../src/types'

const frame = { w: 1280, h: 720 }

/** 立っている人物（脚長 = 2 * halfLeg）。cx は腰の中心x、hipY は腰のy */
function standing(cx: number, hipY = 200, legLen = 400): Lm[] {
  const lms: Lm[] = Array.from({ length: 33 }, () => ({ x: cx, y: hipY, v: 0.99 }))
  const set = (i: number, x: number, y: number) => (lms[i] = { x, y, v: 0.99 })
  set(23, cx + 40, hipY)
  set(24, cx - 40, hipY)
  set(25, cx + 40, hipY + legLen / 2)
  set(26, cx - 40, hipY + legLen / 2)
  set(27, cx + 40, hipY + legLen)
  set(28, cx - 40, hipY + legLen)
  return lms
}

/** 着席：腰と膝は同じ高さ、足首は画面外（下）で信頼度が低い */
function seated(cx: number): Lm[] {
  const lms = standing(cx, 300, 400)
  lms[25] = { x: cx + 40, y: 300, v: 0.9 }
  lms[26] = { x: cx - 40, y: 300, v: 0.9 }
  lms[27] = { x: cx + 40, y: 800, v: 0.2 }
  lms[28] = { x: cx - 40, y: 800, v: 0.2 }
  return lms
}

describe('PersonTracker', () => {
  it('着席している人（上半身のみ）は対象にしない', () => {
    const tr = new PersonTracker()
    expect(tr.select(0, [seated(200), seated(600), seated(1000)], frame)).toBeNull()
    expect(tr.locked).toBe(false)
  })

  it('着席者の中から全身が映る立位の1人を選ぶ', () => {
    const tr = new PersonTracker()
    const me = standing(640)
    const got = tr.select(0, [seated(200), me, seated(1000)], frame)
    expect(got).toBe(me)
    expect(tr.locked).toBe(true)
  })

  it('対象になった後は、別の人が全身で映っても切り替わらない', () => {
    const tr = new PersonTracker()
    const me = standing(640, 200, 400)
    tr.select(0, [me], frame)
    const other = standing(200, 100, 500) // 脚長が大きい別人
    const me2 = standing(645, 200, 400)
    expect(tr.select(33, [other, me2], frame)).toBe(me2)
  })

  it('対象が一時的に消えても、別人には移らない（基準姿勢の確定後）', () => {
    const tr = new PersonTracker()
    tr.select(0, [standing(640)], frame)
    tr.confirm()
    const other = standing(200, 100, 500)
    expect(tr.select(2000, [other], frame)).toBeNull()
    expect(tr.select(5000, [other], frame)).toBeNull()
    const back = standing(660)
    expect(tr.select(5033, [other, back], frame)).toBe(back)
  })

  it('確定前の人物は1秒見えなければ解除され、別の人を対象にできる', () => {
    const tr = new PersonTracker()
    tr.select(0, [standing(640)], frame)
    const other = standing(200, 100, 500)
    expect(tr.select(500, [other], frame)).toBeNull()
    expect(tr.select(1500, [other], frame)).toBe(other)
  })

  it('確定後でも長く（15秒超）見えなければ解除される', () => {
    const tr = new PersonTracker()
    tr.select(0, [standing(640)], frame)
    tr.confirm()
    const other = standing(200)
    expect(tr.select(14000, [other], frame)).toBeNull()
    expect(tr.select(16000, [other], frame)).toBe(other)
  })

  it('reset で対象を解除する', () => {
    const tr = new PersonTracker()
    tr.select(0, [standing(640)], frame)
    tr.reset()
    expect(tr.locked).toBe(false)
  })

  it('立位でも遠すぎる（小さい）人物は対象にしない', () => {
    const tr = new PersonTracker()
    expect(tr.select(0, [standing(640, 300, 60)], frame)).toBeNull()
  })
})
