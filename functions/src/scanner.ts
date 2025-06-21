import { logger } from 'firebase-functions';
import { saveLeak } from './firestoreService';
import * as github from './githubClient';
import * as gitlab from './gitlabClient';
import { API_KEY_PATTERNS, calculateEntropy, extractSnippet, generateKeyHash } from './utils'; // Assuming this is where patterns come from
import type { Scan, GithubContent } from './types';

// --- CONFIGURATION (RESTORED) ---
const MAX_FILES_PER_REPO = 50;
const MAX_COMMITS_TO_SCAN = 5;
const MAX_FORKS_TO_SCAN = 3;
const ENTROPY_THRESHOLD = 4.5;

// --- UNIFIED TYPES for consistent processing ---
interface UnifiedFile { path: string; }
interface UnifiedCommit { id: string; }
interface UnifiedRepo { id: number | string; web_url: string; identifier: string; default_branch: string; }

// --- ADAPTER PATTERN: The standard interface our scanner will use ---
interface SourceControlClient {
  getTree(repoId: string | number): Promise<UnifiedFile[]>;
  getFileContent(repoId: string | number, path: string): Promise<string | null>;
  getCommits(repoId: string | number): Promise<UnifiedCommit[]>;
  getForks(repoId: string | number): Promise<UnifiedRepo[]>;
}

// --- ADAPTER PATTERN: Adapter for GitHub ---
const githubAdapter: SourceControlClient = {
  async getTree(repoFullName: string): Promise<UnifiedFile[]> {
    const [owner, repo] = repoFullName.split('/');
    const contents = await github.getRepositoryContents(owner, repo);
    return (Array.isArray(contents) ? contents : [contents]).map(c => ({ path: c.path }));
  },
  async getFileContent(repoFullName: string, path: string): Promise<string | null> {
    const [owner, repo] = repoFullName.split('/');
    const contentInfo = await github.getRepositoryContents(owner, repo, path) as GithubContent;
    
    if (contentInfo) {
      // Prefer the direct content if available (for files < 1MB)
      if (contentInfo.content) {
        return Buffer.from(contentInfo.content, 'base64').toString('utf8');
      }
      // Fallback to download_url for larger files
      if (contentInfo.download_url) {
        return await github.getFileContent(contentInfo.download_url);
      }
    }
    return null;
  },
  async getCommits(repoFullName: string): Promise<UnifiedCommit[]> {
    const [owner, repo] = repoFullName.split('/');
    const commits = await github.getRepositoryCommits(owner, repo, MAX_COMMITS_TO_SCAN);
    return commits.map(c => ({ id: c.sha }));
  },
  async getForks(repoFullName: string): Promise<UnifiedRepo[]> {
    const [owner, repo] = repoFullName.split('/');
    const forks = await github.getRepositoryForks(owner, repo, MAX_FORKS_TO_SCAN);
    return forks.map(f => ({ id: f.id, web_url: f.html_url, identifier: f.full_name, default_branch: f.default_branch }));
  },
};

// --- ADAPTER PATTERN: Adapter for GitLab ---
const gitlabAdapter: SourceControlClient = {
  async getTree(projectId: number): Promise<UnifiedFile[]> {
    const items = await gitlab.getProjectRepositoryTree(projectId, '', true);
    return items.map(item => ({ path: item.path }));
  },
  getFileContent: (projectId, path) => gitlab.getProjectFileRaw(projectId, path),
  async getCommits(projectId: number): Promise<UnifiedCommit[]> {
    const commits = await gitlab.getProjectCommits(projectId, MAX_COMMITS_TO_SCAN);
    return commits.map(c => ({ id: c.id }));
  },
  async getForks(projectId: number): Promise<UnifiedRepo[]> {
    const forks = await gitlab.getProjectForks(projectId, MAX_FORKS_TO_SCAN);
    return forks.map(f => ({ id: f.id, web_url: f.web_url, identifier: f.path_with_namespace, default_branch: f.default_branch || 'main' }));
  },
};

