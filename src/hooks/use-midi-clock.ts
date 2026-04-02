import { useCallback, useEffect, useRef, useState } from 'react';

const PPQN = 24;
const SMOOTH_SAMPLES = 24; // average over one beat of intervals
const SIGNAL_TIMEOUT_MS = 600; // mark as not receiving after this gap

export interface MidiPort {
  id: string;
  name: string;
}

export function useMidiClock(onBpmChange?: (bpm: number) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [ports, setPorts] = useState<MidiPort[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const [syncedBpm, setSyncedBpm] = useState<number | null>(null);
  // Increments every PPQN pulses (once per beat) — used to trigger the diode flash
  const [beatCount, setBeatCount] = useState(0);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const activeInputRef = useRef<MIDIInput | null>(null);
  const pulseTimestamps = useRef<number[]>([]);
  const pulseInBeat = useRef(0);
  const signalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePorts = useCallback((access: MIDIAccess) => {
    const list: MidiPort[] = [];
    access.inputs.forEach((input) => {
      list.push({ id: input.id, name: input.name ?? `MIDI Input ${input.id}` });
    });
    setPorts(list);
  }, []);

  // Request MIDI access once on mount
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return;
    setIsSupported(true);

    navigator.requestMIDIAccess({ sysex: false }).then((access) => {
      midiAccessRef.current = access;
      updatePorts(access);
      access.onstatechange = () => updatePorts(access);
    }).catch(() => {
      setIsSupported(false);
    });

    return () => {
      if (signalTimerRef.current) clearTimeout(signalTimerRef.current);
      if (activeInputRef.current) activeInputRef.current.onmidimessage = null;
    };
  }, [updatePorts]);

  // Attach / detach message listener when selected port changes
  useEffect(() => {
    // Detach previous
    if (activeInputRef.current) {
      activeInputRef.current.onmidimessage = null;
      activeInputRef.current = null;
    }
    setIsReceiving(false);
    setSyncedBpm(null);
    pulseTimestamps.current = [];
    pulseInBeat.current = 0;

    if (!selectedPortId || !midiAccessRef.current) return;

    const input = midiAccessRef.current.inputs.get(selectedPortId);
    if (!input) return;

    activeInputRef.current = input;

    input.onmidimessage = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const status = e.data[0];

      if (status === 0xF8) { // MIDI timing clock
        const now = performance.now();

        // Accumulate timestamps for BPM calculation
        pulseTimestamps.current.push(now);
        if (pulseTimestamps.current.length > SMOOTH_SAMPLES + 1) {
          pulseTimestamps.current.shift();
        }

        // Compute BPM once we have at least two samples
        if (pulseTimestamps.current.length >= 2) {
          let sum = 0;
          const ts = pulseTimestamps.current;
          for (let i = 1; i < ts.length; i++) sum += ts[i] - ts[i - 1];
          const avgMs = sum / (ts.length - 1);
          const bpm = Math.round((60000 / (avgMs * PPQN)) * 10) / 10;
          if (bpm > 20 && bpm < 300) {
            setSyncedBpm(bpm);
            onBpmChange?.(bpm);
          }
        }

        // Beat flash: fire once per PPQN pulses
        pulseInBeat.current = (pulseInBeat.current + 1) % PPQN;
        if (pulseInBeat.current === 0) {
          setBeatCount((c) => c + 1);
        }

        // Keep "receiving" alive
        setIsReceiving(true);
        if (signalTimerRef.current) clearTimeout(signalTimerRef.current);
        signalTimerRef.current = setTimeout(() => {
          setIsReceiving(false);
          setSyncedBpm(null);
          pulseTimestamps.current = [];
        }, SIGNAL_TIMEOUT_MS);
      }
    };
  }, [selectedPortId, onBpmChange]);

  return {
    isSupported,
    ports,
    selectedPortId,
    setSelectedPortId,
    isReceiving,
    syncedBpm,
    beatCount,
  };
}
