
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
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const fxBus = useRef<{ delay: Tone.FeedbackDelay, reverb: Tone.Reverb } | null>(null);

  useEffect(() => {
    // Initialize the master limiter and FX bus only on the client side
    if (!masterLimiter.current) {
        masterLimiter.current = new Tone.Limiter(-6).toDestination();
    }
    if (!fxBus.current) {
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
    
    return () => {
      masterLimiter.current?.dispose();
      masterLimiter.current = null;
      fxBus.current?.delay.dispose();
      fxBus.current?.reverb.dispose();
      fxBus.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startSynthLoop: () => {
      if (!masterLimiter.current || !fxBus.current) return null;
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
      
      const filter = new Tone.Filter(Math.random() * 1500 + 500, 'lowpass').connect(delay);

      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.05, // very slow
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
      synth.connect(filter);
      synth.connect(sendGain);
      
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
           if (note) {
            synth.triggerAttackRelease(note, '4m', time);
          }
        },
        sequenceEvents,
        '2m'
      );
      
      sequence.loop = true;
      sequence.start(0);
      Tone.Transport.start();

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      (sequence as any).sendGain = sendGain;
      
      return sequence;
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const sendGain = (sequence as any).sendGain;

      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
       if (sendGain && !sendGain.disposed) {
        sendGain.dispose();
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
      if (!masterLimiter.current || !fxBus.current) return null;
      await Tone.start();

      const filter = new Tone.Filter(Math.random() * 1000 + 400, 'lowpass').connect(masterLimiter.current);
      
      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.2 + 0.01, // very slow
        min: 400,
        max: 2000,
      }).connect(filter.frequency).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const player = new Tone.Player({
        url: url,
        loop: true,
        fadeOut: 1,
        volume: -12,
      });

      player.connect(filter);
      player.connect(sendGain);

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
      (player as any).sendGain = sendGain;

      return player;
    },
    stopFreesoundLoop: (player) => {
      const lfo = (player as any).lfo;
      const sendGain = (player as any).sendGain;

      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
      if (sendGain && !sendGain.disposed) {
        sendGain.dispose();
      }
      player.stop();
      player.dispose();
    },
    startMelodicLoop: () => {
      if (!masterLimiter.current || !fxBus.current) return null;
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

      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synth = new Tone.PluckSynth({
        attackNoise: 0.5,
        dampening: 4000,
        resonance: Math.random() * 0.2 + 0.7, // Randomize resonance
        release: 1,
        volume: -15,
      });
      synth.connect(delay);
      synth.connect(sendGain);
      
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
      (sequence as any).sendGain = sendGain;

      return sequence;
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const sendGain = (sequence as any).sendGain;

      if (lfo && !lfo.disposed) {
        lfo.stop().dispose();
      }
      if (sendGain && !sendGain.disposed) {
        sendGain.dispose();
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
    setSendAmount: (node, amount) => {
      if (node && !node.disposed) {
        const sendGain = (node as any).sendGain;
        if (sendGain && !sendGain.disposed) {
          // Convert decibels to gain
          const gainValue = amount > -40 ? Tone.dbToGain(amount) : 0;
          sendGain.gain.value = gainValue;
        }
      }
    }
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
