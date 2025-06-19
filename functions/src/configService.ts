/**
 * @fileOverview Service for managing scan configuration and status in Firestore.
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
const SCAN_STATUS_DOC_ID = 'status'; // Using a more specific ID for the document

// Get current scan configuration (e.g., pause status)
export async function getScanConfig(): Promise<ScanConfig | null> {
  try {
    const docRef = db.collection(SCAN_CONFIG_COLLECTION).doc(SCAN_STATUS_DOC_ID);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data() as ScanConfig;
    }
    // Default to not paused if no config exists
    return { isPaused: false, lastRunStart: null, lastRunFinish: null };
  } catch (error) {
    logger.error('Error fetching scan config:', error);
    return { isPaused: false, lastRunStart: null, lastRunFinish: null }; // Fallback
  }
}

// Update the paused status for scheduled scans
export async function updateScanPausedStatus(isPaused: boolean): Promise<void> {
  try {
    const docRef = db.collection(SCAN_CONFIG_COLLECTION).doc(SCAN_STATUS_DOC_ID);
    await docRef.set({ isPaused }, { merge: true });
    logger.info(`Scan paused status updated to: ${isPaused}`);
  } catch (error) {
    logger.error('Error updating scan paused status:', error);
    throw error;
  }
}

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
