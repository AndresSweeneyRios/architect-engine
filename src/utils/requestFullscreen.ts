let lastFs = 0;
let lastPl = 0;

const THROTTLE_MS = 500;

/**
 * Request fullscreen (electron or browser).
 * 
 * Throttled in case of repeated rapid calls.
 */
export function requestFullscreen() {
  const now = Date.now();

  if (now - lastFs < THROTTLE_MS) return;

  lastFs = now;

  if ((window as any).electronRequestFullscreen) {
    void (window as any).electronRequestFullscreen();
  } else {
    document.body.requestFullscreen().catch(console.error);
  }
}

/**
 * Request pointer lock on the given element.
 * 
 * Throttled in case of repeated rapid calls.
 */
export function requestPointerLock(element: HTMLElement) {
  const now = Date.now();

  if (now - lastPl < THROTTLE_MS) return;

  lastPl = now;

  try {
    element.requestPointerLock();
  } catch (err) {
    console.error('PointerLock request failed', err);
  }
}
