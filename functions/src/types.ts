import * as admin from 'firebase-admin';

// GitHub API Types
export interface GithubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GithubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  default_branch: string;
}

export interface GithubContent {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export interface GithubCommit {
  sha: string;
  html_url: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  author: GithubUser | null; // Can be null if author is not a GitHub user
  files?: {filename: string, status: string, raw_url: string}[]; // Present in commit details, not list
}

export interface GithubFork extends GithubRepo {}


// GitLab API Types
export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitlabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  created_at: string;
  last_activity_at: string;
  default_branch: string | null;
  archived: boolean;
  visibility: 'public' | 'internal' | 'private';
  owner?: GitlabUser; // May not always be present in all endpoints
  forks_count?: number; // May not always be present
  star_count?: number; // May not always be present
  topics?: string[];
  programming_languages?: Record<string, number>; // Example: { "Python": 60.0, "JavaScript": 40.0 }
}

export interface GitlabFile { // Simplified from file content endpoint
  file_name: string;
  file_path: string;
  size: number;
  encoding: string; // e.g., "base64"
  content: string; // Base64 encoded content
  ref: string; // branch/tag/commit SHA
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

export interface GitlabRepositoryTreeItem {
    id: string; // SHA
    name: string;
    path: string;
    type: 'tree' | 'blob'; // tree is directory, blob is file
    mode: string; // file mode
}


export interface GitlabCommit {
  id: string; // SHA
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string; // ISO 8601
  created_at: string; // ISO 8601
  web_url: string;
}


// Firestore Leak Document Structure (for saving to Firestore)
// This is what the Cloud Function will write.
export interface LeakedKeyDocument {
  id: string; // Firestore Document ID
  apiKeyPreview: string;
  keyHash: string; // SHA256 hash of the key
  keyType: string; // e.g., 'AWS Access Key', 'High Entropy String'
  sourceType: 'GitHub' | 'GitLab';
  sourceUrl: string; // URL to the file or commit
  contextSnippet: string; // Snippet of code around the key
  detectionTimestamp: admin.firestore.FieldValue; // Server timestamp
  status: 'new' | 'investigating' | 'remediated' | 'false_positive'; // Default to 'new'
  entropy?: number;
  repository?: string; // e.g., 'owner/repo' or 'group/project'
  filePath?: string;
  // Fields for AI analysis results (matching LeakedKey in src/lib/types.ts)
  isLikelyLeak?: boolean | null;
  enhancedContext?: string | null;
  isValid?: boolean | null;
  accessibleResources?: string | null;
  riskLevel?: string | null;
  lastScanned?: string | admin.firestore.FieldValue | null; // ISO date string or server timestamp
  lastValidatedTimestamp?: string | admin.firestore.FieldValue | null; // ISO date string or server timestamp
}

// For creating new leaks before saving (detectionTimestamp will be set by server)
export type PartialLeakedKey = Omit<LeakedKeyDocument, 'id' | 'detectionTimestamp' | 'status' | 
                                 'isLikelyLeak' | 'enhancedContext' | 'isValid' | 
                                 'accessibleResources' | 'riskLevel' | 'lastScanned' | 'lastValidatedTimestamp'>;


// Scan Configuration/Status Type for Firestore
export interface ScanConfig {
  isPaused: boolean;
  lastRunStart: admin.firestore.Timestamp | null;
  lastRunFinish: admin.firestore.Timestamp | null;
}
