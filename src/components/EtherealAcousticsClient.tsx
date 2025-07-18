"use client";

import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { type SoundscapeState } from '@/lib/types';
import { generateSoundscapeParameters, type GenerateSoundscapeParametersOutput } from '@/ai/flows/generate-soundscape-parameters';
import { createSoundscapeSurprise, type CreateSoundscapeSurpriseOutput } from '@/ai/flows/create-soundscape-surprise';
import { SoundscapeController } from './SoundscapeController';
import { AudioEngine } from './AudioEngine';
import FogVisualizer from './FogVisualizer';

function normalizeAIResponse(response: GenerateSoundscapeParametersOutput): SoundscapeState {
    return {
        tone: {
            oscillatorType: response.tone_params?.oscillatorType || 'sine',
            reverbWet: response.tone_params?.reverbWet ?? 0.5,
            lfoRate: response.tone_params?.lfoRate ?? 0.1,
            filterFrequency: response.tone_params?.filterFrequency ?? 500,
        },
        freesound: {
            tags: response.freesound_tags || [],
        },
        layering: {
            drone: response.layering?.drone || false,
            texture: response.layering?.texture || false,
            pulse: response.layering?.pulse || false,
        },
    };
}


export default function EtherealAcousticsClient() {
  const { toast } = useToast();
  const [soundscapeState, setSoundscapeState] = useState<SoundscapeState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (values: Record<string, number>) => {
    setIsLoading(true);
    try {
      const result = await generateSoundscapeParameters(values);
      if (result) {
        setSoundscapeState(normalizeAIResponse(result));
      } else {
        throw new Error("AI did not return a valid response.");
      }
    } catch (error) {
      console.error("Error generating soundscape:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "The AI could not generate a soundscape. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurprise = async () => {
    if (!soundscapeState) {
        toast({
            title: "Generate First",
            description: "Please generate a soundscape before creating a surprise.",
        });
        return;
    }
    setIsLoading(true);
    try {
      const currentParamsForAI = {
        currentToneParams: soundscapeState.tone,
        currentFreesoundTags: soundscapeState.freesound.tags,
        currentLayering: soundscapeState.layering,
      };
      
      const result = await createSoundscapeSurprise(currentParamsForAI);

      if (result) {
        const newState: SoundscapeState = {
            tone: { ...soundscapeState.tone, ...result.toneParams },
            freesound: { tags: result.freesoundTags || soundscapeState.freesound.tags },
            layering: { ...soundscapeState.layering, ...result.layering },
        };
        setSoundscapeState(newState);
      } else {
        throw new Error("AI did not return a valid surprise.");
      }
    } catch (error) {
        console.error("Error creating surprise:", error);
        toast({
            variant: "destructive",
            title: "Surprise Failed",
            description: "The AI could not create a surprise. Please try again.",
        });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4">
      <FogVisualizer />
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
         <div className="mb-4">
            <h1 className="text-5xl font-bold font-headline tracking-tighter text-foreground">
                Ethereal Acoustics
            </h1>
            <p className="text-muted-foreground mt-2">An AI-Driven Generative Soundscape</p>
         </div>

        <SoundscapeController 
          onGenerate={handleGenerate}
          onSurprise={handleSurprise}
          isLoading={isLoading}
          hasGenerated={!!soundscapeState}
        />
      </div>
      <AudioEngine soundscapeState={soundscapeState} />
    </div>
  );
}
