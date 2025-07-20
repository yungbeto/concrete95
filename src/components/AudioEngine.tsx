
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

  if (typeof window !== 'undefined' && !masterLimiter.current) {
    masterLimiter.current = new Tone.Limiter(-6).toDestination();
    const delay = new Tone.FeedbackDelay({
      delayTime: '4n',
      feedback: 0.6,
      wet: 0.8,
    });
    const reverb = new Tone.Reverb({
      decay: 10,
      preDelay: 0.05,
      wet: 0.9,
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
        'fatsquare',
        'fattriangle',
        'fatsine',
        'square',
        'triangle',
        'sine',
      ];
      const randomOscillatorType =
        oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];

      const filter = new Tone.Filter(Math.random() * 1500 + 500, 'lowpass').connect(masterLimiter.current);

      const lfoFilter = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.05,
        min: 200,
        max: 2500,
      }).connect(filter.frequency).start();
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: randomOscillatorType,
        },
        envelope: {
          attack: Math.random() * 5 + 3,
          decay: 0.1,
          sustain: 0.9,
          release: Math.random() * 6 + 5,
        },
        volume: -12,
      });

      const waveform = new Tone.Waveform(1024);
      synth.connect(filter);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scale = ['C2', 'E2', 'G2', 'A2', 'C3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4'];
      const notesAndChords = [
        scale[Math.floor(Math.random() * scale.length)],
        [scale[0], scale[2], scale[4]],
        scale[Math.floor(Math.random() * scale.length)],
        null,
        [scale[1], scale[3], scale[5]],
        scale[Math.floor(Math.random() * scale.length)],
        null,
      ];

      const sequenceEvents = notesAndChords
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 3) + 2);

      const sequence = new Tone.Sequence(
        (time, note) => {
           if (note) {
            synth.triggerAttackRelease(note, '4m', time);
          }
        },
        sequenceEvents,
        '2m'
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

      const filter = new Tone.Filter({
        frequency: Math.random() * 1000 + 800,
        type: 'lowpass',
        Q: Math.random() * 2 + 1,
      });

      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.3 + 0.1,
        min: filter.frequency.value * 0.8,
        max: filter.frequency.value * 1.2,
      }).connect(filter.frequency).start();

      const reverb = new Tone.Reverb({
        decay: Math.random() * 4 + 1,
        wet: Math.random() * 0.4 + 0.1,
      });

      const delay = new Tone.FeedbackDelay({
        delayTime: ['8n', '4n', '16n', '8t', '16t'][Math.floor(Math.random() * 5)],
        feedback: Math.random() * 0.6 + 0.1,
        wet: Math.random() * 0.5 + 0.1,
      }).chain(filter, reverb, masterLimiter.current);
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synthTypes = ['fm', 'am', 'mono', 'default', 'pluck'];
      const randomSynthType = synthTypes[Math.floor(Math.random() * synthTypes.length)];

      let synth;
      switch (randomSynthType) {
        case 'fm':
          synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: Math.random() * 2 + 0.5,
            modulationIndex: Math.random() * 10 + 2,
            envelope: { attack: 0.01, release: 1.5 },
            modulationEnvelope: { attack: 0.05, release: 1 },
          });
          break;
        case 'am':
          synth = new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: Math.random() * 2 + 0.5,
            envelope: { attack: 0.01, release: 1.5 },
            modulationEnvelope: { attack: 0.05, release: 1 },
          });
          break;
        case 'mono':
            synth = new Tone.PolySynth(Tone.MonoSynth, {
                oscillator: { type: "sawtooth" },
                filter: { Q: Math.random() * 2 + 1 },
                envelope: { attack: 0.01, release: 1 },
                filterEnvelope: { attack: 0.02, baseFrequency: 200, octaves: 3 }
            });
            break;
        case 'pluck':
            synth = new Tone.PluckSynth({
                attackNoise: Math.random() * 0.5 + 0.1,
                dampening: Math.random() * 1000 + 3000,
                resonance: Math.random() * 0.2 + 0.7,
            });
            break;
        default:
          const oscillatorTypes: Tone.ToneOscillatorType[] = ['triangle', 'sine', 'sawtooth'];
          synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)] },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 },
          });
          break;
      }
      synth.volume.value = -18;
      
      const waveform = new Tone.Waveform(1024);
      synth.connect(delay);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scales = {
        minorPentatonic: ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4'],
        majorPentatonic: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
        blues: ['C3', 'Eb3', 'F3', 'F#3', 'G3', 'Bb3', 'C4'],
        chromatic: ['C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3']
      };
      const scaleKeys = Object.keys(scales);
      const currentScale = scales[scaleKeys[Math.floor(Math.random() * scaleKeys.length)] as keyof typeof scales];
      
      const noteDurations = ['4n', '8n', '16n', '2n', '1m'];
      const sequenceLength = Math.floor(Math.random() * 8) + 4;
      const sequenceEvents = Array.from({ length: sequenceLength }, () => {
        if (Math.random() < 0.3) {
            return null;
        }
        if (Math.random() < 0.1 && synth instanceof Tone.PolySynth) {
            const rootNoteIndex = Math.floor(Math.random() * (currentScale.length - 2));
            return [currentScale[rootNoteIndex], currentScale[rootNoteIndex + 2]];
        }
        return currentScale[Math.floor(Math.random() * currentScale.length)];
      });
      const sequenceInterval = noteDurations[Math.floor(Math.random() * noteDurations.length)];

      const sequence = new Tone.Sequence(
        (time, note) => {
          if (note) {
            if (synth instanceof Tone.PluckSynth) {
                synth.triggerAttack(note as string, time);
            } else {
                synth.triggerAttackRelease(note, '8n', time);
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
      (sequence as any).effects = { delay, reverb };
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
      const filter = (sequence as any).filter;
      const effects = (sequence as any).effects;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;
      
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (effects) {
        if (effects.delay && !effects.delay.disposed) effects.delay.dispose();
        if (effects.reverb && !effects.reverb.disposed) effects.reverb.dispose();
      }
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
