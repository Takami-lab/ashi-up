/** 所要時間（ms）を「3.2秒」の形式にする。将来の称号判定は、この ms の値を閾値と比べる */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}秒`
}
