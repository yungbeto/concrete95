
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
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  const masterLimiter = useRef<Tone.Limiter | null>(null);

  useEffect(() => {
    // Initialize the master limiter only on the client side
    if (!masterLimiter.current) {
        masterLimiter.current = new Tone.Limiter(-6).toDestination();
    }
    
    return () => {
      masterLimiter.current?.dispose();
      masterLimiter.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startSynthLoop: () => {
      if (!masterLimiter.current) return null;
      Tone.start();

      const oscillatorTypes: Tone.ToneOscillatorType[] = [
        'fatsawtooth',
        'fatsquare',
        'fattriangle',
        'fatsine',
        'sawtooth',
        'square',
        'triangle',
        'sine',
      ];
      const randomOscillatorType =
        oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];

      const reverb = new Tone.Reverb({
        decay: Math.random() * 6 + 4,
        wet: Math.random() * 0.5 + 0.4,
        preDelay: Math.random() * 0.3,
      });
      
      const delay = new Tone.FeedbackDelay({
        delayTime: ['2n', '1m'][Math.floor(Math.random() * 2)],
        feedback: Math.random() * 0.5 + 0.2,
        wet: Math.random() * 0.4 + 0.2,
      }).chain(reverb, masterLimiter.current);

      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.05, // very slow
        min: -15,
        max: 15,
      }).start();

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: randomOscillatorType,
          count: 3,
          spread: Math.random() * 40 + 20,
        },
        envelope: {
          attack: Math.random() * 5 + 3,
          decay: 0.1,
          sustain: 0.9,
          release: Math.random() * 6 + 5,
        },
        volume: -12,
      }).connect(delay);
      
      // Connect the LFO to the detune property of the PolySynth
      lfo.connect(synth.detune);

      const scale = ['C3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4'];
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
          synth.triggerAttackRelease(note, '4m', time);
        },
        sequenceEvents,
        '2m'
      );
      
      sequence.loop = true;
      sequence.start(0);
      Tone.Transport.start();

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      
      return sequence;
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
      if (synth && !synth.disposed) {
        synth.releaseAll();
        setTimeout(() => {
          if (!synth.disposed) {
            synth.dispose();
          }
        }, 3000);
      }
      sequence.stop();
      sequence.dispose();
    },
    startFreesoundLoop: async (url) => {
      if (!masterLimiter.current) return null;
      await Tone.start();

      const filter = new Tone.Filter(Math.random() * 1000 + 400, 'lowpass').connect(masterLimiter.current);
      
      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.2 + 0.01, // very slow
        min: 400,
        max: 2000,
      }).connect(filter.frequency).start();

      const player = new Tone.Player({
        url: url,
        loop: true,
        fadeOut: 1,
        volume: -12,
      }).connect(filter);

      await Tone.loaded();
      const duration = player.buffer.duration;

      const minLoopDuration = 0.5;
      const maxLoopDuration = 3.5;

      if (duration > minLoopDuration) {
        const effectiveMaxLoopDuration = Math.min(duration, maxLoopDuration);

        const loopDuration =
          Math.random() * (effectiveMaxLoopDuration - minLoopDuration) +
          minLoopDuration;

        const maxStartTime = duration - loopDuration;
        const startTime = Math.random() * maxStartTime;

        player.loopStart = startTime;
        player.loopEnd = startTime + loopDuration;
      }

      player.start();
      (player as any).lfo = lfo;

      return player;
    },
    stopFreesoundLoop: (player) => {
      const lfo = (player as any).lfo;
      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
      player.stop();
      player.dispose();
    },
    startMelodicLoop: () => {
      if (!masterLimiter.current) return null;
      Tone.start();

      const reverb = new Tone.Reverb({
        decay: Math.random() * 4 + 1,
        wet: Math.random() * 0.4 + 0.1,
      });

      const delay = new Tone.FeedbackDelay({
        delayTime: ['8n', '4n', '16n'][Math.floor(Math.random() * 3)],
        feedback: Math.random() * 0.6 + 0.1,
        wet: Math.random() * 0.5 + 0.1,
      }).chain(reverb, masterLimiter.current);
      
      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.02, // very slow
        min: 0.1,
        max: 0.6,
      }).connect(delay.wet).start();

      const synth = new Tone.PluckSynth({
        attackNoise: 0.5,
        dampening: 4000,
        resonance: Math.random() * 0.2 + 0.7, // Randomize resonance
        release: 1,
        volume: -15,
      }).connect(delay);
      
      const scale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
      const noteDurations = ['2n', '1m', '4n'];

      const sequence = new Tone.Sequence(
        (time, note) => {
          synth.triggerAttack(note, time);
        },
        [
          scale[Math.floor(Math.random() * scale.length)],
          null,
          scale[Math.floor(Math.random() * scale.length)],
          [
            scale[Math.floor(Math.random() * scale.length)],
            scale[Math.floor(Math.random() * scale.length)],
          ],
          null,
          scale[Math.floor(Math.random() * scale.length)],
        ],
        noteDurations[Math.floor(Math.random() * noteDurations.length)]
      );

      sequence.loop = true;
      sequence.start(0);
      Tone.Transport.start();

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;

      return sequence;
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
      if (synth && !synth.disposed) {
        synth.triggerRelease();
         setTimeout(() => {
          if (!synth.disposed) {
            synth.dispose();
          }
        }, 1000);
      }
      sequence.stop();
      sequence.dispose();
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
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
