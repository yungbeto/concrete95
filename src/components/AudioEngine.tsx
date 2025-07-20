
'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  startSynthLoop: () => Tone.Sequence | null;
  stopSynthLoop: (synth: Tone.Sequence) => void;
  startFreesoundLoop: (url: string) => Promise<Tone.Player | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
  startMelodicLoop: () => Tone.Sequence | null;
  stopMelodicLoop: (sequence: Tone.Sequence) => void;
  setVolume: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence, volume: number) => void;
  setSendAmount: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence, amount: number) => void;
  setPlaybackRate: (node: Tone.Player, rate: number) => void;
  disposeAll: () => void;
  getWaveform: (node: Tone.Player | Tone.Sequence) => Float32Array | null;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const fxBus = useRef<{ delay: Tone.FeedbackDelay, reverb: Tone.Reverb } | null>(null);
  const sessionScale = useRef<string[]>([]);

  // Initialize a single scale for the entire session
  if (typeof window !== 'undefined' && sessionScale.current.length === 0) {
      const scales = {
          minorPentatonic: ['C', 'Eb', 'F', 'G', 'Bb'],
          majorPentatonic: ['C', 'D', 'E', 'G', 'A'],
          dorian: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
          mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
          egyptian: ['C', 'D', 'F', 'G', 'Bb'],
      };
      const scaleKeys = Object.keys(scales);
      const rootNote = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)];
      const selectedScaleName = scaleKeys[Math.floor(Math.random() * scaleKeys.length)] as keyof typeof scales;
      const baseScale = scales[selectedScaleName];
      
      const octaves = ['2', '3', '4'];
      const fullScale: string[] = [];
      octaves.forEach(octave => {
          baseScale.forEach(note => {
              fullScale.push(Tone.Frequency(note + octave).transpose(Tone.Frequency(rootNote).toMidi() - Tone.Frequency('C3').toMidi()).toNote());
          });
      });
      sessionScale.current = fullScale;
  }

  if (typeof window !== 'undefined' && !masterLimiter.current) {
    masterLimiter.current = new Tone.Limiter(-6).toDestination();
    const delay = new Tone.FeedbackDelay({
      delayTime: '4n',
      feedback: 0.5,
      wet: 0.5,
    });
    const reverb = new Tone.Reverb({
      decay: 8,
      preDelay: 0.02,
      wet: 0.7,
    });
    delay.chain(reverb, masterLimiter.current);
    fxBus.current = { delay, reverb };
  }

  useEffect(() => {
    return () => {
      masterLimiter.current?.dispose();
      masterLimiter.current = null;
      fxBus.current?.delay.dispose();
      fxBus.current?.reverb.dispose();
      fxBus.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    disposeAll: () => {
        Tone.Transport.stop();
        Tone.Transport.cancel();
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
    startSynthLoop: () => {
      if (!masterLimiter.current || !fxBus.current) return null;
      Tone.start();

      const oscillatorTypes: Tone.ToneOscillatorType[] = [
        'fatsine',
        'fattriangle',
        'fatsawtooth',
      ];
      const randomOscillatorType =
        oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];

      const filter = new Tone.Filter(Math.random() * 1000 + 400, 'lowpass').connect(masterLimiter.current);

      const lfoFilter = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.05,
        min: 200,
        max: 1500,
      }).connect(filter.frequency).start();
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: randomOscillatorType,
        },
        envelope: {
          attack: Math.random() * 4 + 4, // Slower attack
          decay: 0.2,
          sustain: 0.8,
          release: Math.random() * 5 + 5, // Slower release
        },
        volume: -18,
      });

      const waveform = new Tone.Waveform(1024);
      synth.connect(filter);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scale = sessionScale.current;
      const getChord = () => {
          const rootIndex = Math.floor(Math.random() * (scale.length - 4));
          return [scale[rootIndex], scale[rootIndex+2], scale[rootIndex+4]];
      }

      const notesAndChords = [
        getChord(),
        null,
        getChord(),
        getChord(),
        null,
        getChord(),
        null,
      ];

      const sequenceEvents = notesAndChords
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 2) + 2);

      const sequence = new Tone.Sequence(
        (time, note) => {
           if (note) {
            synth.triggerAttackRelease(note, '8m', time);
          }
        },
        sequenceEvents,
        '4m' // Longer interval for pads
      );
      
      sequence.loop = true;
      sequence.start(0);

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfoFilter;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;
      
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      return sequence;
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;

      if (lfo && !lfo.disposed) lfo.stop().dispose();
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
    startFreesoundLoop: async (url) => {
      if (!masterLimiter.current || !fxBus.current) return null;
      await Tone.start();

      const filter = new Tone.Filter(Math.random() * 1000 + 400, 'lowpass').connect(masterLimiter.current);
      
      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.2 + 0.01,
        min: 400,
        max: 2000,
      }).connect(filter.frequency).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const player = new Tone.Player({
        url: url,
        loop: true,
        fadeOut: 1,
        volume: -12,
        playbackRate: 1,
      });

      const waveform = new Tone.Waveform(1024);
      player.connect(filter);
      player.connect(sendGain);
      player.connect(waveform);
      
      await Tone.loaded();
      
      const duration = player.buffer.duration;
      const minLoopDuration = 0.5;
      const maxLoopDuration = 3.5;

      if (duration > minLoopDuration) {
        const effectiveMaxLoopDuration = Math.min(duration, maxLoopDuration);
        const loopDuration = Math.random() * (effectiveMaxLoopDuration - minLoopDuration) + minLoopDuration;
        const maxStartTime = duration - loopDuration;
        const startTime = Math.random() * maxStartTime;

        player.loopStart = startTime;
        player.loopEnd = startTime + loopDuration;
      }
      
      player.start();
      
      (player as any).lfo = lfo;
      (player as any).sendGain = sendGain;
      (player as any).waveform = waveform;

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      return player;
    },
    stopFreesoundLoop: (player) => {
      const lfo = (player as any).lfo;
      const sendGain = (player as any).sendGain;
      const waveform = (player as any).waveform;

      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (player && !player.disposed) {
        if (Tone.Transport.state === 'started' && player.state === 'started') player.stop();
        player.dispose();
      }
    },
    startMelodicLoop: () => {
      if (!masterLimiter.current || !fxBus.current) return null;
      Tone.start();

      const reverb = new Tone.Reverb({
        decay: Math.random() * 3 + 2,
        wet: Math.random() * 0.3 + 0.2,
      });

      const delay = new Tone.FeedbackDelay({
        delayTime: ['8n', '4n.', '16n'][Math.floor(Math.random() * 3)],
        feedback: Math.random() * 0.4 + 0.2,
        wet: Math.random() * 0.4 + 0.2,
      }).chain(reverb, masterLimiter.current);
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synthTypes = ['fm', 'pluck', 'default'];
      const randomSynthType = synthTypes[Math.floor(Math.random() * synthTypes.length)];

      let synth;
      switch (randomSynthType) {
        case 'fm':
          synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1.5,
            modulationIndex: 8,
            envelope: { attack: 0.01, release: 1 },
            modulationEnvelope: { attack: 0.05, release: 0.8 },
          });
          break;
        case 'pluck':
            synth = new Tone.PolySynth(Tone.PluckSynth, {
                attackNoise: 0.8,
                dampening: 3000,
                resonance: 0.9,
                release: 1.5,
            });
            break;
        default:
          synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
          });
          break;
      }
      synth.volume.value = -18;
      
      const waveform = new Tone.Waveform(1024);
      synth.connect(delay);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const currentScale = sessionScale.current;
      
      const noteDurations = ['8n', '16n', '4n'];
      const sequenceLength = Math.floor(Math.random() * 8) + 8;
      const sequenceEvents = Array.from({ length: sequenceLength }, () => {
        if (Math.random() < 0.35) {
            return null; // Add rests for more musicality
        }
        return currentScale[Math.floor(Math.random() * currentScale.length)];
      });
      const sequenceInterval = noteDurations[Math.floor(Math.random() * noteDurations.length)];

      const sequence = new Tone.Sequence(
        (time, note) => {
          if (note) {
            const vel = Math.random() * 0.5 + 0.5; // velocity
            synth.triggerAttackRelease(note, '16n', time, vel);
          }
        },
        sequenceEvents,
        sequenceInterval
      );

      sequence.loop = true;
      sequence.start(0);

      (sequence as any).synth = synth;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      return sequence;
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;
      
      if (lfo && !lfo.disposed) lfo.stop().dispose();
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
    setVolume: (node, volume) => {
      if (node && !node.disposed) {
        if (node instanceof Tone.Sequence) {
          const synth = (node as any).synth;
          if (synth && !synth.disposed) {
             synth.volume.value = volume;
          }
        } else {
            (node as Tone.Player | Tone.PolySynth | Tone.PluckSynth).volume.value = volume;
        }
      }
    },
    setSendAmount: (node, amount) => {
      if (node && !node.disposed) {
        const sendGain = (node as any).sendGain;
        if (sendGain && !sendGain.disposed) {
          const gainValue = amount > -40 ? Tone.dbToGain(amount) : 0;
          sendGain.gain.value = gainValue;
        }
      }
    },
    setPlaybackRate: (node, rate) => {
      if (node instanceof Tone.Player && !node.disposed) {
        node.playbackRate = rate;
      }
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
