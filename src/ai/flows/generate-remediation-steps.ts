'use server';

/**
 * @fileOverview A Genkit flow for generating remediation steps for leaked API keys.
 *
 * - generateRemediationSteps - A function that generates remediation steps.
 * - GenerateRemediationStepsInput - The input type for the generateRemediationSteps function.
 * - GenerateRemediationStepsOutput - The return type for the generateRemediationSteps function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRemediationStepsInputSchema = z.object({
  keyType: z.string().describe('The type of the leaked API key (e.g., AWS, Google, Stripe).'),
  sourceUrl: z.string().describe('The URL where the leaked API key was found.'),
  contextSnippet: z.string().describe('A snippet of the code or text where the key was found.'),
});
export type GenerateRemediationStepsInput = z.infer<typeof GenerateRemediationStepsInputSchema>;

const GenerateRemediationStepsOutputSchema = z.object({
  remediationSteps: z.string().describe('The generated remediation steps for the leaked API key.'),
});
export type GenerateRemediationStepsOutput = z.infer<typeof GenerateRemediationStepsOutputSchema>;

export async function generateRemediationSteps(
  input: GenerateRemediationStepsInput
): Promise<GenerateRemediationStepsOutput> {
  return generateRemediationStepsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRemediationStepsPrompt',
  input: {schema: GenerateRemediationStepsInputSchema},
  output: {schema: GenerateRemediationStepsOutputSchema},
  prompt: `You are a security expert providing remediation steps for leaked API keys.

  Based on the type of API key, source URL, and context snippet, generate remediation steps to revoke the key,
  secure affected resources, and prevent future leaks.

  Key Type: {{{keyType}}}
  Source URL: {{{sourceUrl}}}
  Context Snippet: {{{contextSnippet}}}

  Provide detailed and actionable steps.
  `,
});

const generateRemediationStepsFlow = ai.defineFlow(
  {
    name: 'generateRemediationStepsFlow',
    inputSchema: GenerateRemediationStepsInputSchema,
    outputSchema: GenerateRemediationStepsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
