
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
  play: (node: Tone.Player | Tone.Sequence) => void;
  stop: (node: Tone.Player | Tone.Sequence) => void;
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

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfoFilter;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;
      
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
        synth.releaseAll();
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
      
      (player as any).lfo = lfo;
      (player as any).sendGain = sendGain;
      (player as any).waveform = waveform;

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
        decay: Math.random() * 4 + 1,
        wet: Math.random() * 0.4 + 0.1,
      });

      const delay = new Tone.FeedbackDelay({
        delayTime: ['8n', '4n', '16n'][Math.floor(Math.random() * 3)],
        feedback: Math.random() * 0.6 + 0.1,
        wet: Math.random() * 0.5 + 0.1,
      }).chain(reverb, masterLimiter.current);
      
      const lfo = new Tone.LFO({
        frequency: Math.random() * 0.1 + 0.02,
        min: 0.1,
        max: 0.6,
      }).connect(delay.wet).start();

      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synthTypes = [Tone.PluckSynth, Tone.FMSynth, Tone.AMSynth, Tone.DuoSynth, Tone.MonoSynth];
      const RandomSynth = synthTypes[Math.floor(Math.random() * synthTypes.length)];
      
      const synth = new RandomSynth({ volume: -15 });

      if (synth instanceof Tone.PluckSynth) {
        synth.set({
          attackNoise: 0.5,
          dampening: 4000,
          resonance: Math.random() * 0.2 + 0.7,
          release: 1,
        });
      }
      
      const waveform = new Tone.Waveform(1024);
      synth.connect(delay);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scale = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
      const noteDurations = ['2n', '1m', '4n'];

      const sequence = new Tone.Sequence(
        (time, note) => {
          synth.triggerAttackRelease(note, '8n', time);
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

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;

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
    play: (node) => {
        if (!node || node.disposed) return;

        if (node instanceof Tone.Player) {
            if (node.state !== 'started') node.start();
        } else if (node instanceof Tone.Sequence) {
            if (node.state !== 'started') node.start(0);
        }
    
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    },
    stop: (node) => {
      if (!node || node.disposed) return;
        if (node instanceof Tone.Player) {
          if (node.state === 'started') node.stop();
        } else if (node instanceof Tone.Sequence) {
          if (node.state === 'started') {
             const synth = (node as any).synth;
             if (synth && !synth.disposed && synth instanceof Tone.PolySynth) synth.releaseAll();
             node.stop();
          }
        }
    },
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
