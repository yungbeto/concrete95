'use client';

import {
  useEffect,
  useState,
  useCallback,
  type RefObject,
} from 'react';
import * as Tone from 'tone';
import type { AudioEngineHandle } from '@/components/AudioEngine';
import { isAudioDebugEnabled, audioDebugLog } from '@/lib/audio-debug';

type Props = {
  audioEngineRef: RefObject<AudioEngineHandle | null>;
  ensureAudioUnlocked: () => Promise<void>;
  layerCount: number;
  isEngineInitialized: boolean;
};

export default function AudioDebugPanel({
  audioEngineRef,
  ensureAudioUnlocked,
  layerCount,
  isEngineInitialized,
}: Props) {
  const [tick, setTick] = useState(0);
  const [lastBeep, setLastBeep] = useState<string | null>(null);
  /** Avoid SSR/client HTML mismatch: server + first client paint render null; then show panel. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !isAudioDebugEnabled()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 400);
    return () => window.clearInterval(id);
  }, [hydrated]);

  const logSnapshot = useCallback(() => {
    const dest = Tone.getDestination();
    const vol = dest?.volume;
    audioDebugLog('snapshot', {
      audioContextState: (Tone.getContext()?.rawContext as AudioContext | undefined)
        ?.state,
      sampleRate: (Tone.getContext()?.rawContext as AudioContext | undefined)
        ?.sampleRate,
      destinationVolumeDb:
        vol != null && typeof vol.value === 'number' ? vol.value : undefined,
      masterMeterDb: audioEngineRef.current?.getMasterLevel?.(),
      transport: Tone.getTransport?.()?.state,
      layerCount,
      isEngineInitialized,
    });
  }, [audioEngineRef, layerCount, isEngineInitialized]);

  const testBeepRawDestination = useCallback(async () => {
    try {
      await ensureAudioUnlocked();
      const raw = Tone.getContext().rawContext as AudioContext;
      await raw.resume();
      const osc = raw.createOscillator();
      const g = raw.createGain();
      g.gain.value = 0.12;
      osc.frequency.value = 523.25; // C5 — easy to hear
      osc.connect(g);
      g.connect(raw.destination);
      const t0 = raw.currentTime;
      osc.start(t0);
      osc.stop(t0 + 0.18);
      setLastBeep('raw destination 180ms @ 523Hz');
      audioDebugLog('testBeep: connected osc→gain→AudioContext.destination', {
        state: raw.state,
      });
      window.setTimeout(() => {
        osc.disconnect();
        g.disconnect();
      }, 300);
    } catch (e) {
      setLastBeep(`error: ${String(e)}`);
      audioDebugLog('testBeep raw failed', e);
    }
  }, [ensureAudioUnlocked]);

  const testBeepToneDestination = useCallback(async () => {
    try {
      await ensureAudioUnlocked();
      const osc = new Tone.Oscillator({ frequency: 392, type: 'sine' });
      osc.volume.value = -18;
      osc.connect(Tone.getDestination());
      osc.start();
      setLastBeep('Tone.getDestination() ~200ms @ G4');
      audioDebugLog('testBeep: Tone.Oscillator → Tone.getDestination()', {
        destinationDb: Tone.getDestination()?.volume?.value,
      });
      window.setTimeout(() => {
        osc.stop();
        osc.dispose();
      }, 220);
    } catch (e) {
      setLastBeep(`error: ${String(e)}`);
      audioDebugLog('testBeep Tone dest failed', e);
    }
  }, [ensureAudioUnlocked]);

  const testBeepMasterChain = useCallback(async () => {
    try {
      await ensureAudioUnlocked();
      audioEngineRef.current?.debugPlayThroughMasterChain?.();
      setLastBeep('master bus (raw osc→gain→bus→…→dest) ~200ms');
      audioDebugLog('debugPlayThroughMasterChain invoked');
    } catch (e) {
      setLastBeep(`error: ${String(e)}`);
      audioDebugLog('debugPlayThroughMasterChain failed', e);
    }
  }, [ensureAudioUnlocked, audioEngineRef]);

  // After all hooks — keep server HTML == first client paint (no panel until hydrated).
  if (!hydrated || !isAudioDebugEnabled()) {
    return null;
  }

  const rawCtx = Tone.getContext()?.rawContext as AudioContext | undefined;
  const ctxState = rawCtx?.state ?? '—';
  const volParam = Tone.getDestination()?.volume;
  const destVol =
    volParam != null && typeof volParam.value === 'number'
      ? volParam.value
      : NaN;
  const masterDb = audioEngineRef.current?.getMasterLevel?.() ?? null;

  return (
    <div
      className="fixed bottom-14 right-2 z-[100] max-w-[min(100vw-1rem,20rem)] rounded border border-amber-600/80 bg-black/90 px-2 py-1.5 font-mono text-[10px] text-amber-100 shadow-lg"
      data-testid="audio-debug-panel"
    >
      <div className="mb-1 font-bold text-amber-400">debugAudio</div>
      <div className="space-y-0.5 break-all">
        <div>ctx: {ctxState}</div>
        <div>
          dest:{' '}
          {destVol === -Infinity
            ? '-∞ dB'
            : Number.isFinite(destVol)
              ? `${destVol.toFixed(1)} dB`
              : '—'}
        </div>
        <div>
          master:{' '}
          {masterDb == null || !Number.isFinite(masterDb)
            ? '—'
            : `${masterDb.toFixed(1)} dB`}
        </div>
        <div>layers: {layerCount}</div>
        <div>engine: {isEngineInitialized ? 'init' : 'no'}</div>
        <div className="text-[9px] text-neutral-400">tick {tick}</div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded bg-amber-900/80 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-800"
          onClick={() => void ensureAudioUnlocked().then(logSnapshot)}
        >
          unlock+log
        </button>
        <button
          type="button"
          className="rounded bg-amber-900/80 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-800"
          onClick={logSnapshot}
        >
          log
        </button>
        <button
          type="button"
          className="rounded bg-emerald-900/80 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-800"
          onClick={() => void testBeepRawDestination()}
        >
          beep raw
        </button>
        <button
          type="button"
          className="rounded bg-emerald-900/80 px-1.5 py-0.5 text-[9px] text-emerald-100 hover:bg-emerald-800"
          onClick={() => void testBeepToneDestination()}
        >
          beep tone
        </button>
        <button
          type="button"
          className="rounded bg-sky-900/80 px-1.5 py-0.5 text-[9px] text-sky-100 hover:bg-sky-800 disabled:opacity-40"
          disabled={!isEngineInitialized}
          onClick={() => void testBeepMasterChain()}
          title="Same path as layer audio (into master limiter)"
        >
          beep master
        </button>
      </div>
      {lastBeep && (
        <div className="mt-1 text-[9px] text-neutral-400">{lastBeep}</div>
      )}
      <p className="mt-1 text-[8px] leading-tight text-neutral-500">
        Add <code className="text-neutral-400">?debugAudio=1</code> or localStorage{' '}
        <code className="text-neutral-400">concrete95:debugAudio=1</code>
      </p>
    </div>
  );
}
