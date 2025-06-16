export type ApiKeySource = 'github' | 'pastebin' | 'gitlab' | 'bitbucket' | 'dark_web_forum' | 'other';
export type LeakStatus = 'new' | 'investigating' | 'remediated' | 'false_positive' | 'validating' | 'error_enhancing';

export interface LeakedKey {
  id: string;
  keyHash: string;
  apiKeyPreview: string; 
  sourceUrl: string;
  sourceType: ApiKeySource;
  detectionTimestamp: string; // ISO date string
  status: LeakStatus;
  contextSnippet: string;
  keyType: string; 
  entropy?: number;
  isLikelyLeak?: boolean | null; // Can be null if not yet analyzed
  enhancedContext?: string | null; // Can be null if not yet analyzed
  repository?: string; 
  filePath?: string; 
  lastScanned?: string; // ISO date string for AI analysis
}

export interface FilterOptions {
  status: LeakStatus | 'all';
  sourceType: ApiKeySource | 'all';
  keyType: string | 'all'; // Assuming key types can be dynamic strings
  searchTerm: string;
}
