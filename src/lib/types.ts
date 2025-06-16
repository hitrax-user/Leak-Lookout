export type ApiKeySource = 'github' | 'pastebin' | 'gitlab' | 'bitbucket' | 'dark_web_forum' | 'other';
export type LeakStatus = 
  | 'new' 
  | 'investigating' 
  | 'remediated' 
  | 'false_positive' 
  | 'enhancing_context' // formerly 'validating'
  | 'validating_key'    // new
  | 'error_enhancing_context' // formerly 'error_enhancing'
  | 'error_validating_key';   // new

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
  lastScanned?: string; // ISO date string for AI context enhancement
  isValid?: boolean | null; // New: for key validation
  accessibleResources?: string | null; // New: for key validation
  riskLevel?: string | null; // New: for key validation (e.g., high, medium, low)
  lastValidatedTimestamp?: string; // New: ISO date string for key validation
}

export interface FilterOptions {
  status: LeakStatus | 'all';
  sourceType: ApiKeySource | 'all';
  keyType: string | 'all'; // Assuming key types can be dynamic strings
  searchTerm: string;
}
