
'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Tone from 'tone';

export type SynthLayerInfo = {
  type: 'synth' | 'melodic';
  description: string;
};

export type FreesoundLayerInfo = {
  type: 'freesound';
  id: number;
  name: string;
  description: string;
};

const scales = {
  random: [],
  major: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'],
  naturalMinor: ['C2', 'D2', 'Eb2', 'F2', 'G2', 'Ab2', 'Bb2', 'C3', 'D3', 'Eb3', 'F3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'Ab5', 'Bb5'],
  minorPentatonic: ['C2', 'Eb2', 'F2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5', 'Eb5', 'F5', 'G5', 'Bb5'],
  majorPentatonic: ['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'],
  blues: ['C2', 'Eb2', 'F2', 'F#2', 'G2', 'Bb2', 'C3', 'Eb3', 'F3', 'F#3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'F#4', 'G4', 'Bb4', 'C5', 'Eb5', 'F5', 'F#5', 'G5', 'Bb5'],
  chromatic: ['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'],
  dorian: ['C2', 'D2', 'Eb2', 'F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'Eb3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
  mixolydian: ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
};

export type ScaleName = keyof typeof scales;

export const scaleNames = Object.keys(scales) as ScaleName[];


export type AudioEngineHandle = {
  startSynthLoop: (scale?: ScaleName) => {
    sequence: Tone.Sequence;
    info: SynthLayerInfo;
  } | null;
  stopSynthLoop: (synth: Tone.Sequence) => void;
  startFreesoundLoop: (
    sound: { id: number; name: string; previewUrl: string }
  ) => Promise<{ player: Tone.Player; info: FreesoundLayerInfo } | null>;
  stopFreesoundLoop: (player: Tone.Player) => void;
  startMelodicLoop: (scale?: ScaleName) => {
    sequence: Tone.Sequence;
    info: SynthLayerInfo;
  } | null;
  stopMelodicLoop: (sequence: Tone.Sequence) => void;
  setVolume: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence, volume: number) => void;
  setSendAmount: (node: Tone.Player | Tone.PolySynth | Tone.PluckSynth | Tone.Sequence, amount: number) => void;
  setPlaybackRate: (node: Tone.Player, rate: number) => void;
  setDelayFeedback: (value: number) => void;
  setReverbDecay: (value: number) => void;
  setBPM: (bpm: number) => void;
  getBPM: () => number;
  disposeAll: () => void;
  getWaveform: (node: Tone.Player | Tone.Sequence) => Float32Array | null;
};

const AudioEngine = forwardRef<AudioEngineHandle, {}>((props, ref) => {
  const masterLimiter = useRef<Tone.Limiter | null>(null);
  const fxBus = useRef<{ delay: Tone.FeedbackDelay, reverb: Tone.Reverb } | null>(null);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized.current) {
        masterLimiter.current = new Tone.Limiter(-6).toDestination();
        Tone.Transport.bpm.value = Math.floor(Math.random() * (100 - 60 + 1)) + 60;
        
        const delay = new Tone.FeedbackDelay({
            delayTime: '4n',
            feedback: 0.6,
        });
        delay.wet.value = 0.8;

        const reverb = new Tone.Reverb({
            decay: 10,
            preDelay: 0.05,
        });
        reverb.wet.value = 0.9;

        delay.chain(reverb, masterLimiter.current);
        fxBus.current = { delay, reverb };
        isInitialized.current = true;
    }
    
    return () => {
        if (isInitialized.current) {
            masterLimiter.current?.dispose();
            fxBus.current?.delay.dispose();
            fxBus.current?.reverb.dispose();
            masterLimiter.current = null;
            fxBus.current = null;
            isInitialized.current = false;
        }
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
    startSynthLoop: (scale) => {
      if (!masterLimiter.current || !fxBus.current) return null;
      Tone.start();

      const oscillatorTypes: Tone.ToneOscillatorType[] = [
        'square',
        'triangle',
        'sawtooth',
        'sine',
      ];
      const selectedOscillator =
        oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];

      const attack = Math.random() * 2 + 1;
      const release = Math.random() * 4 + 2;

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: selectedOscillator },
        envelope: {
          attack: attack,
          decay: 0.1,
          sustain: 0.8,
          release: release,
        },
      });
      synth.volume.value = -18;
      
      const filterFreq = Math.random() * 1000 + 500;
      const filter = new Tone.Filter(filterFreq, 'lowpass', -48);
      filter.Q.value = Math.random() * 2 + 0.5;

      const lfoFreq = Math.random() * 0.4 + 0.1;
      const lfo = new Tone.LFO(lfoFreq, filter.frequency.value * 0.7, filter.frequency.value * 1.3).start();
      lfo.connect(filter.frequency);
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);
      
      const waveform = new Tone.Waveform(1024);
      synth.chain(filter, masterLimiter.current);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scaleKeys = Object.keys(scales).filter(k => k !== 'random') as Exclude<ScaleName, 'random'>[];
      let scaleName: ScaleName = scale || 'random';
      if (scaleName === 'random') {
        scaleName = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
      }
      const currentScale = scales[scaleName];
      
      const sequenceLength = Math.floor(Math.random() * 3) + 2;
      const events = Array.from({ length: sequenceLength }, () => {
        const randomValue = Math.random();
        if (randomValue < 0.2) { 
          return null;
        } else if (randomValue < 0.5) { 
          return currentScale[Math.floor(Math.random() * currentScale.length)];
        } else {
          const rootIndex = Math.floor(Math.random() * (currentScale.length - 5));
          if (rootIndex < 0) return currentScale[0];
          return [currentScale[rootIndex], currentScale[rootIndex + 2], currentScale[rootIndex + 4]];
        }
      });

      const sequence = new Tone.Sequence(
        (time, event) => {
          if (event) {
            synth.triggerAttackRelease(event as Tone.Frequency | Tone.Frequency[], '4m', time);
          }
        },
        events,
        '4m'
      );

      sequence.loop = true;
      sequence.start(0);

      (sequence as any).synth = synth;
      (sequence as any).lfo = lfo;
      (sequence as any).filter = filter;
      (sequence as any).sendGain = sendGain;
      (sequence as any).waveform = waveform;

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      
      const info: SynthLayerInfo = {
        type: 'synth',
        description: `Synth Pad (${selectedOscillator}) at ${Tone.Transport.bpm.value.toFixed(0)} BPM in ${scaleName} scale. Attack: ${attack.toFixed(1)}s, Release: ${release.toFixed(1)}s. Filter Freq: ${filterFreq.toFixed(0)}Hz modulated by LFO at ${lfoFreq.toFixed(2)}Hz.`
      };

      return { sequence, info };
    },
    stopSynthLoop: (sequence) => {
      const synth = (sequence as any).synth;
      const lfo = (sequence as any).lfo;
      const filter = (sequence as any).filter;
      const sendGain = (sequence as any).sendGain;
      const waveform = (sequence as any).waveform;
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
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
    startFreesoundLoop: async (sound) => {
      if (!masterLimiter.current || !fxBus.current) return null;
      await Tone.start();
      const player = new Tone.Player({
        url: sound.previewUrl,
        loop: true,
      });
      player.volume.value = -12;

      const filterFreq = Math.random() * 4000 + 1000;
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = Math.random() * 2 + 0.5;

      const lfoFreq = Math.random() * 0.5 + 0.1;
      const lfo = new Tone.LFO(lfoFreq, filter.frequency.value * 0.5, filter.frequency.value).start();
      lfo.connect(filter.frequency);

      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);
      const waveform = new Tone.Waveform(1024);
      player.chain(filter, masterLimiter.current);
      player.connect(sendGain);
      player.connect(waveform);
      
      await Tone.loaded();
      player.start();

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      
      (player as any).sendGain = sendGain;
      (player as any).waveform = waveform;
      (player as any).filter = filter;
      (player as any).lfo = lfo;

      const info: FreesoundLayerInfo = {
        type: 'freesound',
        id: sound.id,
        name: sound.name,
        description: `Sample loop. Filter at ${filterFreq.toFixed(0)}Hz modulated by LFO at ${lfoFreq.toFixed(2)}Hz.`
      };

      return { player, info };
    },
    stopFreesoundLoop: (player) => {
      const sendGain = (player as any).sendGain;
      const waveform = (player as any).waveform;
      const filter = (player as any).filter;
      const lfo = (player as any).lfo;
      if (lfo && !lfo.disposed) lfo.stop().dispose();
      if (filter && !filter.disposed) filter.dispose();
      if (sendGain && !sendGain.disposed) sendGain.dispose();
      if (waveform && !waveform.disposed) waveform.dispose();
      if (player && !player.disposed) {
        if (Tone.Transport.state === 'started') player.stop();
        player.dispose();
      }
    },
    startMelodicLoop: (scale) => {
      if (!masterLimiter.current || !fxBus.current) return null;
      Tone.start();

      const filterFreq = Math.random() * 2000 + 800;
      const filter = new Tone.Filter(filterFreq, 'lowpass', -24);
      filter.Q.value = Math.random() * 2 + 1;

      const lfoFreq = Math.random() * 0.5 + 0.1;
      const lfo = new Tone.LFO(lfoFreq, filter.frequency.value * 0.8, filter.frequency.value * 1.2);
      lfo.connect(filter.frequency).start();
      
      const reverbDecay = Math.random() * 4 + 1;
      const reverb = new Tone.Reverb(reverbDecay);
      reverb.wet.value = Math.random() * 0.4 + 0.1;

      const delayTimeOptions = ['8n', '4n', '16n', '8t', '16t'];
      const delayTime = delayTimeOptions[Math.floor(Math.random() * delayTimeOptions.length)];
      const delay = new Tone.FeedbackDelay(delayTime, Math.random() * 0.6 + 0.1);
      delay.wet.value = Math.random() * 0.5 + 0.1;
      delay.chain(filter, reverb, masterLimiter.current);
      
      const sendGain = new Tone.Gain(0).connect(fxBus.current.delay);

      const synthTypes = ['fm', 'am', 'mono', 'default', 'pluck'];
      const randomSynthType = synthTypes[Math.floor(Math.random() * synthTypes.length)];

      let synth: Tone.PolySynth | Tone.PluckSynth;
      let synthDescription = '';
      switch (randomSynthType) {
        case 'fm':
          const harmonicity = Math.random() * 2 + 0.5;
          const modIndex = Math.random() * 10 + 2;
          synth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: harmonicity,
            modulationIndex: modIndex,
            envelope: { attack: 0.01, release: 1.5 },
            modulationEnvelope: { attack: 0.05, release: 1 },
          });
          synthDescription = `FMSynth (h:${harmonicity.toFixed(1)}, i:${modIndex.toFixed(1)})`;
          break;
        case 'am':
          const amHarmonicity = Math.random() * 2 + 0.5;
          synth = new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: amHarmonicity,
            envelope: { attack: 0.01, release: 1.5 },
            modulationEnvelope: { attack: 0.05, release: 1 },
          });
          synthDescription = `AMSynth (h:${amHarmonicity.toFixed(1)})`;
          break;
        case 'mono':
            synth = new Tone.PolySynth(Tone.MonoSynth, {
                oscillator: { type: "sawtooth" },
                filter: { Q: Math.random() * 2 + 1 },
                envelope: { attack: 0.01, release: 1 },
                filterEnvelope: { attack: 0.02, baseFrequency: 200, octaves: 3 }
            });
            synthDescription = `MonoSynth (sawtooth)`;
            break;
        case 'pluck':
            synth = new Tone.PluckSynth({
                attackNoise: Math.random() * 0.5 + 0.1,
                dampening: Math.random() * 1000 + 3000,
                resonance: Math.random() * 0.2 + 0.7,
            });
            synthDescription = `PluckSynth`;
            break;
        default:
          const oscillatorTypes: Tone.ToneOscillatorType[] = ['triangle', 'sine', 'sawtooth'];
          const oscType = oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];
          synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: oscType },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 1 },
          });
          synthDescription = `Synth (${oscType})`;
          break;
      }
      synth.volume.value = -18;
      
      const waveform = new Tone.Waveform(1024);
      synth.connect(delay);
      synth.connect(sendGain);
      synth.connect(waveform);
      
      const scaleKeys = Object.keys(scales).filter(k => k !== 'random') as Exclude<ScaleName, 'random'>[];
      let scaleName: ScaleName = scale || 'random';
      if (scaleName === 'random') {
        scaleName = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
      }
      const currentScale = scales[scaleName];
      
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
            } else if (synth instanceof Tone.PolySynth) {
                synth.triggerAttackRelease(note as Tone.Frequency | Tone.Frequency[], '8n', time);
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

      const info: SynthLayerInfo = {
        type: 'melodic',
        description: `${synthDescription} playing at ${Tone.Transport.bpm.value.toFixed(0)} BPM in ${scaleName} scale. Filter at ${filterFreq.toFixed(0)}Hz modulated by LFO at ${lfoFreq.toFixed(2)}Hz. Delay at ${delayTime}, Reverb decay ${reverbDecay.toFixed(1)}s.`
      };

      return { sequence, info };
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
    setDelayFeedback: (value) => {
        if (fxBus.current?.delay && !fxBus.current.delay.disposed) {
            fxBus.current.delay.feedback.value = value;
        }
    },
    setReverbDecay: (value) => {
        if (fxBus.current?.reverb && !fxBus.current.reverb.disposed) {
            fxBus.current.reverb.decay = value;
        }
    },
    setBPM: (bpm) => {
      if (Tone.Transport) {
        Tone.Transport.bpm.value = bpm;
      }
    },
    getBPM: () => {
      return Tone.Transport?.bpm.value || 120;
    }
  }));

  return null;
});

AudioEngine.displayName = 'AudioEngine';
export default AudioEngine;
