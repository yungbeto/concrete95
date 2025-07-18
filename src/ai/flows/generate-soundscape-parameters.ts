'use server';

/**
 * @fileOverview This file defines a Genkit flow that translates emotional slider values into sound synthesis parameters and Freesound API search tags.
 *
 * - generateSoundscapeParameters - A function that accepts emotional slider values and returns sound parameters and Freesound tags.
 * - GenerateSoundscapeParametersInput - The input type for the generateSoundscapeParameters function.
 * - GenerateSoundscapeParametersOutput - The return type for the generateSoundscapeParameters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSoundscapeParametersInputSchema = z.object({
  ennui: z.number().describe('A measure of ennui, from 0 to 1.'),
  fluidity: z.number().describe('A measure of fluidity, from 0 to 1.'),
  chaos: z.number().describe('A measure of chaos, from 0 to 1.'),
  permanence: z.number().describe('A measure of permanence, from 0 to 1.'),
});
export type GenerateSoundscapeParametersInput = z.infer<typeof GenerateSoundscapeParametersInputSchema>;

const GenerateSoundscapeParametersOutputSchema = z.object({
  tone_params: z.object({
    oscillatorType: z.string().describe('The type of oscillator to use in Tone.js.'),
    reverbWet: z.number().describe('The reverb wetness value, from 0 to 1.'),
    lfoRate: z.number().describe('The LFO rate for modulation.'),
    filterFrequency: z.number().describe('The filter frequency for audio processing.'),
  }).describe('Sound synthesis parameters for Tone.js.'),
  layering: z.object({
    drone: z.boolean().describe('Whether to include a drone layer.'),
    texture: z.boolean().describe('Whether to include a texture layer.'),
    pulse: z.boolean().describe('Whether to include a pulse layer.'),
  }).describe('Parameters to control which layers are active'),
});
export type GenerateSoundscapeParametersOutput = z.infer<typeof GenerateSoundscapeParametersOutputSchema>;

export async function generateSoundscapeParameters(input: GenerateSoundscapeParametersInput): Promise<GenerateSoundscapeParametersOutput> {
  return generateSoundscapeParametersFlow(input);
}

const generateSoundscapeParametersPrompt = ai.definePrompt({
  name: 'generateSoundscapeParametersPrompt',
  input: {schema: GenerateSoundscapeParametersInputSchema},
  output: {schema: GenerateSoundscapeParametersOutputSchema},
  prompt: `You are an AI soundscape generator. The user will provide you with a set of emotional slider values, and you will return a JSON object containing sound synthesis parameters for Tone.js.

Ennui: {{{ennui}}}
Fluidity: {{{fluidity}}}
Chaos: {{{chaos}}}
Permanence: {{{permanence}}}

Based on these values, generate appropriate values for the following:

*   tone_params: oscillatorType, reverbWet, lfoRate, filterFrequency
*   layering: drone, texture, pulse

Return a JSON object with these fields populated. Do not include any explanation, justification or other text, only the JSON. Do not include freesound tags.

Here is the format:

{ 
  "tone_params": {
    "oscillatorType": "sine",
    "reverbWet": 0.5,
    "lfoRate": 0.1,
    "filterFrequency": 500
  },
  "layering": {
    "drone": true,
    "texture": false,
    "pulse": false
  }
}`,
});

const generateSoundscapeParametersFlow = ai.defineFlow(
  {
    name: 'generateSoundscapeParametersFlow',
    inputSchema: GenerateSoundscapeParametersInputSchema,
    outputSchema: GenerateSoundscapeParametersOutputSchema,
  },
  async input => {
    const {output} = await generateSoundscapeParametersPrompt(input);
    return output!;
  }
);
