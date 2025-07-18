'use client';

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  startSynthPad: () => Tone.PolySynth | null;
  stopSynth: (synth: Tone.PolySynth) => void;
  startFreesoundLoop: (url: string) => Promise<Tone.Player | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
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
      synth.onsilence = () => {
        synth.dispose();
      };
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
        autostart: true,
        fadeOut: 1,
      }).toDestination();
      await Tone.loaded();
      return player;
    },
    stopFreesoundLoop: (player) => {
      player.stop();
      player.dispose();
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
