import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { performScan } from './scanner';
import { Scan } from './types';
import { updateScanConfigStatus } from './configService';
import { AxiosError } from 'axios';

const GITHUB_SCAN_PATH = 'github_repos_to_scan/{scanId}';

export const onGithubScanRequest = onDocumentCreated(GITHUB_SCAN_PATH, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.info('No data associated with the event');
    return;
  }
  const scan = snapshot.data() as Scan;
  logger.info(`New scan request received: ${scan.id}`);

  try {
    await performScan(scan);
  } catch (error) {
    logger.error(`Scan failed for document ${scan.id}:`, error);

    // Type-safe error handling
    let isAuthError = false;
    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        isAuthError = true;
      }
    }

    if (isAuthError) {
      logger.error(`CRITICAL: Authentication failed for scan ${scan.id}. Deactivating.`);
      await updateScanConfigStatus(scan.id, 'INVALID_TOKEN');
      // DO NOT re-throw, to prevent Cloud Function retries for auth errors.
    } else {
      // For other errors, re-throw to allow for retries on transient issues.
      await updateScanConfigStatus(scan.id, 'FAILED_TRANSIENT');
      throw error;
    }
  }
});

// Other functions from the file would go here...