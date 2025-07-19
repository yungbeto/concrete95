
'use client';

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  startSynthPad: () => Tone.PolySynth | null;
  stopSynth: (synth: Tone.PolySynth) => void;
  startFreesoundLoop: (url: string) => Promise<Tone.Player | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
  startMelodicLoop: () => Tone.Sequence | null;
  stopMelodicLoop: (sequence: Tone.Sequence) => void;
  setVolume: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth, volume: number) => void;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  useEffect(() => {
    return () => {
      // Cleanup global effects if any
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startSynthPad: () => {
      const createRandomSynth = () => {
        Tone.start();

        const oscillatorTypes: Tone.FatOscillatorType[] = [
          'fatsawtooth',
          'fatsquare',
          'fattriangle',
          'fatsine',
        ];
        const randomOscillatorType =
          oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];

        const reverb = new Tone.Reverb({
          decay: Math.random() * 5 + 2,
          wet: Math.random() * 0.3 + 0.2,
          preDelay: Math.random() * 0.2,
        }).toDestination();

        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: randomOscillatorType,
            count: 3,
            spread: Math.random() * 40 + 20,
          },
          envelope: {
            attack: Math.random() * 2 + 0.5,
            decay: 0.1,
            sustain: 0.8,
            release: Math.random() * 3 + 2,
          },
          volume: 0, // Start at 0 volume
        }).connect(reverb);

        const notes = [
          'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5',
        ];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];

        synth.triggerAttack(randomNote);

        return synth;
      };
      return createRandomSynth();
    },
    stopSynth: (synth) => {
      synth.triggerRelease();
      setTimeout(
        () => {
          if (!synth.disposed) {
            synth.dispose();
          }
        },
        (synth.get().envelope.release as number) * 1000 + 1000
      );
    },
    startFreesoundLoop: async (url) => {
      await Tone.start();
      const player = new Tone.Player({
        url: url,
        loop: true,
        fadeOut: 1,
        volume: 0, // Start at 0 volume
      }).toDestination();

      await Tone.loaded();
      const duration = player.buffer.duration;

      const minLoopDuration = 0.5;
      const maxLoopDuration = 3.5;

      if (duration > minLoopDuration) {
        // Ensure our max loop duration isn't longer than the clip itself
        const effectiveMaxLoopDuration = Math.min(duration, maxLoopDuration);

        // Calculate a random loop duration within the valid range
        const loopDuration =
          Math.random() * (effectiveMaxLoopDuration - minLoopDuration) +
          minLoopDuration;

        // Calculate a random start time, ensuring the loop fits
        const maxStartTime = duration - loopDuration;
        const startTime = Math.random() * maxStartTime;

        player.loopStart = startTime;
        player.loopEnd = startTime + loopDuration;
      }

      player.start();

      return player;
    },
    stopFreesoundLoop: (player) => {
      player.stop();
      player.dispose();
    },
    startMelodicLoop: () => {
      Tone.start();

      const reverb = new Tone.Reverb({
        decay: Math.random() * 4 + 1, // 1 to 5 seconds
        wet: Math.random() * 0.4 + 0.1, // 0.1 to 0.5
      }).toDestination();

      const delay = new Tone.FeedbackDelay({
        delayTime: ['8n', '4n', '16n'][Math.floor(Math.random() * 3)],
        feedback: Math.random() * 0.6 + 0.1, // 0.1 to 0.7
        wet: Math.random() * 0.5 + 0.1, // 0.1 to 0.6
      }).connect(reverb);
      
      const synth = new Tone.PluckSynth({
        attackNoise: 0.5,
        dampening: 4000,
        resonance: 0.8,
        release: 1,
        volume: 0,
      }).connect(delay);
      
      const scale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
      const noteDurations = ['8n', '16n', '4n', '32n'];

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

      // We associate the synth with the sequence for volume control
      (sequence as any).synth = synth;

      return sequence;
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      if (synth && !synth.disposed) {
        synth.dispose();
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
            node.volume.value = volume;
        }
      }
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
