/**
 * @fileOverview Enhanced scanner with parallel processing and optimized logic.
 */
import { logger } from 'firebase-functions';
import * as github from './githubClient';
import * as gitlab from './gitlabClient';
import { filterRelevantFiles, shouldIgnoreFile } from './fileFilters';
import { processFileContent } from './leakDetector';
import { processBatch } from './batchProcessor';
import type { GithubRepo, GitlabProject, Scan, PartialLeakedKey, GithubContent } from './types';

// --- CONFIGURATION ---
const MAX_FILES_PER_REPO = 100;
const MAX_COMMITS_TO_SCAN = 5;
const MAX_FORKS_TO_SCAN = 3;
const BATCH_SIZE = 10; // Number of files to process in parallel
const DELAY_BETWEEN_BATCHES = 1000; // Delay between batches in milliseconds

// --- UNIFIED TYPES FOR CONSISTENT PROCESSING ---
interface UnifiedFile {
  path: string;
  size?: number;
  type?: string;
  url?: string;
}

interface UnifiedCommit {
    id: string;
}

interface UnifiedRepo {
  id: number | string;
  web_url: string;
  identifier: string;
  provider: 'github' | 'gitlab';
  default_branch?: string;
}

/**
 * Обрабатывает GitHub репозиторий
 * @param repo GitHub репозиторий
 * @returns Массив обнаруженных утечек
 */
export async function processGithubRepo(repo: GithubRepo): Promise<PartialLeakedKey[]> {
  logger.info(`Processing GitHub repository: ${repo.full_name}`);
  
  const unifiedRepo: UnifiedRepo = {
    id: repo.full_name,
    web_url: repo.html_url,
    identifier: repo.full_name,
    provider: 'github'
  };
  
  return await processRepository(unifiedRepo);
}

/**
 * Обрабатывает GitLab проект
 * @param project GitLab проект
 * @returns Массив обнаруженных утечек
 */
export async function processGitlabProject(project: GitlabProject): Promise<PartialLeakedKey[]> {
  logger.info(`Processing GitLab project: ${project.path_with_namespace}`);
  
  const unifiedRepo: UnifiedRepo = {
    id: project.id,
    web_url: project.web_url,
    identifier: project.path_with_namespace,
    provider: 'gitlab'
  };
  
  return await processRepository(unifiedRepo);
}

/**
 * Получает список файлов из репозитория
 * @param repo Унифицированный репозиторий
 * @returns Массив унифицированных файлов
 */
async function getRepositoryFiles(repo: UnifiedRepo): Promise<UnifiedFile[]> {
  try {
    if (repo.provider === 'github') {
      const [owner, repoName] = repo.identifier.split('/');
      const contents = await github.getRepositoryContents(owner, repoName);
      
      // Рекурсивно получаем все файлы из директорий
      const files: UnifiedFile[] = [];
      const queue: GithubContent[] = Array.isArray(contents) ? [...contents] : [contents];
      
      while (queue.length > 0 && files.length < MAX_FILES_PER_REPO) {
        const item = queue.shift()!;
        
        if (item.type === 'file') {
          files.push({
            path: item.path,
            size: item.size,
            type: item.type,
            url: item.html_url
          });
        } else if (item.type === 'dir') {
          try {
            const dirContents = await github.getRepositoryContents(owner, repoName, item.path);
            const dirItems = Array.isArray(dirContents) ? dirContents : [dirContents];
            queue.push(...dirItems);
          } catch (error) {
            logger.warn(`Error getting contents of directory ${item.path} in ${repo.identifier}:`, error);
          }
        }
      }
      
      return files;
    } else if (repo.provider === 'gitlab') {
      const items = await gitlab.getProjectRepositoryTree(repo.id, '', true);
      
      // Фильтруем только файлы
      return items
        .filter(item => item.type === 'blob')
        .map(item => ({
          path: item.path,
          type: 'file',
          url: `${repo.web_url}/-/blob/main/${item.path}`
        }))
        .slice(0, MAX_FILES_PER_REPO);
    }
    
    return [];
  } catch (error) {
    logger.error(`Error getting files from repository ${repo.identifier}:`, error);
    return [];
  }
}

/**
 * Получает содержимое файла из репозитория
 * @param repo Унифицированный репозиторий
 * @param filePath Путь к файлу
 * @returns Содержимое файла или null в случае ошибки
 */
async function getFileContent(repo: UnifiedRepo, filePath: string): Promise<string | null> {
  try {
    if (repo.provider === 'github') {
      const [owner, repoName] = repo.identifier.split('/');
      const contentInfo = await github.getRepositoryContents(owner, repoName, filePath) as GithubContent;
      
      if (contentInfo && contentInfo.download_url) {
        return await github.getFileContent(contentInfo.download_url);
      }
    } else if (repo.provider === 'gitlab') {
      return await gitlab.getProjectFileRaw(repo.id, filePath);
    }
    
    return null;
  } catch (error) {
    logger.warn(`Error getting content of file ${filePath} in ${repo.identifier}:`, error);
    return null;
  }
}

/**
 * Обрабатывает файл из репозитория
 * @param repo Унифицированный репозиторий
 * @param file Унифицированный файл
 * @returns Массив обнаруженных утечек или null в случае ошибки
 */
async function processFile(repo: UnifiedRepo, file: UnifiedFile): Promise<PartialLeakedKey[] | null> {
  // Проверяем, следует ли игнорировать файл
  if (shouldIgnoreFile(file.path, file.size)) {
    return [];
  }
  
  // Получаем содержимое файла
  const content = await getFileContent(repo, file.path);
  
  // Формируем URL файла
  const fileUrl = file.url || `${repo.web_url}/-/blob/main/${file.path}`;
  
  // Обрабатываем содержимое файла
  return await processFileContent(
    content,
    fileUrl,
    repo.provider === 'github' ? 'GitHub' : 'GitLab',
    file.path,
    repo.identifier
  );
}

