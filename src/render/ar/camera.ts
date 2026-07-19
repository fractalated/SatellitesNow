export class CameraError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CameraError';
  }
}

/** Starts the rear camera into the given video element. Returns a stop function
 * that releases the camera stream (important — leaving it open drains battery). */
export async function startRearCamera(video: HTMLVideoElement): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('Camera access is not available in this browser.');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (error) {
    throw new CameraError('Camera permission was denied or no camera is available.', error);
  }

  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();

  return () => {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };
}
