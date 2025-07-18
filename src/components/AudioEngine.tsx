'use client';

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  playSynthPad: () => void;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  const [synth, setSynth] = useState<Tone.PolySynth | null>(null);

  useEffect(() => {
    const reverb = new Tone.Reverb({
        decay: 4,
        wet: 0.5,
        preDelay: 0.1,
    }).toDestination();

    const synthInstance = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            type: 'fatsawtooth',
            count: 3,
            spread: 30,
        },
        envelope: {
            attack: 0.5,
            decay: 0.1,
            sustain: 0.5,
            release: 1,
        },
    }).connect(reverb);
    
    setSynth(synthInstance);

    return () => {
        synthInstance.dispose();
        reverb.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    playSynthPad: () => {
      if (synth) {
        // Ensure Tone.js is started
        Tone.start();
        
        // Play a random note from a C major pentatonic scale
        const notes = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        synth.triggerAttackRelease(randomNote, '2n');
      }
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
