
import type { LeakedKey } from './types';

// This file's data is now superseded by Firestore.
// Keeping a minimal structure for reference or potential fallback testing if needed.
export const mockLeaks: LeakedKey[] = [
  // {
  //   id: 'mock-1',
  //   keyHash: 'hash_of_AIzaSy_mock1',
  //   apiKeyPreview: 'AIza...',
  //   sourceUrl: 'https://github.com/mockuser/mockproject/blob/main/config.js',
  //   sourceType: 'github',
  //   detectionTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  //   status: 'new',
  //   contextSnippet: 'const firebaseConfig = { apiKey: "AIzaSyMock...", ... };',
  //   keyType: 'Google API Key',
  //   entropy: 4.5,
  //   repository: 'mockuser/mockproject',
  //   filePath: 'src/config.js',
  //   isLikelyLeak: null,
  //   enhancedContext: null,
  //   isValid: null,
  //   accessibleResources: null,
  //   riskLevel: null,
  //   lastScanned: null,
  //   lastValidatedTimestamp: null,
  // }
];

// It is recommended to remove or comment out the usage of mockLeaks 
// in useLeaks.ts once Firestore integration is confirmed to be working.
// The useLeaks.ts hook has been updated to primarily use Firestore.
