
"use server";

import { enhanceSnippetContext, type EnhanceSnippetContextInput, type EnhanceSnippetContextOutput } from '@/ai/flows/enhance-snippet-context';
import { generateRemediationSteps, type GenerateRemediationStepsInput, type GenerateRemediationStepsOutput } from '@/ai/flows/generate-remediation-steps';
import { validateLeakedKey, type ValidateLeakedKeyInput, type ValidateLeakedKeyOutput } from '@/ai/flows/validate-leaked-key';
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app as firebaseApp, db } from '@/lib/firebase'; // Ensure db is also exported from firebase.ts
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import type { ScanStatus } from '@/lib/types';

// Ensure Firebase app is initialized (it should be by importing firebaseApp)
const functions = getFunctions(firebaseApp);

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

export async function validateLeakedKeyAction(input: ValidateLeakedKeyInput): Promise<ValidateLeakedKeyOutput> {
  try {
    const result = await validateLeakedKey(input);
    return result;
  } catch (error) {
    console.error("Error validating leaked key:", error);
    throw new Error("Failed to validate leaked key.");
  }
}


// Action to trigger manual scan
const triggerManualScanCallable = httpsCallable(functions, 'triggerManualScan');
export async function triggerManualScanAction(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await triggerManualScanCallable() as HttpsCallableResult<{ success: boolean; message: string }>;
    return result.data;
  } catch (error: any) {
    console.error("Error triggering manual scan:", error);
    return { success: false, message: error.message || "Failed to trigger manual scan." };
  }
}

// Action to set scan pause status
const setScanPausedCallable = httpsCallable(functions, 'setScanPaused');
export async function setScanPausedAction(paused: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const result = await setScanPausedCallable({ paused }) as HttpsCallableResult<{ success: boolean; message: string }>;
    return result.data;
  } catch (error: any) {
    console.error("Error setting scan pause status:", error);
    return { success: false, message: error.message || "Failed to set scan pause status." };
  }
}

// Action to get current scan status from Firestore
export async function getScanStatusAction(): Promise<ScanStatus> {
  try {
    const docRef = doc(db, 'scan_config', 'status');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Convert Firestore Timestamps to ISO strings or null
      const convertTimestamp = (ts: Timestamp | null | undefined): string | null => 
        ts ? ts.toDate().toISOString() : null;

      return {
        isPaused: data.isPaused ?? false,
        lastRunStart: convertTimestamp(data.lastRunStart),
        lastRunFinish: convertTimestamp(data.lastRunFinish),
      };
    } else {
      // Default status if document doesn't exist
      return { isPaused: false, lastRunStart: null, lastRunFinish: null };
    }
  } catch (error) {
    console.error("Error fetching scan status:", error);
    // Return default/error state
    return { isPaused: false, lastRunStart: null, lastRunFinish: null, error: "Failed to fetch status" };
  }
}
