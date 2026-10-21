/** Tiny WebAudio blips so the game has feedback before real SFX assets exist. */
let ctx: AudioContext | null = null;

function tone(freq: number, ms: number, type: OscillatorType = "square", gain = 0.05, delay = 0) {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000);
  } catch {}
}

export type Sfx = "key" | "hit" | "wrong" | "miss" | "win" | "lose";

export function playSfx(kind: Sfx) {
  switch (kind) {
    case "key":
      return tone(660, 40);
    case "hit":
      tone(523, 70);
      return tone(784, 110, "square", 0.05, 0.06);
    case "wrong":
      return tone(140, 120, "sawtooth", 0.06);
    case "miss":
      tone(220, 140, "triangle", 0.08);
      return tone(110, 220, "triangle", 0.08, 0.1);
    case "win":
      for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, 140, "square", 0.05, i * 0.1);
      return;
    case "lose":
      for (const [i, f] of [392, 330, 262, 196].entries()) tone(f, 180, "triangle", 0.07, i * 0.14);
      return;
  }
}

/** Pronounce a word: R2 audio if we have it, otherwise the browser's speech synthesis. */
export function speak(wordId: number, lemma: string) {
  const fallback = () => {
    try {
      const u = new SpeechSynthesisUtterance(lemma);
      u.lang = "en-US";
      u.rate = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  };
  const audio = new Audio(`/api/audio/${wordId}`);
  audio.onerror = fallback;
  audio.play().catch(fallback);
}
