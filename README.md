# Leak Lookout

Leak Lookout is an intelligent tool designed to help identify and manage potential API key leaks. It aims to proactively find exposed secrets in public code sources, leveraging AI for context analysis and risk assessment.

## Core Features

*   **Dashboard Interface:** View, filter, and manage detected leaks. Data is sourced from Firestore.
*   **AI-Powered Analysis:**
    *   **Context Enhancement:** AI analyzes code snippets to determine if a potential key is a likely leak.
    *   **Key Validation:** AI assesses if a key is (theoretically) valid, what resources it might access, and its risk level.
    *   **Remediation Steps:** AI generates suggested steps to remediate a confirmed leak.
*   **Backend Scanning Service (Firebase Cloud Function):**
    *   A Firebase Cloud Function (`scheduledLeakScanner`) runs hourly to scan public GitHub and GitLab repositories for potential API key leaks.
    *   It uses regex patterns and entropy analysis for initial detection.
    *   Detected leaks are saved to the Firestore `leaks` collection.
*   **Settings & Scanner Control:**
    *   Configure API keys for enhanced scanning (backend function uses keys from Firebase Secret Manager).
    *   Manually trigger a scan.
    *   View basic status of the scanner (last run times). Pause functionality for scheduled scans has been removed by request.

## Project Structure

*   `src/`: Main application source code.
    *   `app/`: Next.js App Router (frontend pages, layouts, server actions).
    *   `ai/`: Genkit AI flows and configuration.
    *   `components/`: React UI components (ShadCN).
    *   `hooks/`: Custom React hooks.
    *   `lib/`: Utilities, types, Firebase client setup.
*   `functions/`: Firebase Cloud Functions for backend services.
    *   `src/`: Source code for the Cloud Functions.
        *   `index.ts`: Main entry point for Cloud Functions (scheduled scanner, manual trigger).
        *   `coreScanner.ts`: Core logic for performing scans.
        *   `scanner.ts`: Logic for processing individual repositories/projects and files.
        *   `githubClient.ts`: Client for GitHub API.
        *   `gitlabClient.ts`: Client for GitLab API.
        *   `firestoreService.ts`: Service for saving leaks to Firestore.
        *   `configService.ts`: Service for managing scanner configuration (run times) in Firestore.
        *   `utils.ts`: Utilities for scanning (regex, entropy).
        *   `types.ts`: TypeScript types for backend functions.
    *   `package.json`: Dependencies for Cloud Functions.
    *   `tsconfig.json`: TypeScript configuration for Cloud Functions.
*   `public/`: Static assets.

## Getting Started (Frontend)

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
2.  **Set Up Firebase Client Environment Variables:**
    Create a `.env.local` file in the root of the project and add your Firebase project configuration:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

    # Optional: Specify custom names for secrets if not using defaults
    # These are primarily for the backend Cloud Function environment.
    # GITHUB_API_KEY_SECRET_NAME=YOUR_CUSTOM_GITHUB_SECRET_NAME_IN_SECRET_MANAGER
    # GITLAB_API_KEY_SECRET_NAME=YOUR_CUSTOM_GITLAB_SECRET_NAME_IN_SECRET_MANAGER
    ```
3.  **Run the Development Server:**
    ```bash
    npx next dev --turbopack -p 9002
    ```
    The application will be available at `http://localhost:9002`.

## Backend Scanning Service Setup (Firebase Cloud Functions)

The backend service uses a Firebase Cloud Function (`scheduledLeakScanner`) to scan GitHub and GitLab for leaks. It can also be triggered manually via the Settings page.

**Prerequisites:**

*   A Firebase project with Firestore and Cloud Functions enabled.
*   GitHub Personal Access Token (PAT) with `public_repo` scope.
*   GitLab Personal Access Token with `read_api` scope.

**Setup Steps:**

