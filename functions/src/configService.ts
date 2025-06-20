import { firestore } from './firebaseAdmin';
import { logger } from 'firebase-functions';

// This service was likely intended for more, but for now, we only need the status update function.

/**
 * Updates the status of a scan configuration document in Firestore.
 * @param {string} scanId - The ID of the scan document.
 * @param {string} status - The new status (e.g., 'INVALID_TOKEN', 'COMPLETED').
 */
export async function updateScanConfigStatus(scanId: string, status: string): Promise<void> {
  try {
    const scanConfigRef = firestore.collection('scan_config').doc(scanId);
    await scanConfigRef.update({
      status: status,
      lastUpdated: new Date().toISOString(),
    });
    logger.info(`Updated scan config ${scanId} with status: ${status}`);
  } catch (error) {
    logger.error(`Failed to update status for scan config ${scanId}`, error);
    // Depending on requirements, you might want to re-throw or handle differently.
    // For now, we log the error and continue.
  }
}

// Keep other existing functions in this file if there are any.
// The primary goal is to add and export updateScanConfigStatus.
