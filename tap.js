// The ear's first step, on the audio thread: gather the input into blocks of 1024 samples and hand them over in order.
// The main thread may be busy drawing; blocks wait in the queue for it, none are lost.
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
  process(inputs, outputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === 1024) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(1024); this.n = 0; }
    }
    if (outputs[0] && outputs[0][0]) outputs[0][0].fill(0);
    return true;
  }
}
registerProcessor('tap', Tap);
