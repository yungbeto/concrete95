/**
 * PCM capture AudioWorkletProcessor.
 * Batches stereo frames and posts them to the main thread as Float32Arrays.
 * Outputs silence so connecting to destination is safe (keeps the graph alive).
 */
const BATCH_SIZE = 8192;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._leftBuf = new Float32Array(BATCH_SIZE);
    this._rightBuf = new Float32Array(BATCH_SIZE);
    this._writePos = 0;

    this.port.onmessage = (e) => {
      if (e.data === 'flush') this._flush(true);
    };
  }

  _flush(markDone = false) {
    if (this._writePos > 0) {
      this.port.postMessage({
        left: this._leftBuf.slice(0, this._writePos),
        right: this._rightBuf.slice(0, this._writePos),
        flushed: markDone,
      });
      this._writePos = 0;
    } else if (markDone) {
      this.port.postMessage({ flushed: true });
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const left = input[0];
    if (!left) return true;
    const right = input[1] ?? left;

    for (let i = 0; i < left.length; i++) {
      this._leftBuf[this._writePos] = left[i];
      this._rightBuf[this._writePos] = right[i];
      this._writePos++;
      if (this._writePos >= BATCH_SIZE) this._flush(false);
    }
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
