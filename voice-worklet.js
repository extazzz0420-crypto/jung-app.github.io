/* Capture mono PCM at 24 kHz without main-thread audio processing. */
class JungCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.samples = [];
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const ratio = sampleRate / 24000;
    for (let i = 0; i < input.length; i++) {
      this.phase += 1;
      if (this.phase >= ratio) {
        this.phase -= ratio;
        this.samples.push(Math.max(-1, Math.min(1, input[i])));
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
