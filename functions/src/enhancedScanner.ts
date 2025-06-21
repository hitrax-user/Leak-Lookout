/**
 * @fileOverview Улучшенный сканер с параллельной обработкой и оптимизированной логикой
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
const BATCH_SIZE = 10; // Количество файлов, обрабатываемых параллельно
const DELAY_BETWEEN_BATCHES = 1000; // Задержка между пакетами в миллисекундах

// --- ТИПЫ ДЛЯ УНИФИЦИРОВАННОЙ ОБРАБОТКИ ---
interface UnifiedFile {
  path: string;
  size?: number;
  type?: string;
  url?: string;
}

interface UnifiedRepo {
  id: number | string;
  web_url: string;
  identifier: string;
  provider: 'github' | 'gitlab';
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
 * Обрабатывает репозиторий
 * @param repo Унифицированный репозиторий
 * @returns Массив обнаруженных утечек
 */
async function processRepository(repo: UnifiedRepo): Promise<PartialLeakedKey[]> {
  try {
    // Получаем список файлов
    const allFiles = await getRepositoryFiles(repo);
    
    // Фильтруем нерелевантные файлы
    const relevantFiles = filterRelevantFiles(allFiles);
    logger.info(`Processing ${relevantFiles.length} relevant files out of ${allFiles.length} in ${repo.identifier}`);
    
    // Обрабатываем файлы пакетами
    const results = await processBatch(
      relevantFiles,
      (file) => processFile(repo, file),
      {
        batchSize: BATCH_SIZE,
        delayBetweenBatches: DELAY_BETWEEN_BATCHES,
        maxRetries: 3
      }
    );
    
    // Собираем все обнаруженные утечки
    const leaks: PartialLeakedKey[] = [];
    for (const result of results) {
      if (result.success && result.result) {
        leaks.push(...result.result);
      }
    }
    
    logger.info(`Found ${leaks.length} potential leaks in ${repo.identifier}`);
    return leaks;
  } catch (error) {
    logger.error(`Error processing repository ${repo.identifier}:`, error);
    return [];
  }
}

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
      logger.warn(`GitLab scanning by name not implemented for: ${scan.repoName}`);
    }
    
    return [];
  } catch (error) {
    logger.error(`Critical failure in performScan for ${scan.repoName}:`, error);
    throw error;
  }
}
