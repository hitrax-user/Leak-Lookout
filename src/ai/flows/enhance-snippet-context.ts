
'use server';

/**
 * @fileOverview Uses GenAI to analyze code snippets where potential API keys are found,
 * enriching the context and improving the accuracy of leak identification by reducing false positives.
 *
 * - enhanceSnippetContext - A function that handles the snippet enhancement process.
 * - EnhanceSnippetContextInput - The input type for the enhanceSnippetContext function.
 * - EnhanceSnippetContextOutput - The return type for the enhanceSnippetContext function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceSnippetContextInputSchema = z.object({
  codeSnippet: z
    .string()
    .describe('The code snippet to analyze, where a potential API key was found.'),
  apiKeyType: z.string().describe('The type of API key that was detected.'),
});
export type EnhanceSnippetContextInput = z.infer<typeof EnhanceSnippetContextInputSchema>;

const EnhanceSnippetContextOutputSchema = z.object({
  enhancedContext: z
    .string()
    .describe(
      'A summary of the code snippet, with additional context to determine if the detected API key is a real leak or a false positive.'
    ),
  isLikelyLeak: z
    .boolean()
    .describe(
      'A determination, based on the enhanced context, as to whether the detected API key is likely a real leak.'
    ),
});
export type EnhanceSnippetContextOutput = z.infer<typeof EnhanceSnippetContextOutputSchema>;

export async function enhanceSnippetContext(input: EnhanceSnippetContextInput): Promise<EnhanceSnippetContextOutput> {
  return enhanceSnippetContextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhanceSnippetContextPrompt',
  input: {schema: EnhanceSnippetContextInputSchema},
  output: {schema: EnhanceSnippetContextOutputSchema},
  prompt:
    `You are a security analyst specializing in identifying API key leaks in code.\n\n` +
    `You are provided with a code snippet and the type of API key that was detected in the snippet.\n\n` +
    `Your task is to analyze the code snippet and provide a summary of the context surrounding the API key.\n` +
    `Based on the context, determine if the detected API key is likely a real leak or a false positive.\n\n` +
    `Code Snippet:\n` +
    `\\\`\\\`\\\`\n{{{codeSnippet}}}\n\\\`\\\`\\\`\n\n` +
    `API Key Type: {{{apiKeyType}}}\n\n` +
    `Respond concisely.`,
});

const enhanceSnippetContextFlow = ai.defineFlow(
  {
    name: 'enhanceSnippetContextFlow',
    inputSchema: EnhanceSnippetContextInputSchema,
    outputSchema: EnhanceSnippetContextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

