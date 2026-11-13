
'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Tone from 'tone';
import { type RNG } from '@/lib/prng';
import { encodeWavFromInt16Chunks, interleaveToInt16, pickCompressedRecordingMime } from '@/lib/wav-encode';
import { loadDecodedAudioBuffer } from '@/lib/load-audio-buffer';

export type SynthLayerInfo = {
  type: 'synth' | 'melodic';
  description: string;
};

export type AtmosphereLayerInfo = {
  type: 'atmosphere';
  description: string;
};

export type FreesoundLayerInfo = {
  type: 'freesound';
  id: number;
  name: string;
  description: string;
  previewUrl: string;
  username?: string;
};

export type GrainLayerInfo = {
  type: 'grain';
  id: number;
  name: string;
  description: string;
  previewUrl: string;
  username?: string;
};

export type DroneLayerInfo = {
  type: 'drone';
  description: string;
};

const scales = {
  random: [],
  major: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],
  naturalMinor: ['C2', 'D2', 'Eb2', 'F2', 'G2', 'Ab2', 'Bb2', 'C3', 'D3', 'Eb3', 'F3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4'],
  minorPentatonic: ['C2', 'Eb2', 'F2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4'],
  majorPentatonic: ['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
  blues: ['C2', 'Eb2', 'F2', 'F#2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3', 'F#3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'F#4', 'G4', 'Bb4'],
  chromatic: ['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'],
  dorian: ['C2', 'D2', 'Eb2', 'F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'Eb3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4'],
  mixolydian: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4'],
};

export type ScaleName = keyof typeof scales;

/** Pitch class of the locked key: 0 = C … 11 = B. null = each layer picks its own. */
export type KeyRoot = number | null;
export const KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/**
 * The scale tables are written in C, so the key is a transposition. Always
 * draw from the RNG (even when locked) so seeded sessions consume the same
 * sequence either way and the layer's other parameters don't shift.
 */
const pickTransposition = (r: () => number, keyRoot: KeyRoot | undefined) => {
  const random = Math.floor(r() * 12);
  return keyRoot == null ? random : ((keyRoot % 12) + 12) % 12;
};

export const scaleNames = Object.keys(scales) as ScaleName[];
export const delayTimeOptions = ['1n', '2n', '4n', '8n', '16n', '32n', '2t', '4t', '8t', '16t'] as const;
export type DelayTime = typeof delayTimeOptions[number];

// O2: Varied LFO waveforms — sine is organic but monotonous when every layer uses it.
// Triangle gives linear ramps (mechanical but clear), sawtooth creates ratcheting sweeps,
// and 'random' (sample-and-hold) produces irregular stepped jumps. Applied at layer-creation
// time so each layer gets a unique movement character baked in.
// 'sine' weighted 3× — it's the most organic; 'triangle', 'sawtooth', 'square' add variety
const LFO_TYPES = ['sine', 'sine', 'sine', 'triangle', 'sawtooth', 'square'] as const;
type LFOType = typeof LFO_TYPES[number];
const pickLFOType = (r: () => number): LFOType =>
  LFO_TYPES[Math.floor(r() * LFO_TYPES.length)];

/**
 * Debug A/B: when true, the master chain skips {@link Tone.MultibandCompressor} and
 * {@link Tone.EQ3} (runs limiter → gain → saturation → HPF like the older, shorter path).
 * Set to `false` to restore the full post-refactor master bus.
 */
const BYPASS_MASTER_COMP_AND_EQ = false;

const BUFFER_LOAD_TIMEOUT_MS = 45000;

const PCM_CAPTURE_WORKLET_URL = '/worklets/pcm-capture-processor.js';
/** Length of the always-on "save what just happened" buffer. ~11 MB at 48 kHz. */
export const RETRO_SECONDS = 60;

/** DOMException from standardized-audio-context is often `NotSupportedError` with an empty message. */
const describeCaughtError = (err: unknown): string => {
  if (err instanceof Error) {
    const label = err.name && err.name !== 'Error' ? err.name : '';
    const message = err.message.trim();
    if (label && message) return `${label}: ${message}`;
    return message || label || String(err);
  }
  return String(err);
};

/**
 * Tone.loaded() waits on a shared FIFO queue of every buffer download in the app,
 * not just this one — a single slow/stuck fetch elsewhere can block unrelated layers
 * indefinitely. Race an individual load promise against a hard timeout instead.
 */
const withLoadTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${BUFFER_LOAD_TIMEOUT_MS / 1000}s`)),
      BUFFER_LOAD_TIMEOUT_MS,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
};

type GrainScatterState = {
  intervalId: ReturnType<typeof setInterval> | null;
  drift: number;
  grainSize: number;
  playbackRate: number;
  rng: () => number;
  /** Spectral freeze: scan position pinned here (seconds); null = scanning. */
  frozenAt?: number | null;
};

/**
 * Freeze. GrainPlayer can't hold a point: slowing its rate only lengthens
 * grains (grain = grainSize / rate), and its clock fires the first grain at the
 * next whole-grain tick, so rapid restart()s mostly produce nothing. While
 * frozen the voices stop scanning and we schedule our own grains at the held
 * point, slightly ahead on the audio clock, into each voice's output (so its
 * volume / mute still apply). Grains overlap 50% with equal fades.
 */
const FREEZE_JITTER_SEC = 0.02;
const FREEZE_MIN_HOP_SEC = 0.03; // ≤ ~33 grains/s per voice
const FREEZE_LOOKAHEAD_SEC = 0.12;
const FREEZE_SCHEDULER_MS = 40;

const scheduleFrozenGrain = (voice: Tone.GrainPlayer, time: number, offset: number, length: number) => {
  const buffer = voice.buffer;
  if (!buffer?.loaded) return;
  const source = new Tone.ToneBufferSource({
    url: buffer,
    fadeIn: length / 2,
    fadeOut: length / 2,
    playbackRate: Tone.intervalToFrequencyRatio(voice.detune / 100),
  }).connect(voice.output as any);
  source.onended = () => source.dispose();
  source.start(time, offset);
  source.stop(time + length);
};

const GRAIN_VOICE_COUNT = 3;
const GRAIN_VOICE_GAIN_COMPENSATION_DB = 20 * Math.log10(GRAIN_VOICE_COUNT);

const wrapSeconds = (seconds: number, duration: number) => {
  if (duration <= 0) return 0;
  return ((seconds % duration) + duration) % duration;
};

const getGrainVoices = (player: Tone.GrainPlayer): Tone.GrainPlayer[] => {
  const voices = (player as any).grainVoices as Tone.GrainPlayer[] | undefined;
  return voices?.length ? voices : [player];
};

/** Default smoothing for user-facing level changes — long enough to avoid zipper noise and clicks. */
const PARAM_RAMP_SECONDS = 0.05;
/** -∞ dB can't be ramped toward; this is inaudible and keeps the ramp math finite. */
const SILENT_DB = -100;

/**
 * Glide a param from wherever it is right now. cancelAndHold (rather than
 * assigning .value) also supersedes in-flight ramps, e.g. the drone fade-in,
 * which would otherwise overwrite a user change when it completes.
 * Linear on purpose: Tone's rampTo is exponential for decibels, which
 * misbehaves around silence.
 */
const glideParam = (param: Tone.Param<any> | Tone.Signal<any>, value: number, seconds = PARAM_RAMP_SECONDS) => {
  const now = Tone.now();
  param.cancelAndHoldAtTime(now);
  param.linearRampToValueAtTime(value, now + seconds);
};

const glideDb = (param: Tone.Param<'decibels'>, db: number, seconds = PARAM_RAMP_SECONDS) =>
  glideParam(param, Number.isFinite(db) ? db : SILENT_DB, seconds);

const setGrainVoiceVolumes = (player: Tone.GrainPlayer, volume: number, seconds = PARAM_RAMP_SECONDS) => {
  getGrainVoices(player).forEach((voice) => {
    if (!voice.disposed) {
      glideDb(voice.volume, volume - GRAIN_VOICE_GAIN_COMPENSATION_DB, seconds);
    }
  });
};

const stopGrainScatter = (player: Tone.GrainPlayer) => {
  const scatter = (player as any).grainScatter as GrainScatterState | undefined;
  if (scatter?.intervalId) {
    clearInterval(scatter.intervalId);
    scatter.intervalId = null;
  }
};

const startGrainScatter = (player: Tone.GrainPlayer) => {
  stopGrainScatter(player);

  const scatter = (player as any).grainScatter as GrainScatterState | undefined;
  if (!scatter) return;
  const frozen = scatter.frozenAt != null;
  if (!frozen && scatter.drift <= 0) return;

  let voiceIndex = 0;
  if (frozen) {
    const length = Math.max(FREEZE_MIN_HOP_SEC * 2, scatter.grainSize);
    const hop = length / 2;
    let nextTime = Tone.now() + 0.02;
    scatter.intervalId = setInterval(() => {
      const voices = getGrainVoices(player).filter((voice) => !voice.disposed);
      if (!voices.length || player.disposed || scatter.frozenAt == null) {
        stopGrainScatter(player);
        return;
      }
      const now = Tone.now();
      if (nextTime < now) nextTime = now + 0.01; // tab was throttled; don't burst-catch-up
      while (nextTime < now + FREEZE_LOOKAHEAD_SEC) {
        voices.forEach((voice, i) => {
          const duration = voice.buffer?.duration ?? 0;
          if (!duration) return;
          const offset = wrapSeconds(scatter.frozenAt! + (scatter.rng() - 0.5) * 2 * FREEZE_JITTER_SEC, duration);
          scheduleFrozenGrain(voice, nextTime + (i * hop) / voices.length, offset, length);
        });
        nextTime += hop;
      }
    }, FREEZE_SCHEDULER_MS);
    return;
  }

  const intervalMs = Math.max(140, Math.min(520, scatter.grainSize * 1400));
  scatter.intervalId = setInterval(() => {
    const voices = getGrainVoices(player).filter((voice) => !voice.disposed);
    if (!voices.length || player.disposed) {
      stopGrainScatter(player);
      return;
    }

    const voice = voices[voiceIndex % voices.length];
    voiceIndex += 1;

    const duration = voice.buffer?.duration ?? 0;
    if (!duration) return;

    const startedAt = (voice as any).grainStartedAt as number | undefined;
    const startOffset = (voice as any).grainStartOffset as number | undefined;
    const rateRatio = ((voice as any).grainRateRatio as number | undefined) ?? 1;
    const elapsed = startedAt == null ? 0 : (Tone.now() - startedAt) * scatter.playbackRate * rateRatio;
    const center = wrapSeconds((startOffset ?? 0) + elapsed, duration);
    const offset = wrapSeconds(center + (scatter.rng() - 0.5) * 2 * scatter.drift, duration);

    voice.restart(Tone.now(), offset);
    (voice as any).grainStartedAt = Tone.now();
    (voice as any).grainStartOffset = offset;
  }, intervalMs);
};

/**
 * Move a grain layer's scan position. Restarts every voice (not just the
 * primary) around the new offset and updates the bookkeeping the scatter
 * interval reads, otherwise the next scatter tick snaps voices back.
 */
export const seekGrainPlayer = (player: Tone.GrainPlayer, offsetSec: number) => {
  if (player.disposed) return;
  const scatter = (player as any).grainScatter as GrainScatterState | undefined;
  if (scatter?.frozenAt != null) scatter.frozenAt = offsetSec;
  const drift = scatter?.frozenAt != null ? FREEZE_JITTER_SEC : scatter?.drift ?? 0;
  const rng = scatter?.rng ?? Math.random;
  const now = Tone.now();
  getGrainVoices(player).forEach((voice, i) => {
    if (voice.disposed) return;
    const duration = voice.buffer?.duration ?? 0;
    if (!duration) return;
    const spread = i === 0 ? 0 : (rng() - 0.5) * 2 * drift;
    const offset = wrapSeconds(offsetSec + spread, duration);
    voice.restart(now, offset);
    (voice as any).grainStartedAt = now;
    (voice as any).grainStartOffset = offset;
  });
};

export type AudioEngineHandle = {
  initialize: () => void;
  /** `keyRoot` 0–11 (C…B) locks the layer's key; null/undefined = random key per layer. */
  startSynthLoop: (scale?: ScaleName, discreetMode?: boolean, keyRoot?: KeyRoot) => {
    sequence: Tone.Sequence;
    info: SynthLayerInfo;
    filterCutoff: number;
    filterResonance: number;
  } | null;
  stopSynthLoop: (synth: Tone.Sequence) => void;
  startFreesoundLoop: (
    sound: { id: number; name: string; previewUrl: string; username?: string }
  ) => Promise<{ player: Tone.Player; info: FreesoundLayerInfo; filterCutoff: number; filterResonance: number } | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
  startGrainLoop: (
    sound: { id: number; name: string; previewUrl: string; username?: string }
  ) => Promise<{ player: Tone.GrainPlayer; info: GrainLayerInfo; filterCutoff: number; filterResonance: number; grainSize: number; grainDrift: number; playbackRate: number } | null>;
  stopGrainLoop: (player: Tone.GrainPlayer) => void;
  setGrainSize: (player: Tone.GrainPlayer, size: number) => void;
  setGrainDrift: (player: Tone.GrainPlayer, drift: number) => void;
  /** Spectral freeze: hold the grain cloud on its current scan position, or release it. */
  setGrainFreeze: (player: Tone.GrainPlayer, frozen: boolean) => void;
  startMelodicLoop: (scale?: ScaleName, discreetMode?: boolean, keyRoot?: KeyRoot) => {
    sequence: Tone.Sequence;
    info: SynthLayerInfo;
    filterCutoff: number;
    filterResonance: number;
  } | null;
  stopMelodicLoop: (sequence: Tone.Sequence) => void;
  /** `rampSeconds` defaults to a short anti-zipper glide; pass longer for fades. */
  setVolume: (node: Tone.Player | Tone.GrainPlayer | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence | Tone.Noise | Tone.Gain, volume: number, rampSeconds?: number) => void;
  setSendAmount: (node: Tone.Player | Tone.GrainPlayer | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence | Tone.Noise | Tone.Gain, amount: number) => void;
  setPlaybackRate: (node: Tone.Player | Tone.GrainPlayer, rate: number) => void;
  setReverse: (node: Tone.Player | Tone.GrainPlayer, reverse: boolean) => void;
  setLayerFilterCutoff: (node: Tone.Player | Tone.GrainPlayer | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence | Tone.Noise | Tone.Gain, freq: number) => void;
  setLayerFilterResonance: (node: Tone.Player | Tone.GrainPlayer | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence | Tone.Noise | Tone.Gain, q: number) => void;
  setProbability: (node: Tone.Sequence, probability: number) => void;
  setLayerDrift: (node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | Tone.Gain, enabled: boolean, periodMinutes: number) => void;
  setWarmth: (value: number) => void;
  setShimmer: (value: number) => void;
  setFreqShift: (value: number) => void;
  setConvolverMix: (value: number) => void;
  setBreatheEnabled: (enabled: boolean, periodMinutes: number) => void;
  setDelayFeedback: (value: number) => void;
  setDelayTime: (value: DelayTime) => void;
  setDelayCutoff: (value: number) => void;
  setReverbDecay: (value: number) => void;
  setReverbWet: (value: number) => void;
  setBPM: (bpm: number) => void;
  getBPM: () => number;
  disposeAll: () => void;
  getWaveform: (node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | Tone.Gain) => Float32Array | null;
  startAtmosphereLoop: () => { node: Tone.Noise; info: AtmosphereLayerInfo; filterCutoff: number; filterResonance: number } | null;
  stopAtmosphereLoop: (noise: Tone.Noise) => void;
  setLofi: (amount: number) => void;
  setWarble: (amount: number) => void;
  /** `scale` lets the drone avoid a major 3rd (partial 5) against minor modes. */
  startDroneLoop: (keyRoot?: KeyRoot, scale?: ScaleName) => { node: Tone.Gain; info: DroneLayerInfo } | null;
  stopDroneLoop: (node: Tone.Gain) => void;
  getMasterLevel: () => number;
  getLissajousData: () => { left: Float32Array; right: Float32Array } | null;
  getVisualizerData: () => { frequency: Uint8Array; waveform: Float32Array } | null;
  /** Start the always-on capture tap (feeds the rolling buffer). Idempotent. */
  startCapture: () => Promise<void>;
  /** Seconds currently held in the rolling buffer (≤ RETRO_SECONDS). */
  getRetroSeconds: () => number;
  /** WAV of the most recent `seconds` of master output. */
  captureLastSeconds: (seconds?: number) => Promise<Blob>;
  startRecording: () => Promise<void>;
  /** WAV always; `compressed` (Opus/AAC) when MediaRecorder supports it. */
  stopRecording: () => Promise<{ wav: Blob; compressed: Blob | null }>;
  setMasterMute: (muted: boolean) => void;
  /**
   * Lock-screen / background playback (beta): route the final output through an
   * <audio> element (MediaStreamDestination) instead of straight to the speakers,
   * so mobile OSes treat the page as a media player. Resolves false if the
   * element refused to play (direct output is left in place).
   */
  setBackgroundPlayback: (on: boolean) => Promise<boolean>;
  /** Pause/resume everything (Media Session play/pause). */
  setOutputPaused: (paused: boolean) => Promise<void>;
  setRng: (rng: RNG | null) => void;
  /** Short sine into the real master bus (same path as layers). For debugging only. */
  debugPlayThroughMasterChain: () => void;
  /** Debug only: RMS dB at the output of each master-chain stage (NaN = poisoned). */
  getMasterStageLevels: () => { stage: string; db: number }[];
};

const AudioEngine = forwardRef<AudioEngineHandle, { isMobile?: boolean }>((props, ref) => {
  /** Summing bus for layers + FX returns (plain Gain — Tone Limiter mis-routed with multiple inputs). */
  const masterBus = useRef<Tone.Gain | null>(null);
  const masterGain = useRef<Tone.Gain | null>(null);
  const masterBreatheLFO = useRef<Tone.LFO | null>(null);
  const masterSaturation = useRef<Tone.Distortion | null>(null);
  const masterHPF = useRef<Tone.Filter | null>(null);
  const masterMeter = useRef<Tone.Meter | null>(null);
  /** Debug taps after each master stage — created lazily by getMasterStageLevels. */
  const masterStageTaps = useRef<{ owner: Tone.Gain; taps: { stage: string; analyser: AnalyserNode; buf: Float32Array }[] } | null>(null);
  /** Master tap for PCM capture via AudioWorklet → WAV export. */
  /**
   * Always-on once started: feeds the rolling "last N seconds" buffer and, while
   * recording, the recording itself. Chunks are interleaved Int16 (half the
   * memory of Float32, and the WAV Blob references them without a copy).
   */
  const pcmCaptureNode = useRef<AudioWorkletNode | null>(null);
  const pcmCaptureStarting = useRef<Promise<AudioWorkletNode> | null>(null);
  const pcmSampleRate = useRef(44100);
  const pcmWorkletLoaded = useRef(false);
  const recordChunks = useRef<Int16Array[] | null>(null); // null = not recording
  const retroChunks = useRef<{ chunks: Int16Array[]; frames: number }>({ chunks: [], frames: 0 });
  /** Optional compressed recording alongside the WAV (MediaRecorder on the master). */
  const backgroundOut = useRef<{ dest: MediaStreamAudioDestinationNode; audio: HTMLAudioElement } | null>(null);
  /** In-flight enable — concurrent gestures must not build two elements (double output). */
  const backgroundStarting = useRef<Promise<boolean> | null>(null);
  const compressedRec = useRef<{ recorder: MediaRecorder; dest: MediaStreamAudioDestinationNode; parts: Blob[] } | null>(null);
  const lissajousSplitter = useRef<ChannelSplitterNode | null>(null);
  const lissajousAnalyserL = useRef<AnalyserNode | null>(null);
  const lissajousAnalyserR = useRef<AnalyserNode | null>(null);
  const lissajousBufferL = useRef<Float32Array | null>(null);
  const lissajousBufferR = useRef<Float32Array | null>(null);
  const vizAnalyser = useRef<AnalyserNode | null>(null);
  const vizFrequencyBuffer = useRef<Uint8Array | null>(null);
  const vizWaveformBuffer = useRef<Float32Array | null>(null);
  const masterCompressor = useRef<Tone.MultibandCompressor | null>(null);
  const masterEQ = useRef<Tone.EQ3 | null>(null);
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const masterMidSide = useRef<Tone.MidSideCompressor | null>(null);
  const masterFollower = useRef<Tone.Follower | null>(null);
  const masterFollowerScale = useRef<Tone.Scale | null>(null);
  const masterBitcrusher = useRef<Tone.BitCrusher | null>(null);
  const masterWarble = useRef<Tone.Chorus | null>(null);
  const fxBus = useRef<{
    fxInput: Tone.Gain;
    fxEQ: Tone.EQ3;
    delay: Tone.PingPongDelay;
    delayFilter: Tone.Filter;
    reverb: Tone.Reverb;
    shimmerPitchShift: Tone.PitchShift;
    shimmerGain: Tone.Gain;
    freqShiftGain: Tone.Gain;
    freqShifter: Tone.FrequencyShifter;
    convolver: Tone.Convolver;
    crossFade: Tone.CrossFade;
  } | null>(null);

  /** Which optional FX-bus branches currently receive signal from fxEQ. */
  const fxBranchFed = useRef({ shimmer: false, freqShift: false, convolver: false });
  /** Master Lo-fi / Warble stages are spliced out of the chain while at 0. */
  const masterTailState = useRef({ lofi: false, warble: false });

  /**
   * Connect/disconnect an FX-bus branch input. Disconnecting (rather than just
   * zeroing a gain) lets the browser stop processing the node once its tail
   * has rung out — the input stays "active" as long as anything feeds it.
   */
  const feedFxBranch = (branch: 'shimmer' | 'freqShift' | 'convolver', on: boolean) => {
    const bus = fxBus.current;
    if (!bus || fxBranchFed.current[branch] === on) return;
    const target =
      branch === 'shimmer' ? bus.shimmerPitchShift
      : branch === 'freqShift' ? bus.freqShiftGain
      : bus.convolver;
    if (on) bus.fxEQ.connect(target);
    else bus.fxEQ.disconnect(target);
    fxBranchFed.current[branch] = on;
  };

  /** Rewire saturation → [bitcrusher] → [warble] → HPF, skipping stages that are off. */
  const rewireMasterTail = (next: { lofi: boolean; warble: boolean }) => {
    const sat = masterSaturation.current;
    const crush = masterBitcrusher.current;
    const warble = masterWarble.current;
    const hpf = masterHPF.current;
    if (!sat || !crush || !warble || !hpf) return;
    const path = (st: { lofi: boolean; warble: boolean }) => [
      sat,
      ...(st.lofi ? [crush] : []),
      ...(st.warble ? [warble] : []),
      hpf,
    ];
    const prev = path(masterTailState.current);
    const upcoming = path(next);
    // Connect the new path before tearing down the old one so there's no gap.
    for (let i = 0; i < upcoming.length - 1; i++) upcoming[i].connect(upcoming[i + 1]);
    for (let i = 0; i < prev.length - 1; i++) {
      const stillUsed = upcoming.some((n, j) => n === prev[i] && upcoming[j + 1] === prev[i + 1]);
      if (!stillUsed) prev[i].disconnect(prev[i + 1]);
    }
    masterTailState.current = { ...next };
  };

  const tailSpliceOutTimers = useRef<{ lofi?: ReturnType<typeof setTimeout>; warble?: ReturnType<typeof setTimeout> }>({});
  /**
   * Set a spliceable master stage's wet amount without clicks: splice in at
   * wet 0 then glide up; when going to 0, glide down first and splice out
   * once the stage is fully dry (so removing it from the path is silent).
   */
  const setMasterTailStage = (
    stage: 'lofi' | 'warble',
    wetParam: Tone.Signal<'normalRange'>,
    wet: number,
  ) => {
    clearTimeout(tailSpliceOutTimers.current[stage]);
    if (wet > 0) {
      if (!masterTailState.current[stage]) {
        wetParam.cancelScheduledValues(Tone.now());
        wetParam.value = 0;
        rewireMasterTail({ ...masterTailState.current, [stage]: true });
      }
      glideParam(wetParam, wet);
      return;
    }
    glideParam(wetParam, 0);
    if (masterTailState.current[stage]) {
      tailSpliceOutTimers.current[stage] = setTimeout(() => {
        rewireMasterTail({ ...masterTailState.current, [stage]: false });
      }, PARAM_RAMP_SECONDS * 1000 + 30);
    }
  };

  /**
   * One long reverb shared by every melodic layer (created on first use). A
   * per-layer Tone.Reverb is a 5–11s stereo convolver each — several of them
   * overloaded the audio thread (output dropouts, then a frozen tab).
   */
  const melodicReverb = useRef<Tone.Reverb | null>(null);
  const isInitialized = useRef(false);
  const rngRef = useRef<RNG | null>(null);

  const initializeAudio = () => {
    if (typeof window !== 'undefined' && !isInitialized.current) { try {
        // Master chain: all signals → gain bus → gain (breathe) → [optional MB comp + EQ3] → saturation → HPF → limiter → destination
        // When BYPASS_MASTER_COMP_AND_EQ, comp + EQ are omitted (nodes still exist for disposal).
        // masterGain is the Breathe automation point — only attenuates (0.7–1.0),
        // never amplifies, so it's safe after the bus.
        masterBus.current = new Tone.Gain(1);
        masterGain.current = new Tone.Gain(1);
        masterCompressor.current = new Tone.MultibandCompressor({
          lowFrequency: 300,
          highFrequency: 5000,
          low: { threshold: -30, ratio: 2, attack: 0.1, release: 0.4, knee: 6 },
          mid: { threshold: -24, ratio: 3, attack: 0.08, release: 0.4, knee: 6 },
          high: { threshold: -20, ratio: 6, attack: 0.05, release: 0.3, knee: 3 },
        });
        masterEQ.current = new Tone.EQ3({ low: 0, mid: 0, high: -2, highFrequency: 6000 });
        masterSaturation.current = new Tone.Distortion({ distortion: 0.08, wet: 0.02 });
        masterBitcrusher.current = new Tone.BitCrusher(16);
        masterBitcrusher.current.wet.value = 0;
        masterWarble.current = new Tone.Chorus({ frequency: 0.3, delayTime: 3, depth: 0.4, spread: 180, wet: 0 }).start();
        // Safety limiter to catch occasional summed transients from many active layers/effects.
        // Kept near 0 dB for transparent protection instead of obvious pumping.
        masterLimiter.current = new Tone.Limiter(-1.2).toDestination();
        // Keep destination routing on the final limiter node; intermediate nodes stay in-graph.
        masterHPF.current = new Tone.Filter(40, 'highpass');
        masterTailState.current = { lofi: false, warble: false };
        if (BYPASS_MASTER_COMP_AND_EQ) {
          masterBus.current.chain(
            masterGain.current,
            masterSaturation.current,
            masterHPF.current,
            masterLimiter.current,
          );
        } else {
          masterBus.current.chain(
            masterGain.current,
            masterCompressor.current,
            masterEQ.current,
            masterSaturation.current,
            // Bitcrusher + warble (both wet 0 by default) are spliced in by
            // rewireMasterTail when Lo-fi / Warble are turned up.
            masterHPF.current,
            masterLimiter.current,
          );
        }


        // Meter tapped in parallel off masterGain — reads the breathe-modulated
        // level without affecting the signal path
        masterMeter.current = new Tone.Meter({ normalRange: false });
        masterGain.current.connect(masterMeter.current);

        // Stereo Lissajous analysers — also tapped off masterGain in parallel.
        // ChannelSplitter splits the stereo signal so we can read L and R independently.
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        lissajousSplitter.current = rawCtx.createChannelSplitter(2);
        lissajousAnalyserL.current = rawCtx.createAnalyser();
        lissajousAnalyserL.current.fftSize = 1024;
        lissajousAnalyserR.current = rawCtx.createAnalyser();
        lissajousAnalyserR.current.fftSize = 1024;
        masterGain.current.connect(lissajousSplitter.current as any);
        lissajousSplitter.current.connect(lissajousAnalyserL.current, 0);
        lissajousSplitter.current.connect(lissajousAnalyserR.current, 1);
        lissajousBufferL.current = new Float32Array(1024);
        lissajousBufferR.current = new Float32Array(1024);

        // Visualizer analyser — tapped off masterGain for FFT + waveform data.
        vizAnalyser.current = rawCtx.createAnalyser();
        vizAnalyser.current.fftSize = 2048;
        vizAnalyser.current.smoothingTimeConstant = 0.8;
        masterGain.current.connect(vizAnalyser.current as any);
        vizFrequencyBuffer.current = new Uint8Array(vizAnalyser.current.frequencyBinCount);
        vizWaveformBuffer.current = new Float32Array(vizAnalyser.current.fftSize);

        Tone.Transport.bpm.value = Math.floor(Math.random() * (100 - 60 + 1)) + 60;

        // Parallel FX bus: fxInput splits to delay and reverb independently.
        // Previously delay fed into reverb (series), which made them inseparable
        // and caused the delay tails to get smeared by the reverb.
        const fxInput = new Tone.Gain(1);

        // Pre-send high shelf EQ — rolls off highs before the reverb/delay to prevent
        // harshness accumulating in the wet signal.
        const fxEQ = new Tone.EQ3({ low: 0, mid: 0, high: -4, highFrequency: 5000 });
        fxInput.connect(fxEQ);

        // Default maxDelay is 1s; note values at low BPM (e.g. 2n @ 60 BPM) exceed that
        // and Chrome warns when delayTime is clamped. Use a generous max for tempo + divisions.
        const delay = new Tone.PingPongDelay({
            delayTime: '4n',
            feedback: 0.4,
            maxDelay: 8,
        });
        delay.wet.value = 0.5;

        // Hi-cut on delay only — warm tape-echo character, starts at a useable value
        const delayFilter = new Tone.Filter(5000, 'lowpass');

        const reverb = new Tone.Reverb({
            decay: 10,
            preDelay: 0.08,
            wet: 0.7,
        });

        // Shimmer: pitch-shifted (+1 octave) copy of the send bus fed into the reverb.
        // The reverb then diffuses both the dry and octave-up signal together,
        // creating a gradually ascending, crystalline halo around sounds.
        // shimmerGain starts at 0 (off) — user controls via Shimmer slider.
        const shimmerPitchShift = new Tone.PitchShift(12);
        const shimmerGain = new Tone.Gain(0);
        // fxEQ → shimmerPitchShift is connected lazily by setShimmer (CPU: idle at 0).
        shimmerPitchShift.connect(shimmerGain);
        shimmerGain.connect(reverb);

        fxEQ.connect(delay);
        delay.chain(delayFilter, masterBus.current);

        fxEQ.connect(reverb);

        // FrequencyShifter: subtle inharmonic beating distinct from octave shimmer.
        // freqShiftGain starts at 0 (off) — user controls via Frequency Drift slider.
        const freqShiftGain = new Tone.Gain(0);
        const freqShifter = new Tone.FrequencyShifter({ frequency: 2, wet: 1 });
        // fxEQ → freqShiftGain is connected lazily by setFreqShift.
        freqShiftGain.connect(freqShifter);
        freqShifter.connect(reverb);

        // F3 + F4: Convolver (synthetic plate IR) + CrossFade between algorithmic reverb
        // and convolver. Default: crossFade.fade = 0 (all algorithmic, as before).
        // User controls mix via "Space" slider — crossfade to the convolver's IR character.
        const convolver = new Tone.Convolver();
        const irCtx = Tone.getContext().rawContext as AudioContext;
        const irSampleRate = irCtx.sampleRate;
        const irLength = Math.floor(irSampleRate * 3.5); // 3.5s synthetic plate IR
        const irBuffer = irCtx.createBuffer(2, irLength, irSampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = irBuffer.getChannelData(ch);
          for (let i = 0; i < irLength; i++) {
            // Exponential noise decay — simulates a diffuse plate reverb tail
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 1.8);
          }
        }
        convolver.buffer = new Tone.ToneAudioBuffer(irBuffer);
        // fxEQ → convolver is connected lazily by setConvolverMix: a 3.5s stereo
        // convolution costs CPU every block while fed, even when crossFaded out.

        const crossFade = new Tone.CrossFade(0); // 0 = algorithmic reverb, 1 = convolver
        reverb.connect(crossFade.a);
        convolver.connect(crossFade.b);
        crossFade.connect(masterBus.current);

        fxBus.current = { fxInput, fxEQ, delay, delayFilter, reverb, shimmerPitchShift, shimmerGain, freqShiftGain, freqShifter, convolver, crossFade };
        fxBranchFed.current = { shimmer: false, freqShift: false, convolver: false };
        // Export flow mutes Tone.Destination; new graph must always be audible.
        Tone.getDestination().volume.value = 0;
        isInitialized.current = true;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[C95-audio] initializeAudio failed:', err);
    } }
  }

  // Desktop auto-init. useIsMobile() is undefined on first render, so wait for an
  // explicit false; initializeAudio() is idempotent, so later isMobile changes
  // (e.g. resizing across the breakpoint) never rebuild the graph.
  useEffect(() => {
    if (props.isMobile === false) {
        initializeAudio();
    }
  }, [props.isMobile]);

  // Teardown on unmount only — tearing down on isMobile changes orphaned live layers
  // on the disposed master bus.
  useEffect(() => {
    return () => {
        if (isInitialized.current) {
            masterBreatheLFO.current?.stop().dispose();
            masterBreatheLFO.current = null;
            melodicReverb.current?.dispose();
            melodicReverb.current = null;
            masterBitcrusher.current?.dispose();
            masterBitcrusher.current = null;
            masterWarble.current?.stop().dispose();
            masterWarble.current = null;
            masterMeter.current?.dispose();
            masterMeter.current = null;
            lissajousAnalyserL.current?.disconnect();
            lissajousAnalyserR.current?.disconnect();
            lissajousSplitter.current?.disconnect();
            lissajousAnalyserL.current = null;
            lissajousAnalyserR.current = null;
            lissajousSplitter.current = null;
            lissajousBufferL.current = null;
            lissajousBufferR.current = null;
            vizAnalyser.current?.disconnect();
            vizAnalyser.current = null;
            vizFrequencyBuffer.current = null;
            vizWaveformBuffer.current = null;
            if (pcmCaptureNode.current && masterLimiter.current) {
              try {
                masterLimiter.current.disconnect(pcmCaptureNode.current as any);
              } catch {
                /* ignore */
              }
              try {
                pcmCaptureNode.current.port.onmessage = null;
                pcmCaptureNode.current.disconnect();
              } catch {
                /* ignore */
              }
            }
            pcmCaptureNode.current = null;
            recordChunks.current = null;
            retroChunks.current = { chunks: [], frames: 0 };
            if (compressedRec.current?.recorder.state === 'recording') compressedRec.current.recorder.stop();
            compressedRec.current = null;
            teardownBackgroundOut();
            masterBus.current?.dispose();
            masterGain.current?.dispose();
            masterCompressor.current?.dispose();
            masterCompressor.current = null;
            masterEQ.current?.dispose();
            masterEQ.current = null;
            masterLimiter.current?.dispose();
            masterLimiter.current = null;
            masterMidSide.current?.dispose();
            masterMidSide.current = null;
            masterFollower.current?.dispose();
            masterFollower.current = null;
            masterFollowerScale.current?.dispose();
            masterFollowerScale.current = null;
            masterSaturation.current?.dispose();
            masterHPF.current?.dispose();
            fxBus.current?.freqShiftGain.dispose();
            fxBus.current?.freqShifter.dispose();
            fxBus.current?.shimmerPitchShift.dispose();
            fxBus.current?.shimmerGain.dispose();
            fxBus.current?.fxEQ.dispose();
            fxBus.current?.fxInput.dispose();
            fxBus.current?.delay.dispose();
            fxBus.current?.delayFilter.dispose();
            fxBus.current?.reverb.dispose();
            fxBus.current?.convolver.dispose();
            fxBus.current?.crossFade.dispose();
            masterBus.current = null;
            masterGain.current = null;
            masterSaturation.current = null;
            masterHPF.current = null;
            fxBus.current = null;
            isInitialized.current = false;
        }
    };
  }, []);

  /** Route a capture batch: always into the rolling buffer, plus the recording if active. */
  const onCaptureBatch = (left: Float32Array, right: Float32Array) => {
    const block = interleaveToInt16(left, right);
    recordChunks.current?.push(block);
    const retro = retroChunks.current;
    retro.chunks.push(block);
    retro.frames += block.length / 2;
    const maxFrames = RETRO_SECONDS * pcmSampleRate.current;
    while (retro.chunks.length > 1 && retro.frames - retro.chunks[0].length / 2 >= maxFrames) {
      retro.frames -= retro.chunks.shift()!.length / 2;
    }
  };

  /** Load the worklet and connect the capture tap once; later calls reuse it. */
  const ensureCapture = async (): Promise<AudioWorkletNode> => {
    if (pcmCaptureNode.current) return pcmCaptureNode.current;
    if (pcmCaptureStarting.current) return pcmCaptureStarting.current;
    const limiter = masterLimiter.current;
    if (!limiter) throw new Error('Audio engine not ready.');
    const toneCtx = Tone.getContext();
    // Tone.Context.addAudioWorkletModule only loads the first URL (Tone.BitCrusher
    // already claimed it at init). Load ours on the raw context instead.
    // https://github.com/Tonejs/Tone.js/issues/1326
    const rawCtx = toneCtx.rawContext as AudioContext;
    if (!rawCtx.audioWorklet) {
      throw new Error('Recording needs AudioWorklet support — not available in this browser.');
    }
    pcmCaptureStarting.current = (async () => {
      if (!pcmWorkletLoaded.current) {
        await rawCtx.audioWorklet.addModule(PCM_CAPTURE_WORKLET_URL);
        pcmWorkletLoaded.current = true;
      }
      pcmSampleRate.current = toneCtx.sampleRate;
      const node = toneCtx.createAudioWorkletNode('pcm-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      node.port.onmessage = (e: MessageEvent) => {
        const data = e.data as { left?: Float32Array; right?: Float32Array; flushed?: boolean };
        if (data.left && data.right) onCaptureBatch(data.left, data.right);
        if (data.flushed) flushWaiters.current.splice(0).forEach((fn) => fn());
      };
      limiter.connect(node as any);
      // Worklet outputs silence; connecting to the destination keeps it pulled.
      Tone.connect(node, Tone.getDestination());
      pcmCaptureNode.current = node;
      return node;
    })();
    try {
      return await pcmCaptureStarting.current;
    } finally {
      pcmCaptureStarting.current = null;
    }
  };

  /** Destination's final Gain (post master volume / mute / sleep fade). */
  const destinationOut = () => (Tone.getDestination() as unknown as { output: Tone.Gain }).output;

  const teardownBackgroundOut = () => {
    const bg = backgroundOut.current;
    if (!bg) return;
    backgroundOut.current = null;
    const raw = Tone.getContext().rawContext as AudioContext;
    const out = destinationOut();
    // Restore the direct path first so there's no gap.
    try { out.connect(raw.destination as any); } catch { /* ignore */ }
    try { out.disconnect(bg.dest as any); } catch { /* ignore */ }
    bg.audio.pause();
    bg.audio.srcObject = null;
  };

  const startBackgroundOut = async (): Promise<boolean> => {
    const raw = Tone.getContext().rawContext as AudioContext;
    if (typeof raw.createMediaStreamDestination !== 'function') return false;
    const dest = raw.createMediaStreamDestination();
    const audio = new Audio();
    audio.setAttribute('playsinline', '');
    audio.srcObject = dest.stream;
    const out = destinationOut();
    out.connect(dest as any);
    try {
      await audio.play();
    } catch {
      try { out.disconnect(dest as any); } catch { /* ignore */ }
      return false;
    }
    // Element is playing — now drop the direct path so nothing plays twice.
    try { out.disconnect(raw.destination as any); } catch { /* ignore */ }
    backgroundOut.current = { dest, audio };
    return true;
  };

  const flushWaiters = useRef<(() => void)[]>([]);
  /** Ask the worklet for its partial batch; resolves once it has been delivered. */
  const flushCapture = (node: AudioWorkletNode) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 500); // never hang the UI on a stalled context
      flushWaiters.current.push(() => { clearTimeout(timer); resolve(); });
      node.port.postMessage('flush');
    });

  useImperativeHandle(ref, () => ({
    initialize: () => {
        initializeAudio();
        // If the graph was already built (e.g. desktop mount), initializeAudio() is a no-op
        // but the destination may still be at -∞ from a prior export-mute or hot reload.
        Tone.getDestination().volume.value = 0;
    },
    disposeAll: () => {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    },
    getMasterLevel: () => {
      if (!masterMeter.current || masterMeter.current.disposed) return -Infinity;
      const val = masterMeter.current.getValue();
      return typeof val === 'number' ? val : -Infinity;
    },
    getMasterStageLevels: () => {
      if (!masterGain.current || masterGain.current.disposed) return [];
      if (masterStageTaps.current?.owner !== masterGain.current) {
        const raw = Tone.getContext().rawContext as AudioContext;
        const stages: [string, Tone.ToneAudioNode | null][] = [
          ['gain', masterGain.current],
          ['comp', BYPASS_MASTER_COMP_AND_EQ ? null : masterCompressor.current],
          ['eq', BYPASS_MASTER_COMP_AND_EQ ? null : masterEQ.current],
          ['sat', masterSaturation.current],
          ['crush', masterBitcrusher.current],
          ['warble', masterWarble.current],
          ['hpf', masterHPF.current],
          ['limiter', masterLimiter.current],
        ];
        const taps = stages
          .filter((entry): entry is [string, Tone.ToneAudioNode] => !!entry[1] && !entry[1].disposed)
          .map(([stage, node]) => {
            const analyser = raw.createAnalyser();
            analyser.fftSize = 2048;
            node.connect(analyser as any);
            return { stage, analyser, buf: new Float32Array(analyser.fftSize) };
          });
        masterStageTaps.current = { owner: masterGain.current, taps };
      }
      return masterStageTaps.current!.taps.map(({ stage, analyser, buf }) => {
        analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        return { stage, db: Number.isNaN(rms) ? NaN : 20 * Math.log10(rms) };
      });
    },
    getLissajousData: () => {
      if (!lissajousAnalyserL.current || !lissajousAnalyserR.current) return null;
      lissajousAnalyserL.current.getFloatTimeDomainData(lissajousBufferL.current!);
      lissajousAnalyserR.current.getFloatTimeDomainData(lissajousBufferR.current!);
      return { left: lissajousBufferL.current!, right: lissajousBufferR.current! };
    },
    getVisualizerData: () => {
      if (!vizAnalyser.current || !vizFrequencyBuffer.current || !vizWaveformBuffer.current) return null;
      vizAnalyser.current.getByteFrequencyData(vizFrequencyBuffer.current);
      vizAnalyser.current.getFloatTimeDomainData(vizWaveformBuffer.current);
      return { frequency: vizFrequencyBuffer.current, waveform: vizWaveformBuffer.current };
    },
    startCapture: async () => {
      await ensureCapture();
    },
    getRetroSeconds: () => retroChunks.current.frames / pcmSampleRate.current,
    captureLastSeconds: async (seconds = RETRO_SECONDS) => {
      const node = pcmCaptureNode.current;
      if (!node) return new Blob([], { type: 'audio/wav' });
      await flushCapture(node);
      // Take the newest chunks covering `seconds`; chunks are 8192-frame batches.
      const wanted = Math.round(seconds * pcmSampleRate.current) * 2;
      const picked: Int16Array[] = [];
      let have = 0;
      const all = retroChunks.current.chunks;
      for (let i = all.length - 1; i >= 0 && have < wanted; i--) {
        const c = all[i];
        const need = wanted - have;
        picked.unshift(c.length > need ? c.subarray(c.length - need) : c);
        have += Math.min(c.length, need);
      }
      return encodeWavFromInt16Chunks(picked, pcmSampleRate.current);
    },
    startRecording: async () => {
      if (!masterLimiter.current) return;
      if (recordChunks.current) {
        throw new Error('Recording is already in progress.');
      }
      try {
        await ensureCapture();
      } catch (err) {
        throw new Error(`Recording unavailable: ${describeCaughtError(err)}`);
      }
      recordChunks.current = [];

      // Compressed copy via MediaRecorder — best effort; WAV is the source of truth.
      const mime = pickCompressedRecordingMime();
      if (mime) {
        try {
          const raw = Tone.getContext().rawContext as AudioContext;
          const dest = raw.createMediaStreamDestination();
          masterLimiter.current.connect(dest as any);
          const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 192_000 });
          const parts: Blob[] = [];
          recorder.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
          recorder.start(1000);
          compressedRec.current = { recorder, dest, parts };
        } catch {
          compressedRec.current = null;
        }
      }
    },
    stopRecording: async () => {
      const node = pcmCaptureNode.current;
      const chunks = recordChunks.current;
      if (!node || !chunks) {
        recordChunks.current = null;
        return { wav: new Blob([], { type: 'audio/wav' }), compressed: null };
      }
      await flushCapture(node);
      recordChunks.current = null;
      const wav = chunks.length
        ? encodeWavFromInt16Chunks(chunks, pcmSampleRate.current)
        : new Blob([], { type: 'audio/wav' });

      let compressed: Blob | null = null;
      const rec = compressedRec.current;
      compressedRec.current = null;
      if (rec) {
        compressed = await new Promise<Blob | null>((resolve) => {
          rec.recorder.onstop = () =>
            resolve(rec.parts.length ? new Blob(rec.parts, { type: rec.recorder.mimeType }) : null);
          try { rec.recorder.stop(); } catch { resolve(null); }
        });
        try { masterLimiter.current?.disconnect(rec.dest as any); } catch { /* ignore */ }
      }
      return { wav, compressed };
    },
    setMasterMute: (muted: boolean) => {
      Tone.getDestination().volume.value = muted ? -Infinity : 0;
    },
    setBackgroundPlayback: async (on: boolean) => {
      if (!on) {
        await backgroundStarting.current;
        teardownBackgroundOut();
        return true;
      }
      if (backgroundStarting.current) return backgroundStarting.current;
      if (backgroundOut.current) {
        await backgroundOut.current.audio.play().catch(() => undefined);
        return true;
      }
      backgroundStarting.current = startBackgroundOut();
      try {
        return await backgroundStarting.current;
      } finally {
        backgroundStarting.current = null;
      }
    },
    setOutputPaused: async (paused: boolean) => {
      const raw = Tone.getContext().rawContext as AudioContext;
      const audio = backgroundOut.current?.audio;
      if (paused) {
        audio?.pause();
        await raw.suspend().catch(() => undefined);
      } else {
        await raw.resume().catch(() => undefined);
        await audio?.play().catch(() => undefined);
      }
    },
    setRng: (rng) => {
      rngRef.current = rng;
    },
    debugPlayThroughMasterChain: () => {
      if (!masterBus.current || masterBus.current.disposed) return;
      void Tone.start();
      // Use native nodes into the bus GainNode for a low-level signal path test.
      const raw = Tone.getContext().rawContext as AudioContext;
      const busNode = masterBus.current.input as GainNode;
      const osc = raw.createOscillator();
      const g = raw.createGain();
      g.gain.value = 0.12;
      osc.type = 'sine';
      osc.frequency.value = 392;
      osc.connect(g);
      g.connect(busNode);
      const t0 = raw.currentTime + 0.02;
      osc.start(t0);
      osc.stop(t0 + 0.2);
      window.setTimeout(() => {
        try {
          g.disconnect();
          osc.disconnect();
        } catch {
          /* ignore */
        }
      }, 350);
    },
    getWaveform: (node) => {
        if (node && !node.disposed) {
            const waveform = (node as any).waveform;
            if (waveform && !waveform.disposed) {
                return waveform.getValue();
            }
        }
        return null;
    },
    startSynthLoop: (scale, discreetMode = false, keyRoot = null) => {
      if (!masterBus.current || !fxBus.current) return null;
      Tone.start();
      const r = rngRef.current ?? Math.random;

      // Pure, warm oscillators only — sine and triangle for a soft, Eno-style timbre.
      // Chorus below provides the width that 'fat' oscillators would otherwise give.
      const oscillatorTypes = ['sine', 'triangle', 'sine', 'sine'] as const; // bias toward sine
      const selectedOscillator = oscillatorTypes[Math.floor(r() * oscillatorTypes.length)];

      // Very slow attack and long release so notes bleed into each other
      const attack = r() * 3 + 2;    // 2–5s
      const decay = r() * 0.5 + 0.1; // 0.1–0.6s
      const sustain = r() * 0.2 + 0.7; // 0.7–0.9
      const release = r() * 6 + 5;   // 5–11s

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: selectedOscillator },
        envelope: { attack, decay, sustain, release },
      });
      synth.volume.value = -16;

      // Subtle chorus for lushness and spatial depth
      const chorus = new Tone.Chorus({
        frequency: 0.3 + r() * 0.4,  // 0.3–0.7Hz
        delayTime: 3.5 + r() * 1,    // 3.5–4.5ms
        depth: 0.4 + r() * 0.3,      // 0.4–0.7
        wet: 0.5 + r() * 0.3,
      }).start();

      // High-pass to remove low-end mud from the pad
      const highPass = new Tone.Filter(80, 'highpass');

      // Gentle low-pass — more open than before (1500–3500Hz)
      const filterFreq = r() * 2000 + 1500;
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = r() * 1 + 0.5;

      // Very slow, subtle filter LFO — barely perceptible movement
      const lfoFreq = 0.03 + r() * 0.1; // 0.03–0.13Hz
      const lfo = new Tone.LFO({ type: pickLFOType(r), frequency: lfoFreq, min: filterFreq * 0.85, max: filterFreq * 1.15 }).start();
      lfo.connect(filter.frequency);

      // Slow amplitude LFO for gentle breathing
      const ampLfo = new Tone.LFO({ type: pickLFOType(r), frequency: 0.05 + r() * 0.08, min: 0.8, max: 1.0 }).start();
      const ampGain = new Tone.Gain(1);
      ampLfo.connect(ampGain.gain);

      // Slow auto-pan for stereo width
      const panner = new Tone.AutoPanner({
        frequency: 0.04 + r() * 0.08,
        depth: 0.3 + r() * 0.2,
        wet: 0.6,
      }).start();

      // Slow oscillator detune drift — tape-flutter quality, barely perceptible ±8 cents.
      // Driven via setInterval + synth.set() rather than LFO signal connection because
      // PolySynth.detune is not a connectable AudioParam in Tone v15.
      const detuneLfoFreq = 0.01 + r() * 0.03;
      const detuneDepth = 8;
      let detunePhase = r() * Math.PI * 2;
      // 250ms steps: at ≤0.04Hz × ±8 cents each step moves < 0.5 cent (inaudible),
      // at a fifth of the main-thread wakeups of the old 50ms timer.
      const DETUNE_STEP_MS = 250;
      const detuneDriftInterval = setInterval(() => {
        if (synth.disposed) { clearInterval(detuneDriftInterval); return; }
        detunePhase += 2 * Math.PI * detuneLfoFreq * (DETUNE_STEP_MS / 1000);
        synth.set({ detune: Math.sin(detunePhase) * detuneDepth });
      }, DETUNE_STEP_MS);

      // Phaser — slowly sweeping all-pass notches give pads a breathing, 3D quality
      const phaser = new Tone.Phaser({
        frequency: 0.05 + r() * 0.15,
        octaves: 2 + r() * 2,
        baseFrequency: 300 + r() * 500,
        wet: 0.4 + r() * 0.3,
      });

      // Compressor — tightens transients and keeps loud chords from clipping
      const compressor = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.1, release: 0.5, knee: 6 });

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);
      const waveform = new Tone.Waveform(1024);

      synth.chain(chorus, highPass, filter, compressor, phaser, ampGain, panner, masterBus.current);
      synth.connect(sendGain);
      synth.connect(waveform);

      // Restrict to peaceful scales for ambient pads
      const peacefulScales: Exclude<ScaleName, 'random'>[] = ['majorPentatonic', 'major', 'dorian', 'mixolydian'];
      let scaleName: ScaleName = scale || 'random';
      if (scaleName === 'random') {
        scaleName = peacefulScales[Math.floor(r() * peacefulScales.length)];
      }
      // Fall back to a peaceful scale if user selected something harsh
      const currentScaleNotes = scales[scaleName].length > 0 ? scales[scaleName] : scales['majorPentatonic'];

      // Use upper register (octave 3+) for crystalline, Eno-style brightness
      const upperScale = currentScaleNotes.filter(n => parseInt(n.slice(-1)) >= 3);
      const basePool = upperScale.length >= 5 ? upperScale : currentScaleNotes;

      // Random transposition per layer so two "major" pads never share the same pitch center
      const semitoneOffset = pickTransposition(r, keyRoot);
      const notePool = semitoneOffset === 0
        ? basePool
        : basePool.map(note => Tone.Frequency(note).transpose(semitoneOffset).toNote());

      // Weight toward root, 3rd, 5th (scale indices 0, 2, 4 per octave) for harmonic gravity
      const weightedPool: string[] = [];
      notePool.forEach((note, i) => {
        const degree = i % 7; // works for heptatonic; pentatonic has fewer but extra weight is still fine
        const weight = (degree === 0 || degree === 2 || degree === 4) ? 3 : 1;
        for (let w = 0; w < weight; w++) weightedPool.push(note);
      });
      const pickNote = () => weightedPool[Math.floor(r() * weightedPool.length)];

      // Build open, consonant voicings — 5ths and triads rather than random clusters
      const buildVoicing = (pool: string[]): string[] => {
        const maxRoot = pool.length - 5;
        const rootIdx = Math.floor(r() * (maxRoot + 1));
        const v = r();
        if (v < 0.35) return [pool[rootIdx], pool[rootIdx + 4]];              // open 5th
        if (v < 0.65) return [pool[rootIdx], pool[rootIdx + 2], pool[rootIdx + 4]]; // triad
        return [pool[rootIdx], pool[rootIdx + 1], pool[rootIdx + 4]];         // sus2-ish
      };

      // Discreet Music mode: prime-length loops so layers never re-align.
      // In standard mode 2–4 events at '4m' each. In discreet mode a prime
      // number of '1m' steps — e.g. 7 and 11 won't share a repeat for 77m.
      const primeLengths = [5, 7, 11, 13, 17, 19];
      const sequenceLength = discreetMode
        ? primeLengths[Math.floor(r() * primeLengths.length)]
        : Math.floor(r() * 3) + 2;
      const subdivision = discreetMode ? '1m' : '4m';
      // Higher rest rate in discreet mode — the extra slots preserve breathing room
      const restThreshold = discreetMode ? 0.55 : 0.25;

      let lastNote: string | null = null;
      const events = Array.from({ length: sequenceLength }, () => {
        const ev = r();
        if (ev < restThreshold) { lastNote = null; return null; }
        if (ev < restThreshold + 0.25) {
          // Avoid repeating the same note consecutively
          let note = pickNote();
          if (note === lastNote) note = pickNote();
          lastNote = note;
          return note;
        }
        lastNote = null;
        return buildVoicing(notePool);
      });

      // Mutable state object closed over by the callback so probability can be
      // updated at runtime without recreating the sequence
      const state = { probability: 1 };

      const padDurations = ['2m', '4m', '4m', '4m', '4m', '8m'] as const;
      const sequence = new Tone.Sequence(
        (time, event) => {
          if (event && Math.random() <= state.probability) {
            const velocity = 0.4 + Math.random() * 0.6;
            const dur = padDurations[Math.floor(Math.random() * padDurations.length)];
            synth.triggerAttackRelease(event as Tone.Unit.Frequency | Tone.Unit.Frequency[], dur, time, velocity);
          }
        },
        events,
        subdivision
      );

      sequence.loop = true;
      sequence.start(0);

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      (sequence as any).detuneDriftInterval = detuneDriftInterval;
      (sequence as any).phaser = phaser;
      (sequence as any).compressor = compressor;
      (sequence as any).ampLfo = ampLfo;
      (sequence as any).ampGain = ampGain;
      (sequence as any).filter = filter;
      (sequence as any).highPass = highPass;
      (sequence as any).chorus = chorus;
      (sequence as any).panner = panner;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;
      (sequence as any).gateState = state;

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      const loopLabel = discreetMode ? ` · ${sequenceLength}m loop` : '';
      const info: SynthLayerInfo = {
        type: 'synth',
        description: `Pad (${selectedOscillator}) · ${KEY_NAMES[semitoneOffset]} ${scaleName} · A:${attack.toFixed(1)}s R:${release.toFixed(1)}s · Filter ${filterFreq.toFixed(0)}Hz${loopLabel}`
      };

      return { sequence, info, filterCutoff: filterFreq, filterResonance: filter.Q.value };
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const ampLfo = (sequence as any).ampLfo;
      const ampGain = (sequence as any).ampGain;
      const filter = (sequence as any).filter;
      const highPass = (sequence as any).highPass;
      const phaser = (sequence as any).phaser;
      const compressor = (sequence as any).compressor;
      const chorus = (sequence as any).chorus;
      const panner = (sequence as any).panner;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;
      clearInterval((sequence as any).driftInterval);
      clearInterval((sequence as any).detuneDriftInterval);
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (ampLfo && !ampLfo.disposed) ampLfo.stop().dispose();
      if (ampGain && !ampGain.disposed) ampGain.dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (highPass && !highPass.disposed) highPass.dispose();
      if (phaser && !phaser.disposed) phaser.dispose();
      if (compressor && !compressor.disposed) compressor.dispose();
      if (chorus && !chorus.disposed) chorus.dispose();
      if (panner && !panner.disposed) panner.dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (synth && !synth.disposed) {
        if (synth instanceof Tone.PolySynth) {
          synth.releaseAll();
        }
        synth.dispose();
      }
      if (sequence && !sequence.disposed) {
        if (Tone.Transport.state === 'started') sequence.stop();
        sequence.dispose();
      }
    },
    startFreesoundLoop: async (sound) => {
      if (!masterBus.current || !fxBus.current) return null;
      await Tone.start();
      const r = rngRef.current ?? Math.random;

      // Slight random pitch shift via playback rate — makes each sample feel unique
      const playbackRate = 0.85 + r() * 0.3; // 0.85–1.15x

      const player = new Tone.Player({
        loop: true,
        playbackRate,
        fadeIn: 1.5 + r() * 2,  // 1.5–3.5s fade in — no abrupt cuts
        fadeOut: 1,
      });
      player.volume.value = -12;

      // High-pass to strip low-end rumble common in field recordings
      const highPass = new Tone.Filter(60 + r() * 60, 'highpass'); // 60–120Hz

      // Open low-pass — let the texture breathe
      const filterFreq = r() * 3000 + 2000; // 2000–5000Hz
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = r() * 1 + 0.3;

      // Symmetric LFO — gentle ±15% sweep, not the previous dark 50–100% range
      const lfoFreq = 0.03 + r() * 0.1; // 0.03–0.13Hz
      const lfo = new Tone.LFO({ type: pickLFOType(r), frequency: lfoFreq, min: filterFreq * 0.85, max: filterFreq * 1.15 }).start();
      lfo.connect(filter.frequency);

      // Slow auto-pan for stereo width and movement
      const panner = new Tone.AutoPanner({
        frequency: 0.03 + r() * 0.07,
        depth: 0.4 + r() * 0.3,
        wet: 0.7,
      }).start();

      // Subtle ring modulation — non-musical tremolo rate adds barely-audible
      // harmonic sidebands that give field recordings more textural depth.
      const tremolo = new Tone.Tremolo({
        frequency: 5 + r() * 6,
        depth: r() * 0.06,
        spread: 0,
      }).start();

      // Phaser adds a slow spectral shimmer to field recordings
      const phaser = new Tone.Phaser({
        frequency: 0.04 + r() * 0.12,
        octaves: 1.5 + r() * 2,
        baseFrequency: 400 + r() * 600,
        wet: 0.3 + r() * 0.3,
      });

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);
      const waveform = new Tone.Waveform(1024);

      player.chain(highPass, filter, tremolo, phaser, panner, masterBus.current);
      player.connect(sendGain);
      player.connect(waveform);

      try {
        const audioBuffer = await withLoadTimeout(
          loadDecodedAudioBuffer(sound.previewUrl, (data) =>
            Tone.getContext().decodeAudioData(data),
          ),
          'Freesound sample load',
        );
        player.buffer.set(audioBuffer);
      } catch (err) {
        // Audio file unavailable (deleted, 404, network error, or stalled fetch) — dispose all nodes
        lfo.dispose(); tremolo.dispose(); phaser.dispose(); panner.dispose(); filter.dispose(); highPass.dispose();
        sendGain.dispose(); waveform.dispose(); player.dispose();
        throw err;
      }

      // Always extract and loop a short region from a random place in the source.
      // Target loop length: 2–6s (clamped if the loaded file is shorter).
      const bufferDuration = player.buffer?.duration ?? 0;
      let startOffset = 0;
      let loopLabel = '';
      if (bufferDuration > 0) {
        const targetLoopDur = 2 + r() * 4; // 2–6s loop window
        const loopDur = Math.min(targetLoopDur, Math.max(0.25, bufferDuration - 0.05));
        const maxStart = Math.max(0, bufferDuration - loopDur - 0.05);
        const loopStart = maxStart > 0 ? r() * maxStart : 0;
        const loopEnd = loopStart + loopDur;
        player.loopStart = loopStart;
        player.loopEnd = loopEnd;
        startOffset = loopStart;
        loopLabel = ` · ${loopDur.toFixed(1)}s loop`;
      }
      player.start('+0', startOffset);

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      (player as any).sendGain = sendGain;
      (player as any).waveform = waveform;
      (player as any).filter = filter;
      (player as any).highPass = highPass;
      (player as any).lfo = lfo;
      (player as any).tremolo = tremolo;
      (player as any).phaser = phaser;
      (player as any).panner = panner;

      const info: FreesoundLayerInfo = {
        type: 'freesound',
        id: sound.id,
        name: sound.name,
        description: `${sound.name} · ${playbackRate.toFixed(2)}x · filter ${(filterFreq / 1000).toFixed(1)}kHz${loopLabel}`,
        previewUrl: sound.previewUrl,
        username: sound.username,
      };

      return { player, info, filterCutoff: filterFreq, filterResonance: filter.Q.value };
    },
    stopFreesoundLoop: (player) => {
      const sendGain = (player as any).sendGain;
      const waveform = (player as any).waveform;
      const filter = (player as any).filter;
      const highPass = (player as any).highPass;
      const lfo = (player as any).lfo;
      const tremolo = (player as any).tremolo;
      const panner = (player as any).panner;
      clearInterval((player as any).driftInterval);
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (tremolo && !tremolo.disposed) tremolo.dispose();
      if ((player as any).phaser && !(player as any).phaser.disposed) (player as any).phaser.dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (highPass && !highPass.disposed) highPass.dispose();
      if (panner && !panner.disposed) panner.dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (player && !player.disposed) {
        if (Tone.Transport.state === 'started') player.stop();
        player.dispose();
      }
    },
    startGrainLoop: async (sound) => {
      if (!masterBus.current || !fxBus.current) return null;
      await Tone.start();
      const r = rngRef.current ?? Math.random;

      // Tone.GrainPlayer scans grains linearly; the extra offset voices and
      // staggered restarts below make the layer behave like a granular cloud.
      const grainSize = 0.035 + r() * 0.125; // 35–160ms per grain
      const overlap = grainSize * (0.75 + r() * 0.35); // dense crossfades prevent choppy gaps
      const drift = 0.3 + r() * 1.7; // seconds of source-position scatter
      const playbackRate = 0.12 + r() * 0.38; // slow scan, but not a frozen loop
      const detune = r() * 24 - 12; // subtle ±12 cents per layer

      const makeGrainVoice = (voiceIndex: number) => {
        const rateRatio = voiceIndex === 0 ? 1 : 0.94 + r() * 0.12;
        const voice = new Tone.GrainPlayer({
          loop: true,
          grainSize,
          overlap,
          playbackRate: Math.max(0.03, playbackRate * rateRatio),
          reverse: false,
          detune: detune + (voiceIndex === 0 ? 0 : r() * 18 - 9),
        });
        (voice as any).grainRateRatio = rateRatio;
        return voice;
      };

      const player = makeGrainVoice(0);
      const grainVoices = [player, ...Array.from({ length: GRAIN_VOICE_COUNT - 1 }, (_, index) => makeGrainVoice(index + 1))];
      (player as any).grainVoices = grainVoices;
      (player as any).grainScatter = {
        intervalId: null,
        drift,
        grainSize,
        playbackRate,
        rng: r,
      } satisfies GrainScatterState;
      getGrainVoices(player).forEach((voice) => {
        voice.volume.value = -12 - GRAIN_VOICE_GAIN_COMPENSATION_DB;
      });

      // Same filter + autopan chain as freesound layers
      const highPass = new Tone.Filter(60 + r() * 60, 'highpass');

      const filterFreq = r() * 3000 + 2000;
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = r() * 1 + 0.3;

      const lfoFreq = 0.03 + r() * 0.1;
      const lfo = new Tone.LFO({ type: pickLFOType(r), frequency: lfoFreq, min: filterFreq * 0.85, max: filterFreq * 1.15 }).start();
      lfo.connect(filter.frequency);

      const panner = new Tone.AutoPanner({
        frequency: 0.03 + r() * 0.07,
        depth: 0.4 + r() * 0.3,
        wet: 0.7,
      }).start();

      // 30% chance of a subtle Chebyshev waveshaper — adds specific odd harmonics
      // that give grain textures an alien, crystalline edge. wet=0 bypasses for the other 70%.
      const chebyOrder = Math.floor(r() * 3) + 2; // order 2–4
      const exciter = new Tone.Chebyshev(chebyOrder);
      exciter.wet.value = r() < 0.3 ? 0.08 + r() * 0.12 : 0; // 8–20% wet or off

      // 40% chance of a BitCrusher — lo-fi digital texture, adds character to dense grain clouds.
      // Higher bit depths (6–10) give subtle grit rather than full destruction.
      // Only constructed when it rolls on — a wet-0 BitCrusher is still a full
      // AudioWorklet running every block. Draw order is unchanged for seeds.
      const crushBits = Math.floor(r() * 5) + 6; // bits 6–10
      const crushWet = r() < 0.4 ? 0.12 + r() * 0.18 : 0; // 12–30% wet or off
      let bitCrusher: Tone.BitCrusher | null = null;
      if (crushWet > 0) {
        bitCrusher = new Tone.BitCrusher(crushBits);
        bitCrusher.wet.value = crushWet;
      }

      // Chorus — always present, thickens grain clouds by adding detuned copies.
      // Low frequency (0.3–1.5Hz) + moderate depth keeps it spatial rather than warbling.
      const chorus = new Tone.Chorus({
        frequency: 0.3 + r() * 1.2,
        delayTime: 3.5 + r() * 2.5,
        depth: 0.3 + r() * 0.4,
        wet: 0.35 + r() * 0.2,
      }).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);
      const waveform = new Tone.Waveform(1024);

      player.chain(highPass, filter, exciter, ...(bitCrusher ? [bitCrusher] : []), chorus, panner, masterBus.current);
      player.connect(sendGain);
      grainVoices.slice(1).forEach((voice) => {
        voice.connect(highPass);
        voice.connect(sendGain);
      });
      player.connect(waveform);

      try {
        const audioBuffer = await withLoadTimeout(
          loadDecodedAudioBuffer(sound.previewUrl, (data) =>
            Tone.getContext().decodeAudioData(data),
          ),
          'Grain sample load',
        );
        grainVoices.forEach((voice) => voice.buffer.set(audioBuffer));
      } catch (err) {
        lfo.dispose(); exciter.dispose(); bitCrusher?.dispose(); chorus.dispose();
        panner.dispose(); filter.dispose(); highPass.dispose();
        sendGain.dispose(); waveform.dispose();
        grainVoices.forEach((voice) => voice.dispose());
        throw err;
      }

      const duration = player.buffer?.duration ?? 0;
      const centerOffset = duration > 0 ? r() * duration : 0;
      const startTime = Tone.now();
      grainVoices.forEach((voice) => {
        const voiceDuration = voice.buffer?.duration ?? duration;
        const offset = wrapSeconds(centerOffset + (r() - 0.5) * 2 * drift, voiceDuration);
        voice.start(startTime, offset);
        (voice as any).grainStartedAt = startTime;
        (voice as any).grainStartOffset = offset;
      });
      startGrainScatter(player);

      // 20% chance of a slow downward pitch drift — like a tape machine imperceptibly
      // winding down. Ramps -100 cents over 20–40s, then stays there.
      // GrainPlayer.detune is a plain number in Tone 15 (not a Signal), so no rampTo().
      if (r() < 0.2) {
        const driftDurationSec = 20 + r() * 20;
        const startDetune = player.detune;
        const endDetune = -100;
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const detuneDriftInterval = setInterval(() => {
          if (player.disposed) {
            clearInterval(detuneDriftInterval);
            return;
          }
          const elapsed =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
          const u = Math.min(1, elapsed / (driftDurationSec * 1000));
          player.detune = startDetune + (endDetune - startDetune) * u;
          if (u >= 1) clearInterval(detuneDriftInterval);
        }, 50);
        (player as any).detuneDriftInterval = detuneDriftInterval;
      }

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      (player as any).sendGain = sendGain;
      (player as any).waveform = waveform;
      (player as any).filter = filter;
      (player as any).highPass = highPass;
      (player as any).lfo = lfo;
      (player as any).exciter = exciter;
      (player as any).bitCrusher = bitCrusher;
      (player as any).chorus = chorus;
      (player as any).panner = panner;

      const info: GrainLayerInfo = {
        type: 'grain',
        id: sound.id,
        name: sound.name,
        description: `${sound.name} · ${(grainSize * 1000).toFixed(0)}ms grains · ${GRAIN_VOICE_COUNT}-voice scatter ${drift.toFixed(2)}s · ${playbackRate.toFixed(2)}x`,
        previewUrl: sound.previewUrl,
        username: sound.username,
      };

      return { player, info, filterCutoff: filterFreq, filterResonance: filter.Q.value, grainSize, grainDrift: drift, playbackRate };
    },
    stopGrainLoop: (player) => {
      stopGrainScatter(player);
      const grainVoices = getGrainVoices(player);
      const sendGain = (player as any).sendGain;
      const waveform = (player as any).waveform;
      const filter = (player as any).filter;
      const highPass = (player as any).highPass;
      const lfo = (player as any).lfo;
      const panner = (player as any).panner;
      clearInterval((player as any).driftInterval);
      if ((player as any).detuneDriftInterval != null) {
        clearInterval((player as any).detuneDriftInterval);
        (player as any).detuneDriftInterval = null;
      }
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if ((player as any).exciter && !(player as any).exciter.disposed) (player as any).exciter.dispose();
      if ((player as any).bitCrusher && !(player as any).bitCrusher.disposed) (player as any).bitCrusher.dispose();
      if ((player as any).chorus && !(player as any).chorus.disposed) (player as any).chorus.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (highPass && !highPass.disposed) highPass.dispose();
      if (panner && !panner.disposed) panner.dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      grainVoices.forEach((voice) => {
        if (voice && !voice.disposed) {
          voice.stop();
          voice.dispose();
        }
      });
    },
    setGrainSize: (player, size) => {
      if (player && !player.disposed) {
        getGrainVoices(player).forEach((voice) => {
          if (!voice.disposed) {
            voice.grainSize = size;
            voice.overlap = size * 0.9;
          }
        });
        const scatter = (player as any).grainScatter as GrainScatterState | undefined;
        if (scatter) {
          scatter.grainSize = size;
          startGrainScatter(player);
        }
      }
    },
    setGrainDrift: (player, drift) => {
      if (player && !player.disposed) {
        const scatter = (player as any).grainScatter as GrainScatterState | undefined;
        if (scatter) {
          scatter.drift = drift;
          startGrainScatter(player);
        }
      }
    },
    setGrainFreeze: (player, frozen) => {
      if (!player || player.disposed) return;
      const scatter = (player as any).grainScatter as GrainScatterState | undefined;
      if (!scatter) return;
      const duration = player.buffer?.duration ?? 0;
      if (!duration) return;
      const now = Tone.now();
      if (frozen) {
        if (scatter.frozenAt != null) return;
        // Current scan position of the primary voice.
        const startedAt = (player as any).grainStartedAt as number | undefined;
        const startOffset = ((player as any).grainStartOffset as number | undefined) ?? 0;
        const elapsed = startedAt == null ? 0 : (now - startedAt) * scatter.playbackRate;
        scatter.frozenAt = wrapSeconds(startOffset + elapsed, duration);
        // Stop scanning; grains already sounding play out under the frozen ones.
        getGrainVoices(player).forEach((voice) => { if (!voice.disposed && voice.state === 'started') voice.stop(now); });
      } else {
        if (scatter.frozenAt == null) return;
        const from = scatter.frozenAt;
        scatter.frozenAt = null;
        // Resume scanning from the held point rather than jumping to where it would have been.
        // Resume scanning from the held point rather than where it would have been.
        getGrainVoices(player).forEach((voice, i) => {
          if (voice.disposed) return;
          const duration = voice.buffer?.duration ?? 0;
          const offset = wrapSeconds(from + (i === 0 ? 0 : (scatter.rng() - 0.5) * 2 * scatter.drift), duration);
          voice.start(now + 0.01, offset);
          (voice as any).grainStartedAt = now;
          (voice as any).grainStartOffset = offset;
        });
      }
      startGrainScatter(player);
    },
    startMelodicLoop: (scale, discreetMode = false, keyRoot = null) => {
      if (!masterBus.current || !fxBus.current) return null;
      Tone.start();
      const r = rngRef.current ?? Math.random;

      // Gentle low-pass — open and airy for melodic content
      const filterFreq = r() * 2500 + 2000; // 2000–4500Hz
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = r() * 1 + 0.3; // low Q — smooth, no resonant peak

      const lfoFreq = 0.04 + r() * 0.1; // 0.04–0.14Hz — barely perceptible
      const lfo = new Tone.LFO({ type: pickLFOType(r), frequency: lfoFreq, min: filterFreq * 0.85, max: filterFreq * 1.15 });
      lfo.connect(filter.frequency).start();

      // Long, spacious reverb — the defining quality of Eno's melodic sound.
      // Shared across melodic layers; each layer sets its own wet/dry balance.
      if (!melodicReverb.current || melodicReverb.current.disposed) {
        melodicReverb.current = new Tone.Reverb({ decay: 8, preDelay: 0.03, wet: 1 }).connect(masterBus.current);
      }
      const reverbMix = r() * 0.3 + 0.5; // 0.5–0.8 wet
      // Equal-power split, matching Tone's own dry/wet CrossFade
      const reverbDry = new Tone.Gain(Math.cos(reverbMix * Math.PI / 2)).connect(masterBus.current);
      const reverbWet = new Tone.Gain(Math.sin(reverbMix * Math.PI / 2)).connect(melodicReverb.current);

      // Tape-style quarter or half-note delay with moderate feedback
      const delayTimeOptions = ['4n', '2n', '4n.'];
      const delayTime = delayTimeOptions[Math.floor(r() * delayTimeOptions.length)];
      // maxDelay: default is 1s, but 2n / 4n. exceed that below ~120 BPM and get clamped.
      const delay = new Tone.FeedbackDelay({ delayTime, feedback: r() * 0.3 + 0.3, maxDelay: 8 }); // 0.3–0.6 feedback
      delay.wet.value = r() * 0.3 + 0.3; // 0.3–0.6 wet
      delay.connect(filter);
      filter.fan(reverbDry, reverbWet);

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);

      // Eno-appropriate synth voices only
      const synthTypes = ['pure', 'bell', 'mallet', 'electric', 'glass', 'duo', 'metal', 'membrane'];
      const randomSynthType = synthTypes[Math.floor(r() * synthTypes.length)];

      // PolySynth<any>: voices differ (Synth, FMSynth, AMSynth, DuoSynth)
      let synth: Tone.PolySynth<any> | Tone.PluckSynth | Tone.MetalSynth | Tone.MembraneSynth;
      let synthDescription = '';
      let noteDuration: string;

      switch (randomSynthType) {
        case 'bell': {
          // FM bell — inharmonic partials give the characteristic metallic shimmer.
          // Harmonicity outside integer ratios → the overtones don't line up cleanly,
          // which is exactly what makes a struck bell sound different from a pure tone.
          const bellHarmonicity = 2.5 + r() * 2;   // 2.5–4.5 — inharmonic zone
          const bellModIndex    = 8   + r() * 10;   // 8–18  — bright metallic colour
          synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: bellHarmonicity,
            modulationIndex: bellModIndex,
            oscillator: { type: 'sine' },
            // Envelope: instant attack, no sustain — the ring is all in release
            envelope: { attack: 0.001, decay: 0.3 + r() * 0.5, sustain: 0, release: 8 + r() * 7 },
            modulation: { type: 'sine' },
            modulationEnvelope: { attack: 0.001, decay: 1 + r() * 2, sustain: 0, release: 5 + r() * 5 },
          });
          noteDuration = '8n'; // short trigger — envelope handles the whole shape
          synthDescription = `Bell (FM h:${bellHarmonicity.toFixed(1)} m:${bellModIndex.toFixed(0)})`;
          break;
        }
        case 'mallet': {
          // Vibraphone / marimba quality — clean percussive attack, warm sustain, long ring.
          // AM modulation adds the slight tremolo characteristic of a vibraphone motor.
          const malletHarmonicity = 3 + r() * 1.5; // 3–4.5
          synth = new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: malletHarmonicity,
            envelope: { attack: 0.005, decay: 0.1 + r() * 0.3, sustain: 0.4 + r() * 0.3, release: 4 + r() * 5 },
            modulationEnvelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 3 },
          });
          noteDuration = '4n';
          synthDescription = `Mallet (AM h:${malletHarmonicity.toFixed(1)})`;
          break;
        }
        case 'electric':
          // Low-harmonicity FM ≈ electric piano warmth (Eno's Rhodes-like tones)
          const harmonicity = 1 + r() * 0.5; // 1.0–1.5 — subtle FM
          const modIndex = 1 + r() * 2;      // 1–3 — gentle modulation
          synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity,
            modulationIndex: modIndex,
            envelope: { attack: 0.02 + r() * 0.1, decay: 1, sustain: 0.6, release: 4 + r() * 3 },
            modulationEnvelope: { attack: 0.05, release: 2 },
          });
          noteDuration = '2n';
          synthDescription = `Electric (FM h:${harmonicity.toFixed(1)})`;
          break;
        case 'glass':
          // Triangle wave with soft attack — organ/glass harmonica quality
          synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.05 + r() * 0.25, decay: 1, sustain: 0.7, release: 5 + r() * 4 },
          });
          noteDuration = '1m';
          synthDescription = 'Glass (triangle)';
          break;
        case 'duo': {
          // Two oscillators slightly detuned against each other — natural beating
          // without needing a Chorus unit. Harmonicity near 1.0 produces slow,
          // warm beating; values further away create richer difference tones.
          const duoHarmonicity = 1.0 + r() * 0.06; // 1.0–1.06
          synth = new Tone.PolySynth(Tone.DuoSynth, {
            harmonicity: duoHarmonicity,
            vibratoAmount: 0.1 + r() * 0.2,
            vibratoRate: 2 + r() * 3,
          } as any);
          noteDuration = '2m';
          synthDescription = `Duo (h:${duoHarmonicity.toFixed(3)})`;
          break;
        }
        case 'metal': {
          // MetalSynth — fully inharmonic FM partials, cymbal/tam-tam quality.
          // Unlike bell, harmonicity is pushed into high inharmonic territory and
          // the envelope is purely percussive (no sustain). Fires on sparse
          // fast subdivisions with very low probability so it reads as texture
          // rather than rhythm.
          const metalHarmonicity = 5 + r() * 8;  // 5–13 — well into inharmonic zone
          const metalModIndex   = 10 + r() * 20; // 10–30 — bright metallic colour
          const metalSynth = new Tone.MetalSynth({
            harmonicity: metalHarmonicity,
            modulationIndex: metalModIndex,
            resonance: 3000 + r() * 4000,
            octaves: 0.5 + r() * 1.0,
            envelope: { attack: 0.001, decay: 0.4 + r() * 0.8, release: 0.2 + r() * 0.5 },
          });
          // frequency must be set post-construction
          metalSynth.frequency.value = Tone.Frequency(['C3', 'G3', 'D3'][Math.floor(r() * 3)]).toFrequency();
          synth = metalSynth;
          noteDuration = '16n'; // unused — MetalSynth triggers by duration not note
          synthDescription = `Metal (h:${metalHarmonicity.toFixed(1)} m:${metalModIndex.toFixed(0)})`;
          break;
        }
        case 'membrane': {
          // MembraneSynth — pitched kick/tom quality. Sine carrier with fast pitch
          // envelope drop from attack frequency down to a low resting pitch.
          // Works best on root notes of the scale in octave 2–3.
          const pitchDecay = 0.05 + r() * 0.15; // 50–200ms pitch drop
          synth = new Tone.MembraneSynth({
            pitchDecay,
            octaves: 4 + r() * 4, // 4–8 octave pitch drop — more = punchier
            envelope: { attack: 0.001, decay: 0.3 + r() * 0.4, sustain: 0, release: 0.5 + r() * 0.5 },
          });
          noteDuration = '8n';
          synthDescription = `Membrane (pd:${(pitchDecay * 1000).toFixed(0)}ms)`;
          break;
        }
        default: // 'pure'
          // Sine tone — the most fundamental Eno sound
          synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.02 + r() * 0.2, decay: 0.5, sustain: 0.8, release: 6 + r() * 4 },
          });
          noteDuration = '1m';
          synthDescription = 'Pure (sine)';
          break;
      }
      synth.volume.value = -16;
      // Long releases (up to 10s) overlap voices; uncapped, voice count (DuoSynth
      // especially, two synths + LFO per voice) grows until the audio thread chokes.
      if (synth instanceof Tone.PolySynth) synth.maxPolyphony = 8;

      // Vibrato — pitch modulation gives bells and mallets an expressive, bowed quality
      const vibrato = new Tone.Vibrato({
        frequency: 2 + r() * 3,   // 2–5Hz
        depth: 0.05 + r() * 0.1,  // subtle 5–15% depth
        wet: 0.4 + r() * 0.4,
      });

      const waveform = new Tone.Waveform(1024);
      synth.chain(vibrato, delay);
      synth.connect(sendGain);
      synth.connect(waveform);

      // Peaceful scales only
      const peacefulScales: Exclude<ScaleName, 'random'>[] = ['majorPentatonic', 'major', 'dorian', 'mixolydian'];
      let scaleName: ScaleName = scale || 'random';
      if (scaleName === 'random') {
        scaleName = peacefulScales[Math.floor(r() * peacefulScales.length)];
      }
      const currentScale = scales[scaleName];

      // Upper register only — crystalline, not muddy
      const upperScale = currentScale.filter(n => parseInt(n.slice(-1)) >= 3);
      const basePool = upperScale.length >= 4 ? upperScale : currentScale;

      // Random transposition per layer so layers never share the same pitch center
      const semitoneOffset = pickTransposition(r, keyRoot);
      const notePool = semitoneOffset === 0
        ? basePool
        : basePool.map(note => Tone.Frequency(note).transpose(semitoneOffset).toNote());

      // Pattern-style traversal — gives each melodic layer a distinct musical character
      // rather than always drawing randomly from the pool.
      // Pattern types mirror Tone.Pattern's built-in modes.
      const patternTypes = ['up', 'down', 'upDown', 'downUp', 'randomWalk', 'random'] as const;
      type PatternType = typeof patternTypes[number];
      const patternType: PatternType = patternTypes[Math.floor(r() * patternTypes.length)];

      // Build a cursor that returns the next note according to the chosen pattern.
      // upDown/downUp bounce at the ends; randomWalk steps ±1 from current position.
      let cursorIdx = patternType === 'down' || patternType === 'downUp' ? notePool.length - 1 : 0;
      let cursorDir = patternType === 'down' || patternType === 'downUp' ? -1 : 1;

      const nextPatternNote = (): string => {
        switch (patternType) {
          case 'up':
            cursorIdx = (cursorIdx + 1) % notePool.length;
            break;
          case 'down':
            cursorIdx = (cursorIdx - 1 + notePool.length) % notePool.length;
            break;
          case 'upDown':
          case 'downUp':
            cursorIdx += cursorDir;
            if (cursorIdx >= notePool.length - 1) { cursorIdx = notePool.length - 1; cursorDir = -1; }
            else if (cursorIdx <= 0) { cursorIdx = 0; cursorDir = 1; }
            break;
          case 'randomWalk': {
            // Seeded r(), not Math.random — this runs while building the event
            // list, so it decides which notes a shared seed reproduces.
            const step = r() < 0.5 ? 1 : -1;
            cursorIdx = Math.max(0, Math.min(notePool.length - 1, cursorIdx + step));
            break;
          }
          default: // 'random'
            cursorIdx = Math.floor(r() * notePool.length);
        }
        return notePool[cursorIdx];
      };

      // Percussive voices use fast subdivisions + low probability rather than
      // slow melodic intervals. This makes them feel like sparse accents.
      const isPercussive = randomSynthType === 'metal' || randomSynthType === 'membrane';

      // Discreet Music mode: prime-length loop so this layer never re-aligns with
      // others. Standard mode: 3–5 events at a random slow interval.
      const primeLengths = [5, 7, 11, 13, 17, 19];
      const sequenceLength = isPercussive
        ? primeLengths[Math.floor(r() * primeLengths.length)] * 2  // longer loop = less repetition
        : discreetMode
          ? primeLengths[Math.floor(r() * primeLengths.length)]
          : Math.floor(r() * 3) + 3;
      const intervalOptions = ['1m', '2m', '2n'];
      const sequenceInterval = isPercussive
        ? (['8n', '16n'] as const)[Math.floor(r() * 2)]
        : discreetMode
          ? '1m'
          : intervalOptions[Math.floor(r() * intervalOptions.length)];

      // Percussive voices: sparse hits (5–12% chance), melodic voices: 35% rest
      const restThreshold = isPercussive ? 1 - (0.05 + r() * 0.07) : 0.35;

      const sequenceEvents = Array.from({ length: sequenceLength }, () => {
        const ev = r();
        if (isPercussive) return ev < restThreshold ? null : nextPatternNote();
        if (ev < restThreshold) return null;
        if (ev < 0.8 || !(synth instanceof Tone.PolySynth)) return nextPatternNote();
        // Occasional gentle dyad (two scale-adjacent notes)
        const idx = Math.floor(r() * (notePool.length - 2));
        return [notePool[idx], notePool[idx + 2]];
      });

      // Same mutable state pattern as startSynthLoop
      const state = { probability: 1 };

      const sequence = new Tone.Sequence(
        (time, note) => {
          if (note && Math.random() <= state.probability) {
            const velocity = 0.3 + Math.random() * 0.7;
            if (synth instanceof Tone.MetalSynth) {
              synth.triggerAttackRelease('16n', time, velocity);
            } else if (synth instanceof Tone.MembraneSynth) {
              synth.triggerAttackRelease(note as string, '8n', time, velocity);
            } else if (synth instanceof Tone.PluckSynth) {
              synth.triggerAttack(note as string, time); // PluckSynth takes no velocity
            } else if (synth instanceof Tone.PolySynth) {
              synth.triggerAttackRelease(note as Tone.Unit.Frequency | Tone.Unit.Frequency[], noteDuration, time, velocity);
            }
          }
        },
        sequenceEvents,
        sequenceInterval
      );

      sequence.loop = true;
      sequence.start(0);

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      (sequence as any).filter = filter;
      (sequence as any).vibrato = vibrato;
      (sequence as any).effects = { delay, reverbDry, reverbWet };
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;
      (sequence as any).gateState = state;

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      const loopLabel = discreetMode ? ` · ${sequenceLength}m loop` : '';
      const info: SynthLayerInfo = {
        type: 'melodic',
        description: `${synthDescription} · ${KEY_NAMES[semitoneOffset]} ${scaleName} · ${patternType} · ${sequenceInterval} interval · reverb ${Math.round(reverbMix * 100)}% wet${loopLabel}`
      };

      return { sequence, info, filterCutoff: filterFreq, filterResonance: filter.Q.value };
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const filter = (sequence as any).filter;
      const vibrato = (sequence as any).vibrato;
      const effects = (sequence as any).effects;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;
      
      clearInterval((sequence as any).driftInterval);
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (vibrato && !vibrato.disposed) vibrato.dispose();
      if (effects) {
        if (effects.delay && !effects.delay.disposed) effects.delay.dispose();
        if (effects.reverbDry && !effects.reverbDry.disposed) effects.reverbDry.dispose();
        if (effects.reverbWet && !effects.reverbWet.disposed) effects.reverbWet.dispose();
      }
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (synth && !synth.disposed) {
        if (synth instanceof Tone.PolySynth) synth.releaseAll();
        synth.dispose();
      }
      if (sequence && !sequence.disposed) {
        if (Tone.Transport.state === 'started') sequence.stop();
        sequence.dispose();
      }
    },
    startAtmosphereLoop: () => {
      if (!masterBus.current || !fxBus.current) return null;
      Tone.start();
      const r = rngRef.current ?? Math.random;

      // Pink and brown noise bias — white is too harsh for ambient
      const noiseTypes: Tone.NoiseType[] = ['pink', 'pink', 'brown'];
      const noiseType = noiseTypes[Math.floor(r() * noiseTypes.length)];
      const noise = new Tone.Noise(noiseType);
      noise.volume.value = -28; // quiet by default — atmospheric presence, not foreground
      noise.start();

      // Filter sculpts noise into a recognisable texture:
      // lowpass → underground rumble / ventilation hum
      // bandpass → distant machinery / crowd murmur
      const useBandpass = r() < 0.45;
      const filterFreq = useBandpass
        ? 500 + r() * 2000   // 500–2500Hz band
        : 150 + r() * 500;   // 150–650Hz low rumble
      const filter = new Tone.Filter(filterFreq, useBandpass ? 'bandpass' : 'lowpass', -24);
      filter.Q.value = useBandpass ? 0.8 + r() * 1.5 : 0.5;

      // Extremely slow filter drift — the texture very gradually brightens and darkens
      const lfoFreq = 0.003 + r() * 0.015; // 0.003–0.018Hz (one sweep every 1–5 mins)
      const lfo = new Tone.LFO({ type: pickLFOType(r), frequency: lfoFreq, min: filterFreq * 0.6, max: filterFreq * 1.4 }).start();
      lfo.connect(filter.frequency);

      const panner = new Tone.AutoPanner({
        frequency: 0.01 + r() * 0.04,
        depth: 0.15 + r() * 0.25,
        wet: 0.5,
      }).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);
      const waveform = new Tone.Waveform(1024);

      noise.chain(filter, panner, masterBus.current);
      noise.connect(sendGain);
      noise.connect(waveform);

      if (Tone.Transport.state !== 'started') Tone.Transport.start();

      (noise as any).filter = filter;
      (noise as any).lfo = lfo;
      (noise as any).panner = panner;
      (noise as any).sendGain = sendGain;
      (noise as any).waveform = waveform;

      const textureLabel = noiseType === 'brown'
        ? 'Rumble' : useBandpass ? 'Texture' : 'Haze';
      const info: AtmosphereLayerInfo = {
        type: 'atmosphere',
        description: `${textureLabel} · ${noiseType} noise · ${useBandpass ? 'bandpass' : 'lowpass'} ${(filterFreq / 1000).toFixed(1)}kHz`,
      };

      return { node: noise, info, filterCutoff: filterFreq, filterResonance: filter.Q.value };
    },
    stopAtmosphereLoop: (noise) => {
      const filter = (noise as any).filter;
      const lfo = (noise as any).lfo;
      const panner = (noise as any).panner;
      const sendGain = (noise as any).sendGain;
      const waveform = (noise as any).waveform;
      clearInterval((noise as any).driftInterval);
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (panner && !panner.disposed) panner.dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (noise && !noise.disposed) { noise.stop(); noise.dispose(); }
    },
    setVolume: (node, volume, rampSeconds = PARAM_RAMP_SECONDS) => {
      if (node && !node.disposed) {
        if (node instanceof Tone.Sequence) {
          const synth = (node as any).synth;
          if (synth && !synth.disposed) {
            glideDb(synth.volume, volume, rampSeconds);
          }
        } else if (node instanceof Tone.GrainPlayer) {
          setGrainVoiceVolumes(node, volume, rampSeconds);
        } else if (node instanceof Tone.Gain) {
          // Drone layer — gain is linear, so convert from dB (dbToGain(-∞) = 0)
          glideParam(node.gain, Tone.dbToGain(volume), rampSeconds);
        } else {
          glideDb((node as Tone.Player | Tone.PolySynth | Tone.PluckSynth).volume, volume, rampSeconds);
        }
      }
    },
    setSendAmount: (node, amount) => {
      if (node && !node.disposed) {
        const sendGain = (node as any).sendGain;
        if (sendGain && !sendGain.disposed) {
          const gainValue = amount > -40 ? Tone.dbToGain(amount) : 0;
          glideParam(sendGain.gain, gainValue);
        }
      }
    },
    setPlaybackRate: (node, rate) => {
      if ((node instanceof Tone.Player || node instanceof Tone.GrainPlayer) && !node.disposed) {
        if (node instanceof Tone.GrainPlayer) {
          getGrainVoices(node).forEach((voice) => {
            if (!voice.disposed) {
              const rateRatio = ((voice as any).grainRateRatio as number | undefined) ?? 1;
              voice.playbackRate = Math.max(0.03, rate * rateRatio);
            }
          });
          const scatter = (node as any).grainScatter as GrainScatterState | undefined;
          if (scatter) {
            scatter.playbackRate = rate;
          }
        } else {
          node.playbackRate = rate;
        }
      }
    },
    setReverse: (node, reverse) => {
      if ((node instanceof Tone.Player || node instanceof Tone.GrainPlayer) && !node.disposed) {
        if (node instanceof Tone.GrainPlayer) {
          getGrainVoices(node).forEach((voice) => {
            if (!voice.disposed) voice.reverse = reverse;
          });
        } else {
          node.reverse = reverse;
        }
      }
    },
    setLayerFilterCutoff: (node, freq) => {
      const lfo = (node as any).lfo;
      const filter = (node as any).filter;
      if (lfo && !lfo.disposed) {
        // LFO owns filter.frequency — setting filter.frequency.value directly has no
        // effect while the LFO is connected. Rescale its output range proportionally
        // around the new center frequency instead.
        const currentMid = (lfo.min + lfo.max) / 2;
        if (currentMid > 0) {
          const ratio = freq / currentMid;
          lfo.min = lfo.min * ratio;
          lfo.max = lfo.max * ratio;
        } else {
          lfo.min = freq * 0.85;
          lfo.max = freq * 1.15;
        }
        // Keep drift interval in sync with the new center frequency
        if ((node as any).driftInterval != null) {
          (node as any).driftCenter = freq;
          (node as any).driftRange  = freq * 0.6;
          // Disabling drift restores to this — keep it in step with the user's
          // cutoff, otherwise turning drift off snaps back to the pre-drift value.
          (node as any).driftOriginalCenter = freq;
        }
      } else if (filter && !filter.disposed) {
        glideParam(filter.frequency, freq);
      }
    },
    setLayerFilterResonance: (node, q) => {
      const filter = (node as any).filter;
      if (filter && !filter.disposed) {
        glideParam(filter.Q, q);
      }
    },
    setProbability: (node, probability) => {
      const state = (node as any).gateState;
      if (state) state.probability = probability;
    },
    setLayerDrift: (node, enabled, periodMinutes) => {
      // Clear any existing drift interval and restore original LFO center
      const existingInterval = (node as any).driftInterval;
      if (existingInterval) {
        clearInterval(existingInterval);
        (node as any).driftInterval = null;
      }
      const lfo = (node as any).lfo;
      const originalCenter = (node as any).driftOriginalCenter;
      if (lfo && !lfo.disposed && originalCenter != null) {
        const swing = lfo.max - lfo.min;
        lfo.min = Math.max(100, originalCenter - swing / 2);
        lfo.max = Math.min(18000, originalCenter + swing / 2);
        (node as any).driftOriginalCenter = null;
      }

      if (!enabled || !lfo || lfo.disposed) return;

      // Drift the LFO's center frequency — not volume, so no clipping risk.
      // The musical sweep continues at its own rate; the centre slowly travels
      // to brighter or darker territory and back over the drift period.
      const currentMid = (lfo.min + lfo.max) / 2;
      (node as any).driftOriginalCenter = currentMid;
      // Store mutable drift params on the node so setLayerFilterCutoff can
      // update them without restarting the interval (fixes snap-back bug).
      (node as any).driftCenter = currentMid;
      (node as any).driftRange  = currentMid * 0.6;

      const periodMs = periodMinutes * 60 * 1000;
      const tickMs = 200;
      const phaseIncrement = (2 * Math.PI * tickMs) / periodMs;
      let driftPhase = Math.random() * Math.PI * 2; // random start per layer

      const interval = setInterval(() => {
        if (lfo.disposed) { clearInterval(interval); return; }
        driftPhase += phaseIncrement;
        // Read from mutable node properties so user filter changes are respected
        const activeMid   = (node as any).driftCenter as number;
        const activeRange = (node as any).driftRange  as number;
        const activeSwing = lfo.max - lfo.min;
        const newMid  = activeMid + Math.sin(driftPhase) * activeRange;
        const clamped = Math.max(200, Math.min(15000, newMid));
        lfo.min = Math.max(100,   clamped - activeSwing / 2);
        lfo.max = Math.min(18000, clamped + activeSwing / 2);
      }, tickMs);

      (node as any).driftInterval = interval;
    },
    setWarmth: (value) => {
      if (masterSaturation.current && !masterSaturation.current.disposed) {
        glideParam(masterSaturation.current.wet, value);
      }
    },
    setShimmer: (value) => {
      if (fxBus.current?.shimmerGain && !fxBus.current.shimmerGain.disposed) {
        glideParam(fxBus.current.shimmerGain.gain, value);
        feedFxBranch('shimmer', value > 0);
      }
    },
    setFreqShift: (value) => {
      if (fxBus.current?.freqShiftGain && !fxBus.current.freqShiftGain.disposed) {
        glideParam(fxBus.current.freqShiftGain.gain, value);
        feedFxBranch('freqShift', value > 0);
      }
    },
    setConvolverMix: (value) => {
      if (fxBus.current?.crossFade && !fxBus.current.crossFade.disposed) {
        glideParam(fxBus.current.crossFade.fade, value);
        feedFxBranch('convolver', value > 0);
      }
    },
    setBreatheEnabled: (enabled, periodMinutes) => {
      // Tear down any existing LFO first
      if (masterBreatheLFO.current && !masterBreatheLFO.current.disposed) {
        masterBreatheLFO.current.stop().dispose();
        masterBreatheLFO.current = null;
      }
      if (!masterGain.current || masterGain.current.disposed) return;

      if (enabled) {
        // Free-running (not transport-synced) sine LFO — period in seconds
        const periodSeconds = periodMinutes * 60;
        const lfo = new Tone.LFO({
          frequency: 1 / periodSeconds,
          min: 0.65,
          max: 1.0,
          type: 'sine',
        });
        lfo.connect(masterGain.current.gain);
        lfo.start();
        masterBreatheLFO.current = lfo;
      } else {
        // Restore unity gain immediately
        masterGain.current.gain.value = 1;
      }
    },
    setDelayFeedback: (value) => {
        if (fxBus.current?.delay && !fxBus.current.delay.disposed) {
            glideParam(fxBus.current.delay.feedback, value);
        }
    },
    setDelayTime: (value) => {
      if (fxBus.current?.delay && !fxBus.current.delay.disposed) {
        fxBus.current.delay.delayTime.value = value;
      }
    },
    setDelayCutoff: (value) => {
        if (fxBus.current?.delayFilter && !fxBus.current.delayFilter.disposed) {
            glideParam(fxBus.current.delayFilter.frequency, value);
        }
    },
    setReverbDecay: (value) => {
        if (fxBus.current?.reverb && !fxBus.current.reverb.disposed) {
            fxBus.current.reverb.decay = value;
        }
    },
    setReverbWet: (value) => {
        if (fxBus.current?.reverb && !fxBus.current.reverb.disposed) {
            glideParam(fxBus.current.reverb.wet, value);
        }
    },
    setBPM: (bpm) => {
      if (Tone.Transport) {
        Tone.Transport.bpm.value = bpm;
      }
    },
    getBPM: () => {
      return Tone.Transport?.bpm.value || 120;
    },
    setLofi: (amount) => {
      const crush = masterBitcrusher.current;
      if (crush && !crush.disposed) {
        if (amount > 0) crush.bits.value = Math.max(1, Math.round(16 - amount * 12));
        setMasterTailStage('lofi', crush.wet, Math.min(1, Math.max(0, amount)));
      }
    },
    setWarble: (amount) => {
      const warble = masterWarble.current;
      if (warble && !warble.disposed) {
        setMasterTailStage('warble', warble.wet, Math.max(0, amount) * 0.6);
      }
    },
    startDroneLoop: (keyRoot = null, scale) => {
      if (!masterBus.current || !fxBus.current) return null;
      Tone.start();
      const r = rngRef.current ?? Math.random;

      const fundamentalChoices = [30, 37, 40, 49, 55, 65, 73, 80, 110];
      const pick = r();
      let fundamental = fundamentalChoices[Math.floor(pick * fundamentalChoices.length)];
      if (keyRoot != null) {
        // Root in octave 1 and 2 (C1 = MIDI 24), kept inside the same 30–110Hz
        // sub/low-mid band as the free choices. Partials are harmonic, so the
        // drone then sits on the key's root + 5th (+ major 3rd for partial 5).
        const pc = ((keyRoot % 12) + 12) % 12;
        const inKey = [24 + pc, 36 + pc]
          .map((midi) => 440 * Math.pow(2, (midi - 69) / 12))
          .filter((hz) => hz >= 30 && hz <= 110);
        if (inKey.length) fundamental = Math.round(inKey[Math.floor(pick * inKey.length)] * 100) / 100;
      }

      const partialSets = [[1, 2, 3], [1, 2, 5], [1, 3, 5], [1, 2, 3, 5], [2, 3, 5]];
      // Partial 5 is a just major 3rd — it rubs against the minor 3rd in these
      // modes, so swap it for 4 (another octave of the root). Same RNG draw.
      const minorModes: ScaleName[] = ['naturalMinor', 'minorPentatonic', 'blues', 'dorian'];
      const avoidMajorThird = scale != null && minorModes.includes(scale);
      const partials = partialSets[Math.floor(r() * partialSets.length)]
        .map((p) => (avoidMajorThird && p === 5 ? 4 : p));

      const outputGain = new Tone.Gain(0);

      const oscillators: Tone.Oscillator[] = [];
      const oscGains: Tone.Gain[] = [];

      partials.forEach((partial) => {
        const freq = fundamental * partial;
        const detuneCents = r() * 6 - 3;
        const waveformType: Tone.ToneOscillatorType = r() < 0.5 ? 'sine' : 'triangle';

        const osc = new Tone.Oscillator({ type: waveformType, frequency: freq, detune: detuneCents });
        osc.start();

        const partialWeight = 1 / Math.sqrt(partial);
        const oscGain = new Tone.Gain(partialWeight / partials.length);

        osc.connect(oscGain);
        oscGain.connect(outputGain);

        oscillators.push(osc);
        oscGains.push(oscGain);
      });

      const filterFreq = fundamental * (3 + r() * 3);
      const filter = new Tone.Filter(filterFreq, 'lowpass', -12);
      filter.Q.value = 0.5 + r() * 1.5;

      const lfoFreq = 0.003 + r() * 0.012;
      const lfo = new Tone.LFO({ type: 'sine', frequency: lfoFreq, min: filterFreq * 0.5, max: filterFreq * 2 }).start();
      lfo.connect(filter.frequency);

      const ampLFO = new Tone.LFO({ frequency: 0.02 + r() * 0.06, min: 0.75, max: 1.0 }).start();
      const ampGain = new Tone.Gain(1);
      ampLFO.connect(ampGain.gain);

      const hpf = new Tone.Filter(fundamental * 0.7, 'highpass');

      const panner = new Tone.AutoPanner({ frequency: 0.02 + r() * 0.04, depth: 0.15 + r() * 0.2, wet: 0.5 }).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.fxInput);
      const waveform = new Tone.Waveform(1024);

      outputGain.chain(filter, ampGain, hpf, panner, masterBus.current);
      outputGain.connect(sendGain);
      outputGain.connect(waveform);

      outputGain.gain.rampTo(Tone.dbToGain(-18), 6);

      if (Tone.Transport.state !== 'started') Tone.Transport.start();

      const partialNames = partials.map((p) => `${p}×`).join(', ');
      const info: DroneLayerInfo = {
        type: 'drone',
        description: `${keyRoot != null ? `${KEY_NAMES[((keyRoot % 12) + 12) % 12]} · ` : ''}${fundamental}Hz · partials [${partialNames}] · ${(lfoFreq * 60).toFixed(1)} cpm filter`,
      };

      (outputGain as any).oscillators = oscillators;
      (outputGain as any).oscGains = oscGains;
      (outputGain as any).filter = filter;
      (outputGain as any).lfo = lfo;
      (outputGain as any).ampLFO = ampLFO;
      (outputGain as any).ampGain = ampGain;
      (outputGain as any).hpf = hpf;
      (outputGain as any).panner = panner;
      (outputGain as any).sendGain = sendGain;
      (outputGain as any).waveform = waveform;

      return { node: outputGain, info };
    },
    stopDroneLoop: (node) => {
      const oscillators = (node as any).oscillators as Tone.Oscillator[] | undefined;
      const oscGains = (node as any).oscGains as Tone.Gain[] | undefined;
      const filter = (node as any).filter as Tone.Filter | undefined;
      const lfo = (node as any).lfo as Tone.LFO | undefined;
      const ampLFO = (node as any).ampLFO as Tone.LFO | undefined;
      const ampGain = (node as any).ampGain as Tone.Gain | undefined;
      const hpf = (node as any).hpf as Tone.Filter | undefined;
      const panner = (node as any).panner as Tone.AutoPanner | undefined;
      const sendGain = (node as any).sendGain as Tone.Gain | undefined;
      const waveform = (node as any).waveform as Tone.Waveform | undefined;

      oscillators?.forEach((osc) => { if (!osc.disposed) { osc.stop(); osc.dispose(); } });
      oscGains?.forEach((g) => { if (!g.disposed) g.dispose(); });
      if (lfo && !lfo.disposed) { lfo.stop(); lfo.dispose(); }
      if (ampLFO && !ampLFO.disposed) { ampLFO.stop(); ampLFO.dispose(); }
      if (ampGain && !ampGain.disposed) ampGain.dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (hpf && !hpf.disposed) hpf.dispose();
      if (panner && !panner.disposed) { panner.stop(); panner.dispose(); }
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (!node.disposed) node.dispose();
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
