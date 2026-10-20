// Web Audio alerts for the tournament clock.
//
// Mobile browsers keep an AudioContext "suspended" until the page has seen a
// user gesture, and creating one context per beep leaks and fails silently on
// iOS. So: a single lazily-created context, resumed on the first touch/click/
// key, and all alerts scheduled on it.

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;
let unlockInstalled = false;

function audioContext(): AudioContext | null {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    return context;
  } catch {
    return null;
  }
}

/** Resume the context from the first user gesture (mobile autoplay policy). */
function installGestureUnlock(): void {
  if (unlockInstalled || typeof document === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    const ctx = audioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("touchend", unlock, { passive: true });
  document.addEventListener("keydown", unlock);
}

function tone(
  frequency: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = "square",
): void {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime + startOffset;
    osc.frequency.setValueAtTime(frequency, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.setValueAtTime(volume, t0 + Math.max(0.03, duration - 0.03));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* audio not available */
  }
}

/** Triple beep announcing that the blinds went up. */
export function playLevelChangeSound(): void {
  installGestureUnlock();
  tone(880, 0, 0.14, 0.25);
  tone(880, 0.2, 0.14, 0.25);
  tone(880, 0.4, 0.28, 0.3);
}

/** Softer double blip: one minute before the blinds go up. */
export function playLevelWarningSound(): void {
  installGestureUnlock();
  tone(660, 0, 0.1, 0.18, "sine");
  tone(660, 0.16, 0.1, 0.18, "sine");
}

// Install the unlock listeners as soon as the module loads so any early tap
// on the page makes later alerts audible.
installGestureUnlock();
