export type ApiKeySource = 'github' | 'pastebin' | 'gitlab' | 'bitbucket' | 'dark_web_forum' | 'other' | 'GitHub' | 'GitLab'; // Added GitHub/GitLab variations
export type LeakStatus = 
  | 'new' 
  | 'investigating' 
  | 'remediated' 
  | 'false_positive' 
  | 'enhancing_context'
  | 'validating_key'
  | 'error_enhancing_context'
  | 'error_validating_key';

export interface LeakedKey {
  id: string; // Firestore Document ID
  keyHash: string; // SHA256 hash of the key
  apiKeyPreview: string; 
  sourceUrl: string;
  sourceType: ApiKeySource;
  detectionTimestamp: string; // ISO date string (converted from Firestore Timestamp)
  status: LeakStatus;
  contextSnippet: string;
  keyType: string; 
  entropy?: number;
  isLikelyLeak?: boolean | null;
  enhancedContext?: string | null;
  repository?: string; 
  filePath?: string; 
  lastScanned?: string | null; // ISO date string for AI context enhancement
  isValid?: boolean | null;
  accessibleResources?: string | null;
  riskLevel?: string | null;
  lastValidatedTimestamp?: string | null; // ISO date string for key validation
}

export interface FilterOptions {
  status: LeakStatus | 'all';
  sourceType: ApiKeySource | 'all';
  keyType: string | 'all';
  searchTerm: string;
}

// This interface is for data coming from Firestore for the client.
// Timestamps will be Firestore Timestamps and need conversion.
export interface LeakedKeyFromFirestore {
  id: string;
  keyHash: string;
  apiKeyPreview: string; 
  sourceUrl: string;
  sourceType: ApiKeySource;
  detectionTimestamp: any; // Firestore Timestamp, will be converted
  status: LeakStatus;
  contextSnippet: string;
  keyType: string; 
  entropy?: number;
  isLikelyLeak?: boolean | null;
  enhancedContext?: string | null;
  repository?: string; 
  filePath?: string; 
  lastScanned?: any | null; // Firestore Timestamp or ISO string
  isValid?: boolean | null;
  accessibleResources?: string | null;
  riskLevel?: string | null;
  lastValidatedTimestamp?: any | null; // Firestore Timestamp or ISO string
}
