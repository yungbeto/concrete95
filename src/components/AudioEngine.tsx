"use client";

import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { type SoundscapeState } from '@/lib/types';
import { getFreesoundSample } from '@/actions/freesound';
import { useToast } from "@/hooks/use-toast";

interface AudioEngineProps {
  soundscapeState: SoundscapeState | null;
}

export function AudioEngine({ soundscapeState }: AudioEngineProps) {
  const { toast } = useToast();
  const [isStarted, setIsStarted] = useState(false);
  
  const droneSynth = useRef<Tone.AMSynth | null>(null);
  const pulseSynth = useRef<Tone.FMSynth | null>(null);
  const texturePlayer = useRef<Tone.Player | null>(null);
  const reverb = useRef<Tone.Reverb | null>(null);
  const filter = useRef<Tone.Filter | null>(null);
  const lfo = useRef<Tone.LFO | null>(null);
  const pulseLoop = useRef<Tone.Loop | null>(null);

  const cleanupAudio = () => {
    droneSynth.current?.dispose();
    pulseSynth.current?.dispose();
    texturePlayer.current?.dispose();
    reverb.current?.dispose();
    filter.current?.dispose();
    lfo.current?.dispose();
    pulseLoop.current?.dispose();
    
    if(Tone.Transport.state !== "stopped") {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }
  };

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  useEffect(() => {
    if (!soundscapeState) return;

    const startAudio = async () => {
      if (!isStarted) {
        await Tone.start();
        Tone.Transport.start();
        setIsStarted(true);
        console.log('AudioContext started');
      }

      cleanupAudio();

      reverb.current = new Tone.Reverb().toDestination();
      filter.current = new Tone.Filter(20000, 'lowpass').connect(reverb.current);

      const { tone, layering } = soundscapeState;

      if (reverb.current) reverb.current.wet.value = tone.reverbWet;
      if (filter.current) {
        lfo.current = new Tone.LFO(tone.lfoRate, tone.filterFrequency / 2, tone.filterFrequency).start();
        lfo.current.connect(filter.current.frequency);
      }
      
      if (layering.drone) {
        droneSynth.current = new Tone.AMSynth({
          oscillator: { type: tone.oscillatorType as any },
          envelope: { attack: 2, decay: 1, sustain: 1, release: 4 },
        }).connect(filter.current);
        droneSynth.current.triggerAttack("C2");
      }

      if (layering.pulse) {
        pulseSynth.current = new Tone.FMSynth({
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
        }).connect(filter.current);

        pulseLoop.current = new Tone.Loop(time => {
          pulseSynth.current?.triggerAttackRelease('C4', '8n', time);
        }, '2n').start(0);
      }

      if (layering.texture) {
        getFreesoundSample().then(sample => {
          if (sample && sample.url) {
            const proxiedUrl = `/api/freesound-proxy?url=${encodeURIComponent(sample.url)}`;

            texturePlayer.current = new Tone.Player({
              url: proxiedUrl,
              loop: true,
              fadeIn: 2,
              fadeOut: 2,
            }).connect(filter.current!);
            
            texturePlayer.current.onload = () => {
                const bufferDuration = texturePlayer.current?.buffer.duration || 0;
                
                const loopDuration = Math.random() * (3.5 - 0.1) + 0.1;
                
                const safeLoopDuration = Math.min(loopDuration, bufferDuration);

                const startTime = Math.random() * (bufferDuration - safeLoopDuration);

                texturePlayer.current!.loopStart = startTime;
                texturePlayer.current!.loopEnd = startTime + safeLoopDuration;
                texturePlayer.current!.autostart = true;
            };
            texturePlayer.current.onerror = (e) => {
              console.error("Texture player error:", e);
              toast({
                variant: "destructive",
                title: "Texture not found",
                description: "Error loading texture audio.",
              });
            }

          } else {
             toast({
                variant: "destructive",
                title: "Texture not found",
                description: "Could not find a suitable texture sample. Try different settings.",
            });
          }
        }).catch(err => {
            console.error(err);
             toast({
                variant: "destructive",
                title: "Freesound Error",
                description: "Failed to fetch texture from Freesound.",
            });
        });
      }
    };
    
    startAudio();

  }, [soundscapeState, toast, isStarted]);

  return null;
}
