"use server";

import { enhanceSnippetContext, type EnhanceSnippetContextInput, type EnhanceSnippetContextOutput } from '@/ai/flows/enhance-snippet-context';
import { generateRemediationSteps, type GenerateRemediationStepsInput, type GenerateRemediationStepsOutput } from '@/ai/flows/generate-remediation-steps';

export async function enhanceLeakContextAction(input: EnhanceSnippetContextInput): Promise<EnhanceSnippetContextOutput> {
  try {
    const result = await enhanceSnippetContext(input);
    return result;
  } catch (error) {
    console.error("Error enhancing snippet context:", error);
    throw new Error("Failed to enhance snippet context.");
  }
}

export async function generateRemediationStepsAction(input: GenerateRemediationStepsInput): Promise<GenerateRemediationStepsOutput> {
  try {
    const result = await generateRemediationSteps(input);
    return result;
  } catch (error) {
    console.error("Error generating remediation steps:", error);
    throw new Error("Failed to generate remediation steps.");
  }
}
