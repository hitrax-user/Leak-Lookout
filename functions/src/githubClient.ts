import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from 'firebase-functions';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { sleep } from './utils';
import type { GithubRepo, GithubContent, GithubCommit, GithubUser, GithubFork } from './types';

const GITHUB_API_BASE_URL = 'https://api.github.com';
const MAX_RETRIES = 3;
const RETRY_DELAY_MIN_MS = 500;
const RETRY_DELAY_MAX_MS = 2000;

let githubApiKey: string | null = null;
const secretManager = new SecretManagerServiceClient();

async function getGithubApiKey(): Promise<string> {
  if (githubApiKey) {
    return githubApiKey;
  }
  const secretName = process.env.GITHUB_API_KEY_SECRET_NAME || 'GITHUB_API_KEY';
  // Ensure your Cloud Function's service account has roles/secretmanager.secretAccessor
  try {
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${process.env.GCLOUD_PROJECT}/secrets/${secretName}/versions/latest`,
    });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error('GitHub API Key secret payload is empty.');
    }
    githubApiKey = payload;
    return githubApiKey;
  } catch (error) {
    logger.error('Failed to access GitHub API Key from Secret Manager:', error);
    throw new Error('Could not retrieve GitHub API Key. Ensure the secret is configured and permissions are set.');
  }
}

async function makeApiRequest<T>(
  path: string,
  params?: Record<string, any>,
  method: 'get' | 'post' = 'get',
  data?: any
): Promise<T> {
  const apiKey = await getGithubApiKey();
  const client: AxiosInstance = axios.create({
    baseURL: GITHUB_API_BASE_URL,
    headers: {
      'Authorization': `token ${apiKey}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.request<T>({ url: path, method, params, data });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error(`GitHub API request failed (attempt ${attempt}/${MAX_RETRIES}): ${axiosError.message}`, { path, params, status: axiosError.response?.status });
      if (axiosError.response?.status === 429 || axiosError.response?.status === 403) { // 403 can indicate rate limit exceeded
        logger.warn('Rate limit likely hit. Waiting before retry...');
        const headers = axiosError.response.headers;
        const retryAfter = headers['retry-after'] ? parseInt(headers['retry-after'], 10) * 1000 : 0;
        const rateLimitReset = headers['x-ratelimit-reset'] ? (parseInt(headers['x-ratelimit-reset'], 10) * 1000) - Date.now() : 0;
        
        let delay = Math.max(retryAfter, rateLimitReset, RETRY_DELAY_MIN_MS + Math.random() * (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS));
        if (attempt === MAX_RETRIES) {
           logger.error('Max retries reached for GitHub API request.', { path });
           throw error;
        }
        logger.info(`Retrying GitHub API request in ${delay / 1000} seconds...`);
        await sleep(delay);

      } else if (attempt === MAX_RETRIES || (axiosError.response && axiosError.response.status < 500 && axiosError.response.status !== 404)) {
        // Don't retry for 404 or other client errors (unless specifically rate limit)
        throw error;
      } else {
         await sleep(RETRY_DELAY_MIN_MS + Math.random() * (RETRY_DELAY_MAX_MS - RETRY_DELAY_MIN_MS));
      }
    }
  }
  throw new Error(`GitHub API request failed after ${MAX_RETRIES} retries: ${path}`);
}


export async function searchRepositories(query: string, page: number = 1, per_page: number = 30): Promise<{ items: GithubRepo[], total_count: number }> {
  // Query example: "language:javascript language:python language:go api_key OR secret OR token in:readme in:description"
  // GitHub search API has a limit of 1000 results (usually 34 pages of 30 items).
  // And a rate limit of 30 requests per minute for authenticated users.
  return makeApiRequest<{ items: GithubRepo[], total_count: number }>('/search/repositories', { q: query, sort: 'updated', order: 'desc', page, per_page });
}

export async function getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<GithubContent[] | GithubContent> {
  return makeApiRequest<GithubContent[] | GithubContent>(`/repos/${owner}/${repo}/contents/${path}`);
}

export async function getFileContent(downloadUrl: string): Promise<string> {
    // download_url is directly accessible without auth usually, but using axios for consistency and potential private repos in future
    // For raw content, it's better to use the media type for raw files
    const apiKey = await getGithubApiKey(); // Ensure API key is available for consistency if switching to private repos
    const response = await axios.get(downloadUrl, {
        headers: { 
            'Authorization': `token ${apiKey}`,
            'Accept': 'application/vnd.github.raw' 
        },
        responseType: 'text' // Ensure text decoding
    });
    return response.data;
}


export async function getRepositoryCommits(owner: string, repo: string, per_page: number = 10, page: number = 1): Promise<GithubCommit[]> {
  // Gets commits, most recent first
  return makeApiRequest<GithubCommit[]>(`/repos/${owner}/${repo}/commits`, { per_page, page });
}

export async function getFileContentAtCommit(owner: string, repo: string, filePath: string, commitSha: string): Promise<string | null> {
  try {
    const content = await makeApiRequest<GithubContent>(`/repos/${owner}/${repo}/contents/${filePath}`, { ref: commitSha });
    if (content && 'download_url' in content && content.download_url) {
      // Using axios directly for download_url to ensure proper content fetching
      const rawContentResponse = await axios.get(content.download_url, { responseType: 'text' });
      return rawContentResponse.data;
    }
    return null;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response && axiosError.response.status === 404) {
      logger.warn(`File ${filePath} not found at commit ${commitSha} in ${owner}/${repo}`);
      return null; // File might not exist at this commit
    }
    logger.error(`Error fetching file content at commit ${commitSha} for ${owner}/${repo}/${filePath}:`, error);
    throw error;
  }
}

export async function getRepositoryForks(owner: string, repo: string, per_page: number = 10, page: number = 1): Promise<GithubFork[]> {
  // sorted by newest by default. stargazers_count, watchers_count, pushed_at, created_at, updated_at
  return makeApiRequest<GithubFork[]>(`/repos/${owner}/${repo}/forks`, { sort: 'pushed', per_page, page });
}
