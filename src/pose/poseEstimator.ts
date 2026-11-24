import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

const BASE = import.meta.env.BASE_URL
const WASM_DIR = `${BASE}mediapipe/wasm`
const MODEL_PATH = `${BASE}models/pose_landmarker_lite.task`

/** 同時に検出する人数。着席している人たちの中から、立っている1人を選べるようにする */
const MAX_POSES = 5

type Delegate = 'GPU' | 'CPU'
type Vision = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

/**
 * MediaPipe PoseLandmarker（VIDEOモード）のラッパー。
 * GPU で初期化し、失敗・実行時エラーの場合は CPU に切り替える。
 */
export class PoseEstimator {
  private rebuilding = false

  private constructor(
    private landmarker: PoseLandmarker,
    private vision: Vision,
    public delegate: Delegate,
  ) {}

  static async create(): Promise<PoseEstimator> {
    const vision = await FilesetResolver.forVisionTasks(WASM_DIR)
    try {
      return new PoseEstimator(await build(vision, 'GPU'), vision, 'GPU')
    } catch (e) {
      console.warn('GPU delegate unavailable, falling back to CPU', e)
      return new PoseEstimator(await build(vision, 'CPU'), vision, 'CPU')
    }
  }

  /** 検出された全員分のランドマーク（0..1 正規化）を返す。検出なし・切替中は空配列 */
  detect(video: HTMLVideoElement, timestampMs: number): NormalizedLandmark[][] {
    if (this.rebuilding) return []
    try {
      return this.landmarker.detectForVideo(video, timestampMs).landmarks
    } catch (e) {
      if (this.delegate === 'GPU') {
        console.warn('GPU inference failed, switching to CPU', e)
        void this.switchToCpu()
      } else {
        console.error(e)
      }
      return []
    }
  }

  private async switchToCpu() {
    this.rebuilding = true
    try {
      this.landmarker.close()
      this.landmarker = await build(this.vision, 'CPU')
      this.delegate = 'CPU'
    } finally {
      this.rebuilding = false
    }
  }

  close() {
    this.landmarker.close()
  }
}

function build(vision: Vision, delegate: Delegate) {
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numPoses: MAX_POSES,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}
