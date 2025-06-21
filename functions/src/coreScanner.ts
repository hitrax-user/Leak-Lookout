/**
 * @fileOverview Core logic for scanning repositories, shared by scheduled and manual triggers.
 */
import { logger } from 'firebase-functions';
import { searchRepositories as searchGithubRepositories } from './githubClient';
import { searchProjects as searchGitlabProjects } from './gitlabClient';
import { processGithubRepo, processGitlabProject } from './enhancedScanner';
import { processBatch } from './batchProcessor';

const GITHUB_LANGUAGES_QUERY = 'language:javascript language:python language:go';
const KEYWORDS_QUERY_PART = 'api_key OR secret OR token OR "api key" OR "access_token" OR "access token" OR "client_secret" OR "client secret"';
const GITHUB_SEARCH_QUERY = `${GITHUB_LANGUAGES_QUERY} ${KEYWORDS_QUERY_PART} in:readme in:description`;
const GITLAB_SEARCH_KEYWORDS = ['api_key', 'secret', 'token', 'config', 'credentials'];

const REPOS_PER_PROVIDER_PER_RUN = 50;

export async function executeScanLogic(triggerId: string = 'unknown-trigger'): Promise<void> {
  logger.info('Starting core scan logic.', { triggerId });

  try {
    // Fetch GitHub Repositories
    logger.info(`Searching GitHub with query: ${GITHUB_SEARCH_QUERY}`, { triggerId });
    const githubResult = await searchGithubRepositories(GITHUB_SEARCH_QUERY, 1, REPOS_PER_PROVIDER_PER_RUN);
    logger.info(`Found ${githubResult.total_count} GitHub repositories matching criteria. Processing up to ${REPOS_PER_PROVIDER_PER_RUN}.`, { triggerId });

    // Обрабатываем GitHub репозитории пакетами для оптимизации производительности
    const githubResults = await processBatch(
      githubResult.items,
      processGithubRepo,
      {
        batchSize: 5, // Обрабатываем по 5 репозиториев одновременно
        delayBetweenBatches: 2000, // 2 секунды между пакетами
        maxRetries: 2
      }
    );
    
    // Подсчитываем количество обнаруженных утечек
    const githubLeaksCount = githubResults
      .filter(r => r.success && r.result)
      .reduce((total, r) => total + (r.result?.length || 0), 0);
    
    logger.info(`Processed ${githubResults.length} GitHub repositories. Found ${githubLeaksCount} potential leaks.`, { triggerId });
  } catch (error) {
    logger.error('Error during GitHub repository search or processing phase:', error, { triggerId });
  }

  try {
    // Fetch GitLab Projects
    logger.info(`Searching GitLab with keywords: ${GITLAB_SEARCH_KEYWORDS.join(', ')}`, { triggerId });
    let gitlabProjectsFound = [];
    for (const keyword of GITLAB_SEARCH_KEYWORDS) {
        if (gitlabProjectsFound.length >= REPOS_PER_PROVIDER_PER_RUN) break;
        try {
          const projects = await searchGitlabProjects(keyword, 1, Math.max(10, REPOS_PER_PROVIDER_PER_RUN / GITLAB_SEARCH_KEYWORDS.length) );
          gitlabProjectsFound.push(...projects);
        } catch (searchError) {
           logger.error(`Error searching GitLab projects for keyword "${keyword}":`, searchError, { triggerId });
        }
    }
    const uniqueGitlabProjects = Array.from(new Map(gitlabProjectsFound.map(p => [p.id, p])).values())
      .filter(p => !p.archived)
      .slice(0, REPOS_PER_PROVIDER_PER_RUN);
    
    logger.info(`Found ${uniqueGitlabProjects.length} unique GitLab projects matching criteria. Processing up to ${REPOS_PER_PROVIDER_PER_RUN}.`, { triggerId });

    // Обрабатываем GitLab проекты пакетами для оптимизации производительности
    const gitlabResults = await processBatch(
      uniqueGitlabProjects,
      processGitlabProject,
      {
        batchSize: 5, // Обрабатываем по 5 проектов одновременно
        delayBetweenBatches: 2000, // 2 секунды между пакетами
        maxRetries: 2
      }
    );
    
    // Подсчитываем количество обнаруженных утечек
    const gitlabLeaksCount = gitlabResults
      .filter(r => r.success && r.result)
      .reduce((total, r) => total + (r.result?.length || 0), 0);
    
    logger.info(`Processed ${gitlabResults.length} GitLab projects. Found ${gitlabLeaksCount} potential leaks.`, { triggerId });
  } catch (error) {
    logger.error('Error during GitLab project search or processing phase:', error, { triggerId });
  }

  logger.info('Core scan logic completed.', { triggerId });
}
