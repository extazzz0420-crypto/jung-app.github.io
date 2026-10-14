/* Capture mono PCM at 24 kHz without main-thread audio processing. */
// Low-pass biquad (RBJ cookbook). Two in a row form a 4th-order Butterworth filter.
function lowPass(rate, cutoff, q) {
  const w = 2 * Math.PI * cutoff / rate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b = (1 - cos) / 2 / a0;
  return { b0: b, b1: 2 * b, b2: b, a1: -2 * cos / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function filter(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
  return y;
}
class JungCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.samples = [];
    // Dropping samples folds sound above 12 kHz back into the speech band (aliasing),
    // which the recognizer hears as hiss. Speech intelligibility lives below 8 kHz.
    this.filters = sampleRate > 24000 ? [lowPass(sampleRate, 10000, .5412), lowPass(sampleRate, 10000, 1.3066)] : [];
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const ratio = sampleRate / 24000;
    for (let i = 0; i < input.length; i++) {
      let value = input[i];
      for (const f of this.filters) value = filter(f, value);
      this.phase += 1;
      if (this.phase >= ratio) {
        this.phase -= ratio;
        this.samples.push(Math.max(-1, Math.min(1, value)));
      }
    }
    if (this.samples.length >= 480) {
      const pcm = new Int16Array(this.samples.length);
      let energy = 0;
      this.samples.forEach((value, i) => { pcm[i] = Math.round(value * 32767); energy += value * value; });
      this.port.postMessage({ pcm: pcm.buffer, rms: Math.sqrt(energy / pcm.length) }, [pcm.buffer]);
      this.samples = [];
    }
    return true;
  }
}
registerProcessor('jung-capture', JungCapture);
