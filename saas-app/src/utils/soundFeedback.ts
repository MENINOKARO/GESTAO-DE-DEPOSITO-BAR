/**
 * Feedback sonoro via Web Audio API idêntico ao PainelDeposito360 legado.
 */
export function beep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        void ctx.close();
      } catch {
        // ignore audio context cleanup error
      }
    }, 70);
  } catch {
    // ignore Web Audio failure
  }
}

export function beepErro(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    gain.gain.value = 0.12;
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        void ctx.close();
      } catch {
        // ignore audio context cleanup error
      }
    }, 180);
  } catch {
    // ignore Web Audio failure
  }
}
