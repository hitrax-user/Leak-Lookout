import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from 'firebase-functions';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { sleep } from './utils';
import type { GitlabProject, GitlabCommit, GitlabRepositoryTreeItem } from './types';


const GITLAB_API_BASE_URL = 'https://gitlab.com/api/v4';
const MAX_RETRIES = 3;
const RETRY_DELAY_MIN_MS = 500;
const RETRY_DELAY_MAX_MS = 2000;

let gitlabApiKey: string | null = null;
const secretManager = new SecretManagerServiceClient();

async function getGitlabApiKey(): Promise<string> {
  if (gitlabApiKey) {
    return gitlabApiKey;
  }
  const secretName = process.env.GITLAB_API_KEY_SECRET_NAME || 'GITLAB_API_KEY';
  try {
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${process.env.GCLOUD_PROJECT}/secrets/${secretName}/versions/latest`,
    });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error('GitLab API Key secret payload is empty.');
    }
    gitlabApiKey = payload;
    return gitlabApiKey;
  } catch (error) {
    logger.error('Failed to access GitLab API Key from Secret Manager:', error);
    throw new Error('Could not retrieve GitLab API Key. Ensure the secret is configured and permissions are set.');
  }
}

async function makeApiRequest<T>(
  path: string,
  params?: Record<string, any>,
  method: 'get' | 'post' = 'get',
  data?: any
): Promise<T> {
  const apiKey = await getGitlabApiKey();
  const client: AxiosInstance = axios.create({
    baseURL: GITLAB_API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${apiKey}`, // GitLab uses Bearer token
      'Content-Type': 'application/json',
    },
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.request<T>({ url: path, method, params, data });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(`GitLab API request failed (attempt ${attempt}/${MAX_RETRIES}): ${axiosError.message}`, { path, params, status: axiosError.response?.status });
      if (axiosError.response?.status === 429) {
        logger.warn('GitLab rate limit hit. Waiting before retry...');
         const retryAfterHeader = axiosError.response.headers['retry-after'];
        let delay = RETRY_DELAY_MIN_MS + Math.random() * (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS);
        if (retryAfterHeader) {
            delay = parseInt(retryAfterHeader as string, 10) * 1000;
        }
        if (attempt === MAX_RETRIES) {
            logger.error('Max retries reached for GitLab API request.', { path });
            throw error;
        }
        logger.info(`Retrying GitLab API request in ${delay / 1000} seconds...`);
        await sleep(delay);
      } else if (attempt === MAX_RETRIES || (axiosError.response && axiosError.response.status < 500 && axiosError.response.status !== 404)) {
         throw error;
      } else {
        await sleep(RETRY_DELAY_MIN_MS + Math.random() * (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS));
      }
    }
  }
  throw new Error(`GitLab API request failed after ${MAX_RETRIES} retries: ${path}`);
}

export async function searchProjects(search: string, page: number = 1, per_page: number = 20): Promise<GitlabProject[]> {
  // GitLab project search.
  // https://docs.gitlab.com/ee/api/projects.html#list-all-projects
  // 'search' searches in name and path. For broader search, consider 'scope=all' for public projects.
  // GitLab's search capabilities might be different from GitHub's for keywords in README/description.
  // This will list public projects if the token has appropriate scope.
  // `visibility=public` is important.
  // `with_programming_language=true` can be useful with `language` filter.
  // The query needs to be constructed carefully based on desired languages and keywords.
  // For example, iterate through languages and keywords for separate queries if API doesn't support complex OR.
  return makeApiRequest<GitlabProject[]>('/projects', { search, visibility: 'public', simple: true, order_by: 'last_activity_at', sort: 'desc', page, per_page });
}

export async function getProjectRepositoryTree(projectId: number | string, path: string = '', recursive: boolean = false): Promise<GitlabRepositoryTreeItem[]> {
  // path is relative to the repository root.
  // recursive=true to get all files and directories.
  return makeApiRequest<GitlabRepositoryTreeItem[]>(`/projects/${projectId}/repository/tree`, { path, recursive, per_page: 100 }); // Max per_page is 100
}

export async function getProjectFileRaw(projectId: number | string, filePath: string, ref: string = 'main'): Promise<string | null> {
  try {
    // ref can be a branch, tag, or commit SHA
    // The path should be URL-encoded.
    const encodedFilePath = encodeURIComponent(filePath);
    const response = await makeApiRequest<string>(`/projects/${projectId}/repository/files/${encodedFilePath}/raw`, { ref }, 'get');
    return response; // Axios by default decodes based on content-type, hopefully handles text correctly.
  } catch (error) {
     const axiosError = error as AxiosError;
    if (axiosError.response && axiosError.response.status === 404) {
      logger.warn(`File ${filePath} not found at ref ${ref} in project ${projectId}`);
      return null;
    }
    logger.error(`Error fetching raw file for project ${projectId}, path ${filePath}, ref ${ref}:`, error);
    throw error;
  }
}


export async function getProjectCommits(projectId: number | string, per_page: number = 10, page: number = 1): Promise<GitlabCommit[]> {
  return makeApiRequest<GitlabCommit[]>(`/projects/${projectId}/repository/commits`, { per_page, page });
}

// getProjectFileRaw can be used with commit SHA in 'ref' parameter to get file content at commit.

export async function getProjectForks(projectId: number | string, per_page: number = 10, page: number = 1): Promise<GitlabProject[]> {
  // GitLab API for forks lists projects that were forked from this project.
  // Or use /projects/:id/forks to fork a project (POST), this lists forks of this project.
  return makeApiRequest<GitlabProject[]>(`/projects/${projectId}/forks`, { per_page, page, simple: true, order_by: 'last_activity_at', sort: 'desc'});
}
