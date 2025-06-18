import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import type { LeakedKeyDocument, PartialLeakedKey } from './types'; // We'll define this type

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// It's good practice to configure Firestore settings, e.g., timestampsInSnapshots.
// However, for recent SDK versions, it's often handled by default.
// db.settings({ timestampsInSnapshots: true }); // Ensure this is true or remove if default

export async function saveLeak(leakData: PartialLeakedKey): Promise<void> {
  const { keyHash, sourceUrl } = leakData;
  
  // Create a unique ID for the leak document based on hash and source to prevent duplicates from same scan
  // More robust de-duplication might involve checking existing keyHashes
  const docId = admin.firestore().collection('leaks').doc().id; // Generate new ID for each unique finding spot

  const leakRef = db.collection('leaks').doc(docId);

  // Check if a leak with the same keyHash from the same sourceUrl already exists
  // This is a simple check; more complex de-duplication might be needed
  const querySnapshot = await db.collection('leaks')
    .where('keyHash', '==', keyHash)
    .where('sourceUrl', '==', sourceUrl)
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    // logger.info(`Duplicate leak found, skipping: ${keyHash} at ${sourceUrl}`);
    // Potentially update timestamp of existing leak or add more context if needed
    return;
  }

  const newLeak: LeakedKeyDocument = {
    ...leakData,
    id: docId, // Store the document ID within the document for easier client-side access
    detectionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: 'new',
    // Ensure all required fields from LeakedKey (matching the frontend type) are present
    // or have defaults if not provided by leakData
    isLikelyLeak: null,
    enhancedContext: null,
    isValid: null,
    accessibleResources: null,
    riskLevel: null,
    lastScanned: null,
    lastValidatedTimestamp: null,
  };

  try {
    await leakRef.set(newLeak);
    logger.info(`Leak saved to Firestore: ${docId} for key preview ${newLeak.apiKeyPreview}`);
  } catch (error) {
    logger.error('Error saving leak to Firestore:', error, { leakData });
    throw error; // Re-throw to be caught by the main function handler
  }
}
