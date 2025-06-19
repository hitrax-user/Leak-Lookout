/**
 * @fileOverview Service for managing scan configuration and status in Firestore.
 * This service now only manages last run timestamps, as pause functionality was removed.
 */
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import type { ScanConfig } from './types';

// Ensure Firebase Admin is initialized (typically done in index.ts or a shared init file)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const SCAN_CONFIG_COLLECTION = 'scan_config';
const SCAN_STATUS_DOC_ID = 'status'; 

// Get current scan configuration (last run times)
export async function getScanRunTimestamps(): Promise<Pick<ScanConfig, 'lastRunStart' | 'lastRunFinish'>> {
  try {
    const docRef = db.collection(SCAN_CONFIG_COLLECTION).doc(SCAN_STATUS_DOC_ID);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data() as ScanConfig;
      return { lastRunStart: data.lastRunStart || null, lastRunFinish: data.lastRunFinish || null };
    }
    // Default if no config exists
    return { lastRunStart: null, lastRunFinish: null };
  } catch (error) {
    logger.error('Error fetching scan run timestamps:', error);
    return { lastRunStart: null, lastRunFinish: null }; // Fallback
  }
}

// updateScanPausedStatus function removed.

// Update the last run start timestamp
export async function updateLastRunStart(): Promise<void> {
  try {
    const docRef = db.collection(SCAN_CONFIG_COLLECTION).doc(SCAN_STATUS_DOC_ID);
    await docRef.set({ lastRunStart: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    logger.info('Last scan run start timestamp updated.');
  } catch (error) {
    logger.error('Error updating last scan run start timestamp:', error);
    // Don't throw, as this is secondary to the scan itself
  }
}

// Update the last run finish timestamp
export async function updateLastRunFinish(): Promise<void> {
  try {
    const docRef = db.collection(SCAN_CONFIG_COLLECTION).doc(SCAN_STATUS_DOC_ID);
    await docRef.set({ lastRunFinish: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    logger.info('Last scan run finish timestamp updated.');
  } catch (error) {
    logger.error('Error updating last scan run finish timestamp:', error);
    // Don't throw
  }
}
