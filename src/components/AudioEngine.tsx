
'use client';

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import * as Tone from 'tone';

export type AudioEngineHandle = {
  startSynthLoop: () => Tone.Sequence | null;
  stopSynthLoop: (synth: Tone.Sequence) => void;
  startFreesoundLoop: (url: string) => Promise<Tone.Player | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
  startMelodicLoop: () => Tone.Sequence | null;
  stopMelodicLoop: (sequence: Tone.Sequence) => void;
  setVolume: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth, volume: number) => void;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  useEffect(() => {
    // Apply a limiter to the master output to prevent clipping, only on the client
    const limiter = new Tone.Limiter(-6).toDestination();
    Tone.Destination.chain(limiter);

    return () => {
      // Cleanup global effects if any
      Tone.Destination.disconnect();
      limiter.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startSynthLoop: () => {
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
        decay: Math.random() * 6 + 4, // Longer decay
        wet: Math.random() * 0.5 + 0.4, // More wet
        preDelay: Math.random() * 0.3,
      }).toDestination();
      
      const delay = new Tone.FeedbackDelay({
        delayTime: ['2n', '1m'][Math.floor(Math.random() * 2)],
        feedback: Math.random() * 0.5 + 0.2,
        wet: Math.random() * 0.4 + 0.2,
      }).connect(reverb);

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: randomOscillatorType,
          count: 3,
          spread: Math.random() * 40 + 20,
        },
        envelope: {
          attack: Math.random() * 5 + 3, // Slower attack
          decay: 0.1,
          sustain: 0.9,
          release: Math.random() * 6 + 5, // Slower release
        },
        volume: 0, // Start at 0 volume
      }).connect(delay);
      
      const scale = ['C3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4'];
      const notesAndChords = [
        scale[Math.floor(Math.random() * scale.length)],
        [scale[0], scale[2], scale[4]], // C Major chord
        scale[Math.floor(Math.random() * scale.length)],
        null, // Rest
        [scale[1], scale[3], scale[5]], // A minor chord (relative minor)
        scale[Math.floor(Math.random() * scale.length)],
        null, // Rest
      ];

      // Shuffle and pick 2-4 events
      const sequenceEvents = notesAndChords
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 3) + 2);

      const sequence = new Tone.Sequence(
        (time, note) => {
          synth.triggerAttackRelease(note, '4m', time);
        },
        sequenceEvents,
        '2m' // Each event happens every two measures
      );
      
      sequence.loop = true;
      sequence.start(0);
      Tone.Transport.start();

      (sequence as any).synth = synth; // Associate synth for cleanup and volume
      
      return sequence;
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      if (synth && !synth.disposed) {
        synth.releaseAll();
        // Disconnect and dispose of the synth and its effects after the release has had time to fade out
        setTimeout(() => {
          if (!synth.disposed) {
            synth.dispose();
          }
        }, 3000); // Wait 3 seconds for release to complete
      }
      sequence.stop();
      sequence.dispose();
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

      (sequence as any).synth = synth;

      return sequence;
    },
    stopMelodicLoop: (sequence) => {
      const synth = (sequence as any).synth;
      if (synth && !synth.disposed) {
        synth.releaseAll();
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
            node.volume.value = volume;
        }
      }
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
