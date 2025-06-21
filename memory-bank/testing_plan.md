# Backend Testing Plan

This document outlines the procedure for testing the backend functions locally using the Firebase Emulator Suite.

## 1. Prerequisites

Ensure you have the Firebase CLI installed globally:
```bash
npm install -g firebase-tools
```

## 2. Create Test Trigger Script

Create a file named `trigger_test.js` in the `functions` directory with the following content. This script will connect to the local Firestore emulator and create a document to trigger the scan function.

```javascript
// functions/trigger_test.js
const admin = require('firebase-admin');

// Point to the local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Initialize the Admin SDK
admin.initializeApp({
  projectId: 'your-gcloud-project-id', // Replace with your actual Google Cloud project ID
});

const db = admin.firestore();

async function triggerScan() {
  const scanId = `test-${Date.now()}`;
  const scanCollection = db.collection('github_repos_to_scan');
  
  const scanDoc = {
    id: scanId,
    provider: 'github',
    // Use a public repository that is known to have key-like strings for testing
    repoName: 'git-secrets/test-leak', 
  };

  try {
    await scanCollection.doc(scanId).set(scanDoc);
    console.log(`Successfully created scan document with ID: ${scanId}`);
    console.log('Check the emulator logs to see the function execution.');
  } catch (error) {
    console.error('Failed to create scan document:', error);
  }
}

triggerScan();
```
**Note:** Replace `'your-gcloud-project-id'` with your actual project ID. You can find it in your Firebase project settings.

## 3. Running the Test

1.  **Open two separate terminals** in the root directory of the project (`d:/01 Vibe coding/08 PC/Leak-Lookout`).

2.  **In the first terminal, start the emulators:**
    ```bash
    firebase emulators:start
    ```
    Wait for the message "All emulators ready! It is now safe to connect". You will see the logs from the functions in this terminal.

3.  **In the second terminal, run the trigger script:**
    *   First, navigate to the `functions` directory: `cd functions`
    *   Then, run the script: `node trigger_test.js`

## 4. Observing the Results

-   **Terminal 1 (Emulator Logs)**: Watch the logs for output from the `onGithubScanRequest` function. You should see logs indicating the start and progress of the scan.
-   **Emulator UI**: Open your web browser and navigate to `http://localhost:4000`.
    -   Click on the **Firestore** tab. You should see the document you created in the `github_repos_to_scan` collection.
    -   After the scan runs, check the `leaks` collection (you may need to create it manually in the UI if it's the first run). Any discovered leaks will appear here.
-   **Terminal 2 (Script Output)**: This will simply confirm that the test document was created successfully.

This procedure allows for end-to-end testing of the core scanning functionality in a controlled local environment.
