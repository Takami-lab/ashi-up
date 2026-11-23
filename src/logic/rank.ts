import type { MotionRecord } from '../types'

/**
 * 称号の閾値（1動作あたりの平均所要時間 ms、以下で該当）。上から順に判定する。
 * 暫定値：複数人の検証で「5秒より早ければ早い方」だったため、達人を 5 秒とした。
 */
export const RANKS = [
  { title: '名人', maxMs: 3000 },
  { title: '達人', maxMs: 5000 },
  { title: '上級者', maxMs: 8000 },
  { title: '初級者', maxMs: Infinity },
] as const

export type RankTitle = (typeof RANKS)[number]['title']

/** 全動作に成功したときだけ、平均所要時間から称号を決める（時間切れがあれば null） */
export function rankFor(records: MotionRecord[]): RankTitle | null {
  if (records.length === 0 || records.some((r) => r.result !== 'success')) return null
  const avg = records.reduce((sum, r) => sum + r.ms, 0) / records.length
  return RANKS.find((r) => avg <= r.maxMs)!.title
}