// --- CORE SCANNING LOGIC ---

async function scanContentForLeaks(
  content: string | null,
  sourceUrl: string,
  sourceType: 'GitHub' | 'GitLab',
  filePath: string,
  repositoryFullName: string
): Promise<void> {
  if (!content) return;
  const lines = content.split('\n');
  for (const line of lines) {
    for (const pattern of API_KEY_PATTERNS) {
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        const key = match[0];
        await saveLeak({
          apiKeyPreview: `${key.substring(0, 4)}...${key.substring(key.length - 4)}`,
          keyHash: generateKeyHash(key),
          keyType: pattern.name, sourceType, sourceUrl,
          contextSnippet: extractSnippet(line, match.index),
          entropy: calculateEntropy(key), repository: repositoryFullName, filePath,
        });
      }
    }
    const words = line.split(/\s+|\b|[=\(\){\}\[\]"';:,<>`]+/).filter(w => w.length > 20 && w.length < 100);
    for (const word of words) {
      if (API_KEY_PATTERNS.some(p => p.regex.test(word))) continue;
      const entropy = calculateEntropy(word);
      if (entropy > ENTROPY_THRESHOLD) {
        await saveLeak({
          apiKeyPreview: `${word.substring(0, 4)}...${word.substring(word.length - 4)}`,
          keyHash: generateKeyHash(word),
          keyType: 'High Entropy String', sourceType, sourceUrl,
          contextSnippet: extractSnippet(line, line.indexOf(word)),
          entropy, repository: repositoryFullName, filePath,
        });
      }
    }
  }
}

async function genericScanner(repo: UnifiedRepo, client: SourceControlClient, sourceType: 'GitHub' | 'GitLab'): Promise<void> {
    logger.info(`Processing ${sourceType} repository: ${repo.identifier}`);
    try {
        const files = await client.getTree(repo.id);
        for (const file of files.slice(0, MAX_FILES_PER_REPO)) {
            const content = await client.getFileContent(repo.id, file.path);
            // Use the dynamic default_branch for constructing the URL
            const fileUrl = `${repo.web_url}/-/blob/${repo.default_branch}/${file.path}`;
            await scanContentForLeaks(content, fileUrl, sourceType, file.path, repo.identifier);
        }
    } catch (error) {
        logger.error(`Error processing files for ${repo.identifier}:`, error);
    }
}

// --- EXPORTED TRIGGER FUNCTION ---

export async function performScan(scan: Scan): Promise<void> {
  logger.info(`Scan request for ${scan.provider}:${scan.repoName}`);
  try {
      if (scan.provider === 'github') {
          const searchResult = await github.searchRepositories(`repo:${scan.repoName}`, 1, 1);
          if (searchResult.items && searchResult.items.length > 0) {
              const repo = searchResult.items[0];
              const unifiedRepo: UnifiedRepo = { 
                id: repo.full_name, 
                web_url: repo.html_url, 
                identifier: repo.full_name,
                default_branch: repo.default_branch 
              };
              await genericScanner(unifiedRepo, githubAdapter, 'GitHub');
          } else {
              logger.warn(`Repository ${scan.repoName} not found via search.`);
          }
      } else if (scan.provider === 'gitlab') {
          const searchResult = await gitlab.searchProjects(scan.repoName, 1, 1);
          if (searchResult && searchResult.length > 0) {
              const project = searchResult[0];
              const unifiedRepo: UnifiedRepo = {
                  id: project.id,
                  web_url: project.web_url,
                  identifier: project.path_with_namespace,
                  default_branch: project.default_branch || 'main',
              };
              await genericScanner(unifiedRepo, gitlabAdapter, 'GitLab');
          } else {
              logger.warn(`GitLab project ${scan.repoName} not found via search.`);
          }
      }
  } catch (error) {
      logger.error(`Critical failure in performScan for ${scan.repoName}:`, error);
  }
}