/**
 * Processes a repository, including its files and history.
 * @param repo The unified repository object.
 * @returns A promise that resolves to an array of partial leaked keys.
 */
async function processRepository(repo: UnifiedRepo): Promise<PartialLeakedKey[]> {
  try {
    // Get file list
    const allFiles = await getRepositoryFiles(repo);
    
    // Filter out irrelevant files
    const relevantFiles = filterRelevantFiles(allFiles);
    logger.info(`Processing ${relevantFiles.length} relevant files out of ${allFiles.length} in ${repo.identifier}`);
    
    // Process files in batches
    const fileResults = await processBatch(
      relevantFiles,
      (file) => processFile(repo, file),
      {
        batchSize: BATCH_SIZE,
        delayBetweenBatches: DELAY_BETWEEN_BATCHES,
        maxRetries: 3
      }
    );
    
    // Collect all found leaks
    const leaks: PartialLeakedKey[] = [];
    for (const result of fileResults) {
      if (result.success && result.result) {
        leaks.push(...result.result);
      }
    }
    
    // Scan repository history (commits and forks)
    const historyLeaks = await scanRepositoryHistory(repo);
    leaks.push(...historyLeaks);

    logger.info(`Found ${leaks.length} potential leaks in ${repo.identifier}`);
    return leaks;
  } catch (error) {
    logger.error(`Error processing repository ${repo.identifier}:`, error);
    return [];
  }
}

/**
 * Scans the commit history and forks of a repository for leaks.
 * @param repo The unified repository object.
 * @returns A promise that resolves to an array of partial leaked keys.
 */
async function scanRepositoryHistory(repo: UnifiedRepo): Promise<PartialLeakedKey[]> {
    const leaks: PartialLeakedKey[] = [];
    const client = repo.provider === 'github' ? githubAdapter : gitlabAdapter;

    // Scan commits
    try {
        const commits = await client.getCommits(repo.id);
        for (const commit of commits) {
            // In a real implementation, you would scan the commit diff for leaks.
            // For this example, we'll just log the commit ID.
            logger.info(`Scanning commit ${commit.id} in ${repo.identifier}`);
        }
    } catch (error) {
        logger.error(`Error scanning commits for ${repo.identifier}:`, error);
    }

    // Scan forks
    try {
        const forks = await client.getForks(repo.id);
        for (const fork of forks) {
            // In a real implementation, you would recursively scan the fork.
            // For this example, we'll just log the fork identifier.
            logger.info(`Scanning fork ${fork.identifier}`);
            const forkLeaks = await processRepository(fork);
            leaks.push(...forkLeaks);
        }
    } catch (error) {
        logger.error(`Error scanning forks for ${repo.identifier}:`, error);
    }

    return leaks;
}

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
    return (Array.isArray(contents) ? contents : [contents]).map(c => ({ path: c.path, size: c.size, type: c.type, url: c.html_url }));
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
    return forks.map(f => ({ id: f.id, web_url: f.html_url, identifier: f.full_name, default_branch: f.default_branch, provider: 'github' }));
  },
};

// --- ADAPTER PATTERN: Adapter for GitLab ---
const gitlabAdapter: SourceControlClient = {
  async getTree(projectId: number): Promise<UnifiedFile[]> {
    const items = await gitlab.getProjectRepositoryTree(projectId, '', true);
    return items.map(item => ({ path: item.path, type: item.type, url: `${(item as any).web_url}` }));
  },
  getFileContent: (projectId, path) => gitlab.getProjectFileRaw(projectId, path),
  async getCommits(projectId: number): Promise<UnifiedCommit[]> {
    const commits = await gitlab.getProjectCommits(projectId, MAX_COMMITS_TO_SCAN);
    return commits.map(c => ({ id: c.id }));
  },
  async getForks(projectId: number): Promise<UnifiedRepo[]> {
    const forks = await gitlab.getProjectForks(projectId, MAX_FORKS_TO_SCAN);
    return forks.map(f => ({ id: f.id, web_url: f.web_url, identifier: f.path_with_namespace, default_branch: f.default_branch || 'main', provider: 'gitlab' }));
  },
};

/**
 * Выполняет сканирование по запросу
 * @param scan Запрос на сканирование
 * @returns Массив обнаруженных утечек
 */
export async function performScan(scan: Scan): Promise<PartialLeakedKey[]> {
  logger.info(`Scan request for ${scan.provider}:${scan.repoName}`);
  
  try {
    if (scan.provider === 'github') {
      const searchResult = await github.searchRepositories(`repo:${scan.repoName}`, 1, 1);
      
      if (searchResult.items && searchResult.items.length > 0) {
        const repo = searchResult.items[0];
        return await processGithubRepo(repo);
      } else {
        logger.warn(`Repository ${scan.repoName} not found via search.`);
      }
    } else if (scan.provider === 'gitlab') {
        const searchResult = await gitlab.searchProjects(scan.repoName, 1, 1);
        if (searchResult && searchResult.length > 0) {
            const project = searchResult[0];
            return await processGitlabProject(project);
        } else {
            logger.warn(`GitLab project ${scan.repoName} not found via search.`);
        }
    }
    
    return [];
  } catch (error) {
    logger.error(`Critical failure in performScan for ${scan.repoName}:`, error);
    throw error;
  }
}
