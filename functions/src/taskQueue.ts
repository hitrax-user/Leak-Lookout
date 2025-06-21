/**
 * @fileOverview Реализация очередей задач с использованием Google Cloud Tasks
 */
import { logger } from 'firebase-functions';
import { CloudTasksClient } from '@google-cloud/tasks';
import * as admin from 'firebase-admin';

// Инициализируем клиент Cloud Tasks
const tasksClient = new CloudTasksClient();

// Получаем проект из окружения
const project = process.env.GCLOUD_PROJECT || '';
// Регион для очередей задач
const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
// Имя очереди для сканирования
const scanQueueName = process.env.SCAN_QUEUE_NAME || 'scan-queue';

/**
 * Создает полный путь к очереди
 * @param queueName Имя очереди
 * @returns Полный путь к очереди
 */
function getQueuePath(queueName: string): string {
  return tasksClient.queuePath(project, location, queueName);
}

/**
 * Интерфейс для задачи сканирования
 */
interface ScanTask {
  scanId: string;
  repoName: string;
  provider: 'github' | 'gitlab';
}

/**
 * Добавляет задачу сканирования в очередь
 * @param task Задача сканирования
 * @param delaySeconds Задержка перед выполнением задачи в секундах
 * @returns Имя созданной задачи
 */
export async function enqueueScanTask(task: ScanTask, delaySeconds: number = 0): Promise<string> {
  try {
    // Создаем полезную нагрузку задачи
    const payload = Buffer.from(JSON.stringify(task)).toString('base64');
    
    // Создаем задачу
    const [response] = await tasksClient.createTask({
      parent: getQueuePath(scanQueueName),
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `https://${location}-${project}.cloudfunctions.net/processScanTask`,
          headers: {
            'Content-Type': 'application/json',
          },
          body: payload,
        },
        scheduleTime: {
          seconds: Date.now() / 1000 + delaySeconds,
        },
      },
    });
    
    logger.info(`Task ${response.name} enqueued for ${task.repoName}`);
    return response.name || '';
  } catch (error) {
    logger.error(`Error enqueueing task for ${task.repoName}:`, error);
    throw error;
  }
}

/**
 * Добавляет несколько задач сканирования в очередь
 * @param tasks Массив задач сканирования
 * @param delayBetweenTasksSeconds Задержка между задачами в секундах
 * @returns Массив имен созданных задач
 */
export async function enqueueBatchScanTasks(tasks: ScanTask[], delayBetweenTasksSeconds: number = 5): Promise<string[]> {
  const taskNames: string[] = [];
  
  for (let i = 0; i < tasks.length; i++) {
    try {
      const taskName = await enqueueScanTask(tasks[i], i * delayBetweenTasksSeconds);
      taskNames.push(taskName);
    } catch (error) {
      logger.error(`Error enqueueing task ${i} in batch:`, error);
      // Продолжаем с другими задачами
    }
  }
  
  logger.info(`Enqueued ${taskNames.length} out of ${tasks.length} tasks in batch`);
  return taskNames;
}

/**
 * Создает задачи сканирования для всех репозиториев в Firestore
 * @returns Количество созданных задач
 */
export async function createTasksForAllRepos(): Promise<number> {
  try {
    // Получаем все репозитории для сканирования из Firestore
    const snapshot = await admin.firestore().collection('github_repos_to_scan').get();
    
    if (snapshot.empty) {
      logger.info('No repositories found for scanning');
      return 0;
    }
    
    const tasks: ScanTask[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      tasks.push({
        scanId: doc.id,
        repoName: data.repoName,
        provider: data.provider || 'github'
      });
    });
    
    // Добавляем задачи в очередь
    const taskNames = await enqueueBatchScanTasks(tasks);
    
    logger.info(`Created ${taskNames.length} scan tasks for all repositories`);
    return taskNames.length;
  } catch (error) {
    logger.error('Error creating tasks for all repositories:', error);
    throw error;
  }
}

/**
 * Очищает очередь задач
 * @param queueName Имя очереди
 * @returns true, если очередь успешно очищена
 */
export async function purgeQueue(queueName: string = scanQueueName): Promise<boolean> {
  try {
    await tasksClient.purgeQueue({
      name: getQueuePath(queueName)
    });
    
    logger.info(`Queue ${queueName} purged successfully`);
    return true;
  } catch (error) {
    logger.error(`Error purging queue ${queueName}:`, error);
    return false;
  }
}

/**
 * Получает статистику очереди
 * @param queueName Имя очереди
 * @returns Объект со статистикой очереди или null в случае ошибки
 */
export async function getQueueStats(queueName: string = scanQueueName): Promise<any | null> {
  try {
    const [queue] = await tasksClient.getQueue({
      name: getQueuePath(queueName)
    });
    
    return {
      name: queue.name,
      state: queue.state,
      rateLimits: queue.rateLimits,
      retryConfig: queue.retryConfig
    };
  } catch (error) {
    logger.error(`Error getting queue stats for ${queueName}:`, error);
    return null;
  }
}
