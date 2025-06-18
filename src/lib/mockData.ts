
import type { LeakedKey } from './types';

// This file can now be significantly reduced or removed if Firestore is the primary source.
// Keeping a few examples for reference or fallback testing if needed.
export const mockLeaks: LeakedKey[] = [
  {
    id: 'mock-1',
    keyHash: 'hash_of_AIzaSy_mock1',
    apiKeyPreview: 'AIza...',
    sourceUrl: 'https://github.com/mockuser/mockproject/blob/main/config.js',
    sourceType: 'github',
    detectionTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'new',
    contextSnippet: 'const firebaseConfig = { apiKey: "AIzaSyMock...", ... };',
    keyType: 'Google API Key',
    entropy: 4.5,
    repository: 'mockuser/mockproject',
    filePath: 'src/config.js',
    isLikelyLeak: null,
    enhancedContext: null,
    isValid: null,
    accessibleResources: null,
    riskLevel: null,
    lastScanned: null,
    lastValidatedTimestamp: null,
  },
  {
    id: 'mock-2',
    keyHash: 'hash_of_AKIA_mock2',
    apiKeyPreview: 'AKIA...',
    sourceUrl: 'https://pastebin.com/mockabcdef',
    sourceType: 'pastebin',
    detectionTimestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'investigating',
    contextSnippet: 'AWS_ACCESS_KEY_ID=AKIAMOCK...',
    keyType: 'AWS Access Key',
    entropy: 4.1,
    isLikelyLeak: true,
    enhancedContext: "Mock: Likely a real AWS key.",
    lastScanned: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isValid: true,
    accessibleResources: "Mock: S3 Buckets",
    riskLevel: "medium",
    lastValidatedTimestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

// It is recommended to remove or comment out the usage of mockLeaks 
// in useLeaks.ts once Firestore integration is confirmed to be working.
    
