import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { performScan } from './enhancedScanner';
import { Scan } from './types';
import { updateScanConfigStatus } from './configService';
import { AxiosError } from 'axios';
import { createTasksForAllRepos } from './taskQueue';
import { setupScanQueues } from './queueSetup';

// Инициализируем очереди задач при деплое функций
setupScanQueues()
  .then(() => logger.info('Scan queues initialized successfully'))
  .catch(error => logger.error('Failed to initialize scan queues:', error));

const GITHUB_SCAN_PATH = 'github_repos_to_scan/{scanId}';

export const onGithubScanRequest = onDocumentCreated(GITHUB_SCAN_PATH, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.info('No data associated with the event');
    return;
  }
  const scan = snapshot.data() as Scan;
  logger.info(`New scan request received: ${scan.id}`);

  try {
    // Используем улучшенный сканер для обработки запроса
    const leaks = await performScan(scan);
    logger.info(`Scan completed for ${scan.id}. Found ${leaks.length} potential leaks.`);
    
    // Обновляем статус сканирования
    await updateScanConfigStatus(scan.id, 'COMPLETED');
  } catch (error) {
    logger.error(`Scan failed for document ${scan.id}:`, error);

    // Type-safe error handling
    let isAuthError = false;
    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        isAuthError = true;
      }
    }

    if (isAuthError) {
      logger.error(`CRITICAL: Authentication failed for scan ${scan.id}. Deactivating.`);
      await updateScanConfigStatus(scan.id, 'INVALID_TOKEN');
      // DO NOT re-throw, to prevent Cloud Function retries for auth errors.
    } else {
      // For other errors, re-throw to allow for retries on transient issues.
      await updateScanConfigStatus(scan.id, 'FAILED_TRANSIENT');
      throw error;
    }
  }
});

/**
 * Запланированное сканирование, выполняемое по расписанию
 */
export const scheduledScan = onSchedule('every 24 hours', async (event) => {
  logger.info('Starting scheduled scan', { scheduledTime: event.scheduleTime });
  
  try {
    // Вместо прямого выполнения сканирования, создаем задачи в очереди
    const tasksCount = await createTasksForAllRepos();
    logger.info(`Scheduled scan created ${tasksCount} tasks in queue`);
  } catch (error) {
    logger.error('Scheduled scan failed:', error);
    throw error; // Позволяем Cloud Functions повторить попытку
  }
});

/**
 * Обработчик задач из очереди Cloud Tasks
 */
export const processScanTask = onRequest(async (req, res) => {
  try {
    // Проверяем метод запроса
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    
    // Получаем данные задачи
    const task = req.body as { scanId: string; repoName: string; provider: 'github' | 'gitlab' };
    
    if (!task || !task.scanId || !task.repoName || !task.provider) {
      logger.error('Invalid task data received', { body: req.body });
      res.status(400).send('Bad Request: Invalid task data');
      return;
    }
    
    logger.info(`Processing scan task for ${task.provider}:${task.repoName}`, { scanId: task.scanId });
    
    // Выполняем сканирование
    const scan: Scan = {
      id: task.scanId,
      repoName: task.repoName,
      provider: task.provider
    };
    
    const leaks = await performScan(scan);
    
    // Обновляем статус сканирования
    await updateScanConfigStatus(task.scanId, 'COMPLETED');
    
    logger.info(`Scan task completed for ${task.repoName}. Found ${leaks.length} potential leaks.`);
    res.status(200).send({ success: true, leaksFound: leaks.length });
  } catch (error) {
    logger.error('Error processing scan task:', error);
    
    // Проверяем тип ошибки
    if (error instanceof AxiosError && error.response?.status === 401) {
      // Ошибка аутентификации, не повторяем
      res.status(401).send({ success: false, error: 'Authentication failed' });
    } else {
      // Другие ошибки, возвращаем 500 для повторной попытки
      res.status(500).send({ success: false, error: 'Internal server error' });
    }
  }
});
