/**
 * @fileOverview Утилиты для параллельной обработки с ограничением нагрузки
 */
import { logger } from 'firebase-functions';
import { sleep } from './utils';

/**
 * Параметры для параллельной обработки
 */
export interface BatchProcessorOptions {
  /** Размер пакета (количество элементов, обрабатываемых параллельно) */
  batchSize?: number;
  /** Задержка между пакетами в миллисекундах */
  delayBetweenBatches?: number;
  /** Максимальное количество повторных попыток для каждого элемента */
  maxRetries?: number;
  /** Начальная задержка перед повторной попыткой в миллисекундах */
  initialRetryDelay?: number;
  /** Множитель для экспоненциального увеличения задержки между повторными попытками */
  retryBackoffMultiplier?: number;
  /** Максимальная задержка перед повторной попыткой в миллисекундах */
  maxRetryDelay?: number;
  /** Функция для определения, следует ли повторить попытку для данной ошибки */
  shouldRetry?: (error: any) => boolean;
}

/**
 * Результат обработки элемента
 */
export interface ProcessingResult<T, R> {
  /** Исходный элемент */
  item: T;
  /** Результат обработки (если успешно) */
  result?: R;
  /** Ошибка (если произошла) */
  error?: any;
  /** Количество выполненных попыток */
  attempts: number;
  /** Успешно ли обработан элемент */
  success: boolean;
}

/**
 * Обрабатывает элементы пакетами с ограничением параллельности
 * @param items Массив элементов для обработки
 * @param processFn Функция для обработки одного элемента
 * @param options Параметры обработки
 * @returns Массив результатов обработки
 */
export async function processBatch<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: BatchProcessorOptions = {}
): Promise<ProcessingResult<T, R>[]> {
  const {
    batchSize = 10,
    delayBetweenBatches = 1000,
    maxRetries = 3,
    initialRetryDelay = 1000,
    retryBackoffMultiplier = 2,
    maxRetryDelay = 30000,
    shouldRetry = (error: any) => {
      // По умолчанию повторяем попытку для ошибок сети и ограничения скорости
      if (error?.response?.status) {
        const status = error.response.status;
        return status === 429 || status >= 500 || status === 408;
      }
      return error?.code === 'ECONNRESET' || 
             error?.code === 'ETIMEDOUT' || 
             error?.code === 'ECONNABORTED';
    }
  } = options;

  const results: ProcessingResult<T, R>[] = [];
  
  // Обрабатываем элементы пакетами
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);
    
    // Запускаем обработку всех элементов в пакете параллельно
    const batchPromises = batch.map(async (item) => {
      let attempts = 0;
      let lastError: any = null;
      
      // Повторяем попытки обработки с экспоненциальной задержкой
      while (attempts < maxRetries) {
        attempts++;
        try {
          const result = await processFn(item);
          return {
            item,
            result,
            attempts,
            success: true
          };
        } catch (error) {
          lastError = error;
          
          // Проверяем, следует ли повторить попытку
          if (attempts < maxRetries && shouldRetry(error)) {
            // Вычисляем задержку с экспоненциальным увеличением
            const delay = Math.min(
              initialRetryDelay * Math.pow(retryBackoffMultiplier, attempts - 1),
              maxRetryDelay
            );
            
            logger.warn(`Error processing item (attempt ${attempts}/${maxRetries}). Retrying in ${delay}ms...`, { error });
            await sleep(delay);
          } else {
            // Достигнуто максимальное количество попыток или ошибка не подлежит повторной попытке
            logger.error(`Failed to process item after ${attempts} attempts`, { error });
            break;
          }
        }
      }
      
      // Если все попытки не удались, возвращаем ошибку
      return {
        item,
        error: lastError,
        attempts,
        success: false
      };
    });
    
    // Ожидаем завершения всех промисов в пакете
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Добавляем задержку между пакетами, если это не последний пакет
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }
  
  // Выводим статистику обработки
  const successCount = results.filter(r => r.success).length;
  logger.info(`Batch processing completed: ${successCount}/${results.length} items processed successfully`);
  
  return results;
}

/**
 * Обрабатывает элементы с повторными попытками
 * @param item Элемент для обработки
 * @param processFn Функция для обработки элемента
 * @param options Параметры обработки
 * @returns Результат обработки
 */
export async function processWithRetry<T, R>(
  item: T,
  processFn: (item: T) => Promise<R>,
  options: Omit<BatchProcessorOptions, 'batchSize' | 'delayBetweenBatches'> = {}
): Promise<ProcessingResult<T, R>> {
  const results = await processBatch([item], processFn, { batchSize: 1, delayBetweenBatches: 0, ...options });
  return results[0];
}