1.  **Configure Firebase Secret Manager:**
    *   In your Google Cloud project (associated with Firebase), go to Secret Manager.
    *   Create two secrets:
        *   Name: `GITHUB_API_KEY` (or the custom name set in your function's environment by `GITHUB_API_KEY_SECRET_NAME` if you choose to customize it).
        *   Value: Your GitHub PAT.
        *   Name: `GITLAB_API_KEY` (or the custom name set by `GITLAB_API_KEY_SECRET_NAME`).
        *   Value: Your GitLab PAT.
    *   Ensure the service account used by your Cloud Functions (usually `your-project-id@appspot.gserviceaccount.com`) has the **"Secret Manager Secret Accessor"** IAM role.

2.  **Set Environment Variables for Functions (Optional but Recommended for Custom Secret Names):**
    The Cloud Functions will try to access secrets named `GITHUB_API_KEY` and `GITLAB_API_KEY` by default. If you named your secrets differently in Secret Manager, you need to tell the functions what those names are.
    The `GCLOUD_PROJECT` is usually automatically available in the Cloud Functions environment. The clients `githubClient.ts` and `gitlabClient.ts` will use `process.env.GITHUB_API_KEY_SECRET_NAME` or `GITHUB_API_KEY` as the secret ID.

3.  **Deploy Cloud Functions:**
    *   Navigate to the `functions` directory: `cd functions`
    *   Install dependencies: `npm install` (or `yarn install`)
    *   Build the TypeScript code: `npm run build`
    *   Deploy functions (from the root project directory or `functions` directory): `firebase deploy --only functions`
    *   This command deploys the functions to your **currently selected Firebase project**.

4.  **Configure Firestore Security Rules:**
    Protect your `leaks` collection and the `scan_config/status` document.
    *Example (for initial development, **refine for production**):*
    ```json
    {
      "rules": {
        "leaks/{leakId}": {
          "allow read": "if request.auth != null;",
          // Allow writes only from your function's service account for production
          "allow write": "if request.auth.token.email == 'your-project-id@appspot.gserviceaccount.com';"
          // For easier dev: "allow write": "if request.auth != null;"
        },
        "scan_config/status": {
          "allow read": "if request.auth != null;", // Allow authenticated users to read status
           // Allow writes only from your function's service account (or specific admin role)
          "allow write": "if request.auth.token.email == 'your-project-id@appspot.gserviceaccount.com';"
           // For easier dev: "allow write": "if request.auth != null;"
        }
      }
    }
    ```
    Apply these rules in the Firebase Console -> Firestore Database -> Rules.

## Deploying the Next.js Frontend Application

There are several ways to deploy the Next.js frontend application:

1.  **Firebase Studio "Publish" Button:**
    *   If you are working within Firebase Studio, the "Publish" button (often located above the chat/AI assistant interface) may provide a highly managed deployment experience.
    *   **Important Observation:** Based on user experience, this "Publish" button might **create a new, separate Google Cloud project** to host your Next.js application. This new project would then contain the deployed service (likely using Google Cloud Run managed by Firebase Studio/App Hosting).
    *   This approach is convenient for quick deployments managed by Studio but means the Next.js app might not reside in your primary Firebase project unless Studio offers options to target an existing project.

2.  **Firebase App Hosting (to an existing Firebase project):**
    *   If you want to deploy the Next.js application to your **existing Firebase project**, you can use Firebase App Hosting.
    *   **Initialize App Hosting:** If you haven't already, run `firebase init apphosting` in your project root and follow the prompts to connect it to your Firebase project. This will create or update `apphosting.yaml`.
    *   **Deploy:** Use the command `firebase deploy --only hosting` or `firebase deploy`. This will build your Next.js app and deploy it to a Cloud Run backend managed by App Hosting *within your selected Firebase project*.
    *   The `apphosting.yaml` file configures runtime aspects of this deployment (e.g., `maxInstances`).

3.  **Other Platforms (Vercel, Netlify, Google Cloud Run direct):**
    *   You can also deploy your Next.js application to other platforms like Vercel (ideal for Next.js), Netlify, or directly to Google Cloud Run by containerizing your application (e.g., with Docker). This gives you more control but requires more setup.

**Choosing a Deployment Method for Next.js:**
*   If the **Firebase Studio "Publish" button** meets your needs and you are okay with it potentially creating a new GCP project for the app, it's a simple option.
*   If you want the Next.js app in your **main Firebase project**, use **Firebase App Hosting** with `firebase deploy`.
*   For other scenarios, consider Vercel or direct Cloud Run deployment.

## Confirming the Backend Service is Working

1.  **Check Firebase Cloud Function Logs:**
    *   Go to the Firebase Console -> Functions.
    *   Select the `scheduledLeakScanner` and `triggerManualScan` functions.
    *   Navigate to the "Logs" tab for each.
    *   After the `scheduledLeakScanner`'s run (every hour) or after triggering a manual scan from the Settings page, you should see logs indicating it started, searched repositories, processed files, and completed. Look for any error messages.
    *   You can call `triggerManualScan` via the Settings page in the app.

2.  **Inspect Firestore Data:**
    *   Go to the Firebase Console -> Firestore Database.
    *   Look for a collection named `leaks`. If the scanner finds potential leaks, new documents will appear here.
    *   Look for a collection `scan_config` with a document `status`. This document should contain `lastRunStart`, and `lastRunFinish` fields, which are updated by the scanner functions.

3.  **Verify Dashboard and Settings Page:**
    *   Open the Leak Lookout application in your browser.
    *   The dashboard should populate with leaks from the Firestore `leaks` collection.
    *   The Settings page should display the last run times from `scan_config/status`.
    *   Test the "Run Scan Manually" button on the Settings page. Observe logs and Firestore data changes.

4.  **Test with Emulators (Development):**
    *   Run `firebase emulators:start`. Your Next.js app's Firebase client (`src/lib/firebase.ts`) and Cloud Functions can be configured to connect to emulators for local testing. This often involves conditional connection logic based on an environment variable like `FIREBASE_EMULATOR_HOST`.
    *   Trigger functions manually via the Settings page UI or the Emulator UI.
    *   Check the Functions and Firestore Emulator UIs (usually `http://localhost:4000`) for logs and data.

## Developer Handover Notes

For a new developer joining the project, we recommend starting with the following sections in this README:
1.  **Core Features**: To understand the project's goals.
2.  **Project Structure**: To get an overview of the codebase organization, noting the separation between the Next.js app (`src/`) and the Firebase Cloud Functions (`functions/`).
3.  **Getting Started (Frontend)**: For setting up the Next.js development environment.
4.  **Backend Scanning Service Setup (Firebase Cloud Functions)**: For understanding and setting up the Firebase Cloud Functions, Firestore, and Secret Manager.
5.  **Deploying the Next.js Frontend Application**: To understand the different ways the frontend can be deployed.
6.  **Confirming the Backend Service is Working**: To verify the entire setup.

Key technologies include Next.js, React, ShadCN UI, and TailwindCSS for the frontend. The backend consists of Firebase Cloud Functions (for scheduled and manual scanning), Firestore (database), Firebase Secret Manager (for API keys), and Genkit (for AI-powered analysis flows using Google's Gemini models, called from Next.js Server Actions).
The `functions/` directory contains the backend scanning logic.
The `src/ai/flows/` directory contains Genkit AI flows.
The `src/app/` directory contains the Next.js frontend pages and server actions.
The `scan_config/status` document in Firestore stores the `lastRunStart` and `lastRunFinish` timestamps for the scanner.
The `triggerManualScan` Firebase Cloud Function allows on-demand execution of the scan logic.
Scheduled scans run hourly via the `scheduledLeakScanner` Firebase Cloud Function.
There is no pause/resume functionality for scheduled scans.
