import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions';
import { executeScanLogic } from './coreScanner';
import { getScanConfig, updateScanPausedStatus } from './configService';
import * as admin from 'firebase-admin';

// Ensure Firebase Admin is initialized only once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Scheduled function (remains the same trigger, but calls shared logic)
export const scheduledLeakScanner = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
    // secrets: [process.env.GITHUB_API_KEY_SECRET_NAME!, process.env.GITLAB_API_KEY_SECRET_NAME!], 
  })
  .pubsub.schedule('every 1 hours')
  .onRun(async (context) => {
    logger.info('Scheduled leak scanning function triggered.', { eventId: context.eventId });
    try {
      const scanConfig = await getScanConfig();
      if (scanConfig?.isPaused) {
        logger.info('Scan is paused. Exiting scheduledLeakScanner.');
        return null;
      }
      await executeScanLogic(context.eventId);
      logger.info('Scheduled leak scanning function completed successfully.');
    } catch (error) {
      logger.error('Error in scheduledLeakScanner:', error, { eventId: context.eventId });
    }
    return null;
  });

// HTTP-callable function to trigger a scan manually
export const triggerManualScan = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Optional: Add authentication check here if needed
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    // }
    const eventId = context.eventId || `manual-${Date.now()}`;
    logger.info('Manual scan triggered.', { eventId, byUser: context.auth?.uid });
    try {
      await executeScanLogic(eventId);
      logger.info('Manual scan completed successfully.', { eventId });
      return { success: true, message: 'Manual scan initiated and completed successfully.' };
    } catch (error) {
      logger.error('Error during manual scan:', error, { eventId });
      throw new functions.https.HttpsError('internal', 'Failed to complete manual scan.', error);
    }
  });


// HTTP-callable function to set the paused status of scheduled scans
export const setScanPaused = functions.https.onCall(async (data, context) => {
  // Optional: Add authentication check here if needed
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  // }
  const { paused } = data;
  if (typeof paused !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'The "paused" argument must be a boolean.');
  }

  try {
    await updateScanPausedStatus(paused);
    logger.info(`Scheduled scan pause status set to: ${paused}`, { byUser: context.auth?.uid });
    return { success: true, message: `Scheduled scans ${paused ? 'paused' : 'resumed'}.` };
  } catch (error) {
    logger.error('Error setting scan pause status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to set scan pause status.', error);
  }
});
