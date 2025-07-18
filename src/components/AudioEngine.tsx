'use client';

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  startSynthPad: () => Tone.PolySynth | null;
  stopSynth: (synth: Tone.PolySynth) => void;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  useEffect(() => {
    // This effect can be used for global audio setup if needed
    return () => {
      // Cleanup global effects if any
    };
  }, []);

  const createRandomSynth = () => {
    // Ensure Tone.js is started by a user interaction
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
      'C3',
      'D3',
      'E3',
      'G3',
      'A3',
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
      'C5',
    ];
    const randomNote = notes[Math.floor(Math.random() * notes.length)];

    synth.triggerAttack(randomNote);

    return synth;
  };

  useImperativeHandle(ref, () => ({
    startSynthPad: () => {
      return createRandomSynth();
    },
    stopSynth: (synth) => {
      synth.triggerRelease();
      // Use onsilence for robust cleanup
      synth.onsilence = () => {
        synth.dispose();
      };
      // Fallback disposal
      setTimeout(
        () => {
          if (!synth.disposed) {
            synth.dispose();
          }
        },
        (synth.get().envelope.release as number) * 1000 + 1000
      );
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
