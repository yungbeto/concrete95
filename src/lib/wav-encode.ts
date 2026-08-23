/**
 * Encode interleaved stereo Float32 PCM (-1..1) into a 16-bit WAV Blob.
 */
export function encodeWavBlob(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): Blob {
  const numFrames = Math.min(left.length, right.length);
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** File extension for a recorded blob MIME type. */
export function getRecordingExtension(mimeType: string): string {
  const t = mimeType.toLowerCase();
  if (t.includes('wav')) return 'wav';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('aac')) return 'm4a';
  return 'webm';
}

/** Human-readable format label for the export dialog. */
export function getRecordingFormatLabel(mimeType: string): string {
  const ext = getRecordingExtension(mimeType);
  if (ext === 'wav') return 'WAV (lossless)';
  if (ext === 'webm') return 'WebM (Opus)';
  if (ext === 'm4a') return 'M4A (AAC)';
  if (ext === 'ogg') return 'OGG (Opus)';
  return ext.toUpperCase();
}

/** Merge Float32Array chunks into a single buffer. */
export function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
