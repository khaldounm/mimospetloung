// Counter feedback tones. Someone scanning a basket of items is looking at the
// products, not the screen, so acceptance and rejection have to be audible.
//
// The AudioContext is created on first use, since browsers refuse to start one
// before a user gesture, and reused after that. Every failure is swallowed:
// no sound is a worse invoice line than none, but it is never worth an error.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(frequency: number, seconds: number, gain: number): void {
  const audio = context();
  if (!audio) return;
  try {
    void audio.resume();
    const osc = audio.createOscillator();
    const volume = audio.createGain();
    osc.frequency.value = frequency;
    volume.gain.value = gain;
    osc.connect(volume).connect(audio.destination);
    const now = audio.currentTime;
    // Fade out rather than cutting the wave dead, which clicks.
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.start(now);
    osc.stop(now + seconds);
  } catch {
    // Audio is a nicety; never let it break a scan.
  }
}

// Short, high, unobtrusive: the scan landed.
export function beepAccept(): void {
  tone(1180, 0.07, 0.05);
}

// Lower and longer, so it is obviously not the accept tone from across a room.
export function beepReject(): void {
  tone(220, 0.3, 0.08);
}
