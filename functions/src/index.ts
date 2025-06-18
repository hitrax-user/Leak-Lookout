import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions';
import { searchRepositories as searchGithubRepositories } from './githubClient';
import { searchProjects as searchGitlabProjects } from './gitlabClient';
import { processGithubRepo, processGitlabProject } from './scanner';
// Ensure Firebase Admin is initialized (typically done in modules that use it, like firestoreService)
import './firestoreService'; 

const GITHUB_LANGUAGES_QUERY = 'language:javascript language:python language:go';
const KEYWORDS_QUERY_PART = 'api_key OR secret OR token OR "api key" OR "access_token" OR "access token" OR "client_secret" OR "client secret"';
const GITHUB_SEARCH_QUERY = `${GITHUB_LANGUAGES_QUERY} ${KEYWORDS_QUERY_PART} in:readme in:description`;
const GITLAB_SEARCH_KEYWORDS = ['api_key', 'secret', 'token', 'config', 'credentials']; // GitLab search is simpler

const REPOS_PER_PROVIDER_PER_RUN = 50; // Total 100 repos (50 GitHub, 50 GitLab)

export const scheduledLeakScanner = functions
  .runWith({
    timeoutSeconds: 540, // Max timeout for a Cloud Function
    memory: '1GB', // Adjust as needed
    // secrets: [process.env.GITHUB_API_KEY_SECRET_NAME!, process.env.GITLAB_API_KEY_SECRET_NAME!], // For auto-wiring secrets
  })
  .pubsub.schedule('every 1 hours') // Alternatives: '0 * * * *' for cron, or 'every 60 minutes'
  // .timeZone('America/New_York') // Optional: specify timezone
  .onRun(async (context) => {
    logger.info('Leak scanning function triggered.', { eventId: context.eventId });

    try {
      // Fetch GitHub Repositories
      logger.info(`Searching GitHub with query: ${GITHUB_SEARCH_QUERY}`);
      // Note: GitHub search results can be paginated, but we fetch one page to stay within limits.
      // For a more thorough scan over time, you'd persist a 'last processed page' or similar.
      const githubResult = await searchGithubRepositories(GITHUB_SEARCH_QUERY, 1, REPOS_PER_PROVIDER_PER_RUN);
      logger.info(`Found ${githubResult.total_count} GitHub repositories matching criteria. Processing up to ${REPOS_PER_PROVIDER_PER_RUN}.`);

      for (const repo of githubResult.items) {
        try {
          await processGithubRepo(repo);
        } catch (repoError) {
          logger.error(`Error processing GitHub repo ${repo.full_name}:`, repoError);
          // Continue to next repo
        }
      }
    } catch (error) {
      logger.error('Error during GitHub repository search or processing phase:', error);
    }

    try {
      // Fetch GitLab Projects
      // GitLab search is simpler; we might iterate keywords if direct OR isn't well supported for README/description search.
      // For now, a general search then filtering by languages/keywords internally if needed.
      // Combining keywords for GitLab search (GitLab's search might behave differently)
      logger.info(`Searching GitLab with keywords: ${GITLAB_SEARCH_KEYWORDS.join(', ')}`);
      // This will search for each keyword. We need to combine results and limit.
      let gitlabProjectsFound = [];
      for (const keyword of GITLAB_SEARCH_KEYWORDS) {
          if (gitlabProjectsFound.length >= REPOS_PER_PROVIDER_PER_RUN) break;
          try {
            const projects = await searchGitlabProjects(keyword, 1, Math.max(10, REPOS_PER_PROVIDER_PER_RUN / GITLAB_SEARCH_KEYWORDS.length) ); // Fetch a few for each keyword
            gitlabProjectsFound.push(...projects);
          } catch (searchError) {
             logger.error(`Error searching GitLab projects for keyword "${keyword}":`, searchError);
          }
      }
      // Deduplicate and limit
      const uniqueGitlabProjects = Array.from(new Map(gitlabProjectsFound.map(p => [p.id, p])).values()).slice(0, REPOS_PER_PROVIDER_PER_RUN);
      
      logger.info(`Found ${uniqueGitlabProjects.length} unique GitLab projects matching criteria. Processing up to ${REPOS_PER_PROVIDER_PER_RUN}.`);

      for (const project of uniqueGitlabProjects) {
        // Additional filtering for languages can be done here if API doesn't support it well in search
        // e.g. by checking project.topics or project.programming_languages
        if (project.archived) continue; // Skip archived

        try {
          await processGitlabProject(project);
        } catch (projectError) {
          logger.error(`Error processing GitLab project ${project.path_with_namespace}:`, projectError);
          // Continue to next project
        }
      }
    } catch (error) {
      logger.error('Error during GitLab project search or processing phase:', error);
    }

    logger.info('Leak scanning function completed.');
    return null; // For scheduled functions, returning null or a Promise that resolves to null is common.
  });
