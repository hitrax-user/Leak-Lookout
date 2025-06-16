'use server';
/**
 * @fileOverview A flow to validate leaked API keys using GenAI.
 *
 * - validateLeakedKey - A function that validates a leaked API key.
 * - ValidateLeakedKeyInput - The input type for the validateLeakedKey function.
 * - ValidateLeakedKeyOutput - The return type for the validateLeakedKey function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateLeakedKeyInputSchema = z.object({
  key: z.string().describe('The leaked API key to validate.'),
  keyType: z.string().describe('The type of the API key (e.g., AWS, Google, Stripe).'),
  sourceUrl: z.string().describe('The URL where the leaked key was found.'),
});
export type ValidateLeakedKeyInput = z.infer<typeof ValidateLeakedKeyInputSchema>;

const ValidateLeakedKeyOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the leaked key is valid and active.'),
  accessibleResources: z.string().describe('A description of the resources accessible with the leaked key.'),
  riskLevel: z.string().describe('The risk level associated with the leaked key (e.g., high, medium, low).'),
});
export type ValidateLeakedKeyOutput = z.infer<typeof ValidateLeakedKeyOutputSchema>;

export async function validateLeakedKey(input: ValidateLeakedKeyInput): Promise<ValidateLeakedKeyOutput> {
  return validateLeakedKeyFlow(input);
}

const validateLeakedKeyPrompt = ai.definePrompt({
  name: 'validateLeakedKeyPrompt',
  input: {schema: ValidateLeakedKeyInputSchema},
  output: {schema: ValidateLeakedKeyOutputSchema},
  prompt: `You are an expert in cybersecurity and cloud security. Your task is to validate leaked API keys and assess their potential impact.

You will receive information about a leaked API key, including its value, type, and source URL. You will use this information to determine whether the key is valid, what resources it can access, and the associated risk level.

Here is the information about the leaked key:
Key: {{{key}}}
Type: {{{keyType}}}
Source URL: {{{sourceUrl}}}

Consider the following factors when validating the key:
- Whether the key matches the expected format for its type.
- Whether the key is active and can be used to access resources.
- What resources the key can access (e.g., data storage, compute instances, databases).
- The potential impact if the key is used by an unauthorized party.

Based on your analysis, provide the following information:
- isValid: true if the key is valid and active, false otherwise.
- accessibleResources: A description of the resources accessible with the key. If unable to determine resources, set to "Unable to determine accessible resources."
- riskLevel: The risk level associated with the leaked key (high, medium, or low).

Ensure that the output is properly formatted JSON.
`,
});

const validateLeakedKeyFlow = ai.defineFlow(
  {
    name: 'validateLeakedKeyFlow',
    inputSchema: ValidateLeakedKeyInputSchema,
    outputSchema: ValidateLeakedKeyOutputSchema,
  },
  async input => {
    const {output} = await validateLeakedKeyPrompt(input);
    return output!;
  }
);


