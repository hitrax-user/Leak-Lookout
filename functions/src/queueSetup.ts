/**
 * @fileOverview Утилиты для настройки и управления очередями задач в Google Cloud Tasks
 */
import { logger } from 'firebase-functions';
import { CloudTasksClient, protos } from '@google-cloud/tasks';

// Инициализируем клиент Cloud Tasks
const tasksClient = new CloudTasksClient();

// Получаем проект из окружения
const project = process.env.GCLOUD_PROJECT || '';
// Регион для очередей задач
const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';

/**
 * Конфигурация очереди задач
 */
interface QueueConfig {
  name: string;
  rateLimits?: {
    maxDispatchesPerSecond?: number;
    maxBurstSize?: number;
    maxConcurrentDispatches?: number;
  };
  retryConfig?: {
    maxAttempts?: number;
    maxRetryDuration?: string; // Например, '3600s'
    minBackoff?: string; // Например, '1s'
    maxBackoff?: string; // Например, '10s'
    maxDoublings?: number;
  };
}

/**
 * Создает полный путь к очереди
 * @param queueName Имя очереди
 * @returns Полный путь к очереди
 */
function getQueuePath(queueName: string): string {
  return tasksClient.queuePath(project, location, queueName);
}

/**
 * Преобразует строку времени в объект IDuration
 * @param durationString Строка времени, например '3600s'
 * @returns объект IDuration
 */
function parseDuration(durationString?: string): protos.google.protobuf.IDuration | undefined {
    if (!durationString) {
        return undefined;
    }
    const seconds = parseInt(durationString.replace('s', ''), 10);
    if (isNaN(seconds)) {
        return undefined;
    }
    return { seconds };
}

/**
 * Создает или обновляет очередь задач
 * @param config Конфигурация очереди
 * @returns Созданная или обновленная очередь
 */
export async function createOrUpdateQueue(config: QueueConfig): Promise<any> {
  const parent = tasksClient.locationPath(project, location);
  const queuePath = getQueuePath(config.name);
  
  const queuePayload = {
    name: queuePath,
    rateLimits: config.rateLimits,
    retryConfig: {
        maxAttempts: config.retryConfig?.maxAttempts,
        maxRetryDuration: parseDuration(config.retryConfig?.maxRetryDuration),
        minBackoff: parseDuration(config.retryConfig?.minBackoff),
        maxBackoff: parseDuration(config.retryConfig?.maxBackoff),
        maxDoublings: config.retryConfig?.maxDoublings,
    },
  };

  try {
    // Пытаемся получить очередь, чтобы проверить, существует ли она
    await tasksClient.getQueue({ name: queuePath });
    
    // Если getQueue() не выдает ошибку, очередь существует, поэтому обновляем ее
    logger.info(`Queue ${config.name} already exists. Updating...`);
    const [updatedQueue] = await tasksClient.updateQueue({ queue: queuePayload });
    logger.info(`Queue ${config.name} updated successfully.`);
    return updatedQueue;

  } catch (error: any) {
    // Если ошибка 'NOT_FOUND' (код 5), создаем очередь
    if (error.code === 5) {
      logger.info(`Queue ${config.name} not found. Creating...`);
      const [createdQueue] = await tasksClient.createQueue({ parent, queue: queuePayload });
      logger.info(`Queue ${config.name} created successfully.`);
      return createdQueue;
    }
    
    // Для всех других ошибок, выводим их в лог и пробрасываем дальше
    logger.error(`Error managing queue ${config.name}:`, error);
    throw error;
  }
}

/**
 * Удаляет очередь задач
 * @param queueName Имя очереди
 * @returns true, если очередь успешно удалена
 */
export async function deleteQueue(queueName: string): Promise<boolean> {
  try {
    await tasksClient.deleteQueue({
      name: getQueuePath(queueName)
    });
    
    logger.info(`Queue ${queueName} deleted successfully`);
    return true;
  } catch (error) {
    logger.error(`Error deleting queue ${queueName}:`, error);
    return false;
  }
}

/**
 * Приостанавливает очередь задач
 * @param queueName Имя очереди
 * @returns Приостановленная очередь
 */
export async function pauseQueue(queueName: string): Promise<any> {
  try {
    const [queue] = await tasksClient.pauseQueue({
      name: getQueuePath(queueName)
    });
    
    logger.info(`Queue ${queueName} paused successfully`);
    return queue;
  } catch (error) {
    logger.error(`Error pausing queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Возобновляет очередь задач
 * @param queueName Имя очереди
 * @returns Возобновленная очередь
 */
export async function resumeQueue(queueName: string): Promise<any> {
  try {
    const [queue] = await tasksClient.resumeQueue({
      name: getQueuePath(queueName)
    });
    
    logger.info(`Queue ${queueName} resumed successfully`);
    return queue;
  } catch (error) {
    logger.error(`Error resuming queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Настраивает очереди задач для сканирования
 * @returns Объект с созданными очередями
 */
export async function setupScanQueues(): Promise<Record<string, any>> {
  try {
    // Очередь для сканирования репозиториев
    const scanQueue = await createOrUpdateQueue({
      name: 'scan-queue',
      rateLimits: {
        maxDispatchesPerSecond: 5,
        maxBurstSize: 10,
        maxConcurrentDispatches: 10
      },
      retryConfig: {
        maxAttempts: 5,
        maxRetryDuration: '3600s', // 1 час
        minBackoff: '10s',
        maxBackoff: '300s', // 5 минут
        maxDoublings: 3
      }
    });
    
    // Очередь для обработки файлов
    const fileProcessingQueue = await createOrUpdateQueue({
      name: 'file-processing-queue',
      rateLimits: {
        maxDispatchesPerSecond: 10,
        maxBurstSize: 20,
        maxConcurrentDispatches: 20
      },
      retryConfig: {
        maxAttempts: 3,
        maxRetryDuration: '1800s', // 30 минут
        minBackoff: '5s',
        maxBackoff: '120s', // 2 минуты
        maxDoublings: 3
      }
    });
    
    // Очередь для валидации утечек
    const leakValidationQueue = await createOrUpdateQueue({
      name: 'leak-validation-queue',
      rateLimits: {
        maxDispatchesPerSecond: 2,
        maxBurstSize: 5,
        maxConcurrentDispatches: 5
      },
      retryConfig: {
        maxAttempts: 3,
        maxRetryDuration: '1800s', // 30 минут
        minBackoff: '10s',
        maxBackoff: '180s', // 3 минуты
        maxDoublings: 3
      }
    });
    
    logger.info('All scan queues set up successfully');
    
    return {
      scanQueue,
      fileProcessingQueue,
      leakValidationQueue
    };
  } catch (error) {
    logger.error('Error setting up scan queues:', error);
    throw error;
  }
}
