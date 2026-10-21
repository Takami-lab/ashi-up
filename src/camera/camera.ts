export type Facing = 'user' | 'environment'

export type CameraErrorCode = 'insecure' | 'denied' | 'notfound' | 'unknown'

export class CameraError extends Error {
  constructor(public code: CameraErrorCode) {
    super(code)
  }
}

/** カメラを起動して MediaStream を返す。失敗時は CameraError */
export async function openCamera(facing: Facing): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('insecure')
  }
  const portrait = window.innerHeight >= window.innerWidth
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: portrait ? 720 : 1280 },
        height: { ideal: portrait ? 1280 : 720 },
      },
    })
  } catch (e) {
    const name = (e as DOMException).name
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied')
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('notfound')
    throw new CameraError('unknown')
  }
}

/** すべてのトラックを停止してカメラを解放する */
export function closeCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}
