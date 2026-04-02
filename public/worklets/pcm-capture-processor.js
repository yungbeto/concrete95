/**
 * PCM capture AudioWorkletProcessor.
 * Reads stereo input frames and posts them to the main thread as Float32Arrays.
 * Outputs silence (no writes to outputs[0]) so connecting to destination is safe.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const left = input[0] ?? new Float32Array(128);
      const right = input[1] ?? left;
      // slice() copies the buffer — the original is reused by the engine each frame
      this.port.postMessage({ left: left.slice(), right: right.slice() });
    }
    return true; // keep processor alive until explicitly disconnected
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
