// src/ai/flows/create-soundscape-surprise.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for subtly varying the parameters of the current generative ruleset to create unexpected variations within the existing mood.
 *
 * - createSoundscapeSurprise - A function that triggers the AI to subtly vary the soundscape parameters.
 * - CreateSoundscapeSurpriseInput - The input type for the createSoundscapeSurprise function.
 * - CreateSoundscapeSurpriseOutput - The return type for the createSoundscapeSurprise function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CreateSoundscapeSurpriseInputSchema = z.object({
  currentToneParams: z.object({
    oscillatorType: z.string().optional(),
    reverbWet: z.number().optional(),
    lfoRate: z.number().optional(),
    filterFrequency: z.number().optional(),
  }).optional(),
  currentFreesoundTags: z.array(z.string()).optional(),
  currentLayering: z.object({
    drone: z.boolean().optional(),
    texture: z.boolean().optional(),
    pulse: z.boolean().optional(),
  }).optional(),
});
export type CreateSoundscapeSurpriseInput = z.infer<typeof CreateSoundscapeSurpriseInputSchema>;

const CreateSoundscapeSurpriseOutputSchema = z.object({
  toneParams: z.object({
    oscillatorType: z.string().optional(),
    reverbWet: z.number().optional(),
    lfoRate: z.number().optional(),
    filterFrequency: z.number().optional(),
  }).optional(),
  freesoundTags: z.array(z.string()).optional(),
  layering: z.object({
    drone: z.boolean().optional(),
    texture: z.boolean().optional(),
    pulse: z.boolean().optional(),
  }).optional(),
});
export type CreateSoundscapeSurpriseOutput = z.infer<typeof CreateSoundscapeSurpriseOutputSchema>;

export async function createSoundscapeSurprise(input: CreateSoundscapeSurpriseInput): Promise<CreateSoundscapeSurpriseOutput> {
  return createSoundscapeSurpriseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'createSoundscapeSurprisePrompt',
  input: {schema: CreateSoundscapeSurpriseInputSchema},
  output: {schema: CreateSoundscapeSurpriseOutputSchema},
  prompt: `Given the current soundscape parameters, subtly vary them to create a slightly different but related soundscape.

Current parameters:
Tone parameters: {{{currentToneParams}}}
Freesound tags: {{{currentFreesoundTags}}}
Layering: {{{currentLayering}}}

Provide the new soundscape parameters in the same format.
Do not deviate wildly from the existing parameters, instead only create subtle variations.`,
});

const createSoundscapeSurpriseFlow = ai.defineFlow(
  {
    name: 'createSoundscapeSurpriseFlow',
    inputSchema: CreateSoundscapeSurpriseInputSchema,
    outputSchema: CreateSoundscapeSurpriseOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
