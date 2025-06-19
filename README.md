# Leak Lookout

Leak Lookout is an intelligent tool designed to help identify and manage potential API key leaks. It aims to proactively find exposed secrets in public code sources, leveraging AI for context analysis and risk assessment.

## Core Features

*   **Dashboard Interface:** View, filter, and manage detected leaks.
*   **AI-Powered Analysis:**
    *   **Context Enhancement:** AI analyzes code snippets to determine if a potential key is a likely leak.
    *   **Key Validation:** AI assesses if a key is (theoretically) valid, what resources it might access, and its risk level.
    *   **Remediation Steps:** AI generates suggested steps to remediate a confirmed leak.
*   **Backend Scanning Service:** A Firebase Cloud Function periodically scans public GitHub and GitLab repositories for potential API key leaks.
*   **Settings:** Configure API keys for enhanced scanning (currently for backend use via Secret Manager).

## Project Structure

*   `src/`: Main application source code.
    *   `app/`: Next.js App Router (frontend pages, layouts, server actions).
    *   `ai/`: Genkit AI flows and configuration.
    *   `components/`: React UI components (ShadCN).
    *   `hooks/`: Custom React hooks.
    *   `lib/`: Utilities, types, Firebase client setup.
*   `functions/`: Firebase Cloud Functions for backend services (e.g., scheduled leak scanner).
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
    # GITHUB_API_KEY_SECRET_NAME=YOUR_CUSTOM_GITHUB_SECRET_NAME_IN_SECRET_MANAGER
    # GITLAB_API_KEY_SECRET_NAME=YOUR_CUSTOM_GITLAB_SECRET_NAME_IN_SECRET_MANAGER
    ```
3.  **Run the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will be available at `http://localhost:9002`.

## Backend Scanning Service Setup

The backend service uses a Firebase Cloud Function (`scheduledLeakScanner`) to scan GitHub and GitLab for leaks.

**Prerequisites:**

*   A Firebase project with Firestore and Cloud Functions enabled.
*   GitHub Personal Access Token (PAT) with `public_repo` scope.
*   GitLab Personal Access Token with `read_api` scope.

**Setup Steps:**

1.  **Configure Firebase Secret Manager:**
    *   In your Google Cloud project (associated with Firebase), go to Secret Manager.
    *   Create two secrets:
        *   Name: `GITHUB_API_KEY` (or the custom name set in `.env` / `functions/.env` by `GITHUB_API_KEY_SECRET_NAME`)
        *   Value: Your GitHub PAT
        *   Name: `GITLAB_API_KEY` (or the custom name set in `.env` / `functions/.env` by `GITLAB_API_KEY_SECRET_NAME`)
        *   Value: Your GitLab PAT
    *   Ensure the service account used by your Cloud Functions (usually `your-project-id@appspot.gserviceaccount.com`) has the **"Secret Manager Secret Accessor"** IAM role.

2.  **Set Environment Variables for Functions (Optional but Recommended):**
    While the function can derive the secret names from `process.env` (which can be set during deployment or via `.env` files in the `functions` directory if using `dotenv`), it's good practice.
    You can control the names of the secrets fetched from Secret Manager by setting `GITHUB_API_KEY_SECRET_NAME` and `GITLAB_API_KEY_SECRET_NAME` environment variables for your Cloud Function (e.g., during deployment or in `functions/.env`). If not set, they default to "GITHUB_API_KEY" and "GITLAB_API_KEY".
    ```bash
    # Example: In functions/.env (if using dotenv locally) or during deployment
    # GCLOUD_PROJECT=your-firebase-project-id
    # GITHUB_API_KEY_SECRET_NAME=CUSTOM_GITHUB_SECRET
    # GITLAB_API_KEY_SECRET_NAME=CUSTOM_GITLAB_SECRET
    ```
    The `GCLOUD_PROJECT` is usually automatically available in the Cloud Functions environment.

3.  **Deploy Cloud Functions:**
    *   Navigate to the `functions` directory: `cd functions`
    *   Install dependencies: `npm install` (or `yarn install`)
    *   Build the TypeScript code: `npm run build`
    *   Deploy only the functions: `firebase deploy --only functions`

4.  **Configure Firestore Security Rules:**
    Protect your `leaks` collection. For production, restrict write access to the function's service account and read access to authenticated users of your app.
    *Example (for initial development, refine for production):*
    ```json
    {
      "rules": {
        "leaks/{leakId}": {
          "allow read": "if request.auth != null;",
          // More secure: Allow writes only from your function's service account
          // "allow write": "if request.auth.token.email == 'your-project-id@appspot.gserviceaccount.com';"
          "allow write": "if request.auth != null;" // For broader testing, but update for prod
        }
      }
    }
    ```
    Apply these rules in the Firebase Console -> Firestore Database -> Rules.

## Confirming the Backend Service is Working

1.  **Check Firebase Cloud Function Logs:**
    *   Go to the Firebase Console -> Functions.
    *   Select the `scheduledLeakScanner` function.
    *   Navigate to the "Logs" tab.
    *   After the function's scheduled run (every hour), you should see logs indicating it started, searched repositories, processed files, and completed. Look for any error messages.
    *   You can also trigger the function manually from the Google Cloud Console (Cloud Functions section) for immediate testing.

2.  **Inspect Firestore Data:**
    *   Go to the Firebase Console -> Firestore Database.
    *   Look for a collection named `leaks`.
    *   If the scanner finds potential leaks, new documents will appear in this collection. Examine the document fields (`apiKeyPreview`, `sourceUrl`, `status: 'new'`, etc.).

3.  **Verify Dashboard Data:**
    *   Open the Leak Lookout application in your browser.
    *   The dashboard should now populate with leaks from the Firestore `leaks` collection. New leaks found by the scanner should appear here.
    *   Test filtering and viewing details to ensure data integrity.

4.  **Test with Emulators (Development):**
    *   Run `firebase emulators:start`.
    *   Your Next.js app's Firebase client and the Cloud Functions (if configured to connect to emulators) can be pointed to the emulators.
    *   Trigger the function manually (e.g., via HTTP trigger if configured for emulation, or by calling its exported method in the emulator shell).
    *   Check the Functions and Firestore Emulator UIs (usually `http://localhost:4000` for the main emulator UI) for logs and data.

## Developer Handover Notes

For a new developer joining the project, we recommend starting with the following sections in this README:
1.  **Core Features**: To understand the project's goals.
2.  **Project Structure**: To get an overview of the codebase organization.
3.  **Getting Started (Frontend)**: For setting up the development environment.
4.  **Backend Scanning Service Setup**: For understanding and setting up the backend components.
5.  **Confirming the Backend Service is Working**: To verify the setup.

Key technologies include Next.js, React, ShadCN UI, and TailwindCSS for the frontend. The backend consists of Firebase Cloud Functions (for scheduled scanning), Firestore (database), Firebase Secret Manager (for API keys), and Genkit (for AI-powered analysis flows using Google's Gemini models).
