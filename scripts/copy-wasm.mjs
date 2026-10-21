// MediaPipe の WASM を public/ にコピーする（外部CDNに依存せず、同一オリジンから配信するため）
import { cpSync, mkdirSync } from 'node:fs'

const from = 'node_modules/@mediapipe/tasks-vision/wasm'
const to = 'public/mediapipe/wasm'
mkdirSync(to, { recursive: true })
cpSync(from, to, { recursive: true })
console.log(`copied ${from} -> ${to}`)
