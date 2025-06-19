import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions';
import { executeScanLogic } from './coreScanner';
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
    // secrets: [process.env.GITHUB_API_KEY_SECRET_NAME!, process.env.GITLAB_API_KEY_SECRET_NAME!], // Define in .env or GCloud console for functions
  })
  .pubsub.schedule('every 1 hours')
  .onRun(async (context) => {
    logger.info('Scheduled leak scanning function triggered.', { eventId: context.eventId });
    try {
      // Pause check removed as per user request
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
    const eventId = `manual-${Date.now()}`;
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

// setScanPaused function has been removed as per user request.
// The configService will no longer store or manage an isPaused state.
// The UI on the settings page will also be updated to remove pause/resume controls.
// The getScanConfig will only return last run times.
