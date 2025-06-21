/**
 * @fileOverview Улучшенный детектор утечек API ключей с двухэтапным анализом
 */
import { logger } from 'firebase-functions';
import { saveLeak } from './firestoreService';
import { API_KEY_PATTERNS, calculateEntropy, extractSnippet, generateKeyHash } from './utils';
import { isFalsePositiveFileContext, isFalsePositiveLineContext } from './fileFilters';
import type { PartialLeakedKey } from './types';

// Порог энтропии для фильтрации потенциальных утечек
export const ENTROPY_THRESHOLD = 4.5;

// Минимальная длина строки для рассмотрения как потенциальной утечки
export const MIN_KEY_LENGTH = 20;

// Максимальная длина строки для рассмотрения как потенциальной утечки
export const MAX_KEY_LENGTH = 100;

/**
 * Интерфейс для кандидата в утечки
 */
interface LeakCandidate {
  value: string;
  type: string;
  index: number;
  line: string;
  lineIndex: number;
}

/**
 * Находит потенциальных кандидатов в утечки в строке
 * @param line Строка для анализа
 * @param lineIndex Индекс строки в файле
 * @returns Массив кандидатов в утечки
 */
function findLeakCandidates(line: string, lineIndex: number): LeakCandidate[] {
  const candidates: LeakCandidate[] = [];

  // Этап 1: Поиск по шаблонам API ключей
  for (const pattern of API_KEY_PATTERNS) {
    const regex = new RegExp(pattern.regex);
    let match;
    
    // Используем exec в цикле для поиска всех совпадений
    while ((match = regex.exec(line)) !== null) {
      // Проверяем длину ключа
      if (match[0].length < MIN_KEY_LENGTH || match[0].length > MAX_KEY_LENGTH) {
        continue;
      }
      
      candidates.push({
        value: match[0],
        type: pattern.name,
        index: match.index,
        line,
        lineIndex
      });
      
      // Сбрасываем lastIndex, чтобы избежать бесконечного цикла с глобальным флагом
      regex.lastIndex = match.index + 1;
    }
  }

  // Этап 2: Поиск строк с высокой энтропией
  // Разбиваем строку на слова и фильтруем по длине
  const words = line.split(/\s+|\b|[=\(\){\}\[\]"';:,<>`]+/)
    .filter(w => w.length >= MIN_KEY_LENGTH && w.length <= MAX_KEY_LENGTH);
    
  for (const word of words) {
    // Пропускаем слова, которые уже найдены как API ключи
    if (candidates.some(c => c.value === word)) {
      continue;
    }
    
    // Проверяем энтропию
    const entropy = calculateEntropy(word);
    if (entropy > ENTROPY_THRESHOLD) {
      candidates.push({
        value: word,
        type: 'High Entropy String',
        index: line.indexOf(word),
        line,
        lineIndex
      });
    }
  }
  
  return candidates;
}

/**
 * Проверяет, является ли кандидат известным ложным срабатыванием
 * @param candidate Кандидат в утечки
 * @returns true, если кандидат является известным ложным срабатыванием
 */
function isKnownFalsePositive(candidate: LeakCandidate): boolean {
  const value = candidate.value;
  
  // Проверка на тестовые/пример ключи
  const falsePositivePatterns = [
    /example/i, /sample/i, /test/i, /demo/i,
    /your_/i, /my_/i, /placeholder/i,
    /^[0-9a-f]{32}$/, // Обычные MD5 хэши
    /^[0-9a-f]{40}$/, // SHA-1 хэши (часто хэши коммитов)
    /^[0-9a-f]{64}$/, // SHA-256 хэши
    /^[0-9a-f]{128}$/, // SHA-512 хэши
    /^[0-9]+$/, // Только цифры
    /^[a-z]+$/, // Только буквы в нижнем регистре
    /^[A-Z]+$/, // Только буквы в верхнем регистре
  ];
  
  return falsePositivePatterns.some(pattern => pattern.test(value));
}

/**
 * Сканирует содержимое файла на наличие утечек API ключей
 * @param content Содержимое файла
 * @param sourceUrl URL источника
 * @param sourceType Тип источника (GitHub или GitLab)
 * @param filePath Путь к файлу
 * @param repositoryFullName Полное имя репозитория
 * @returns Массив обнаруженных утечек
 */
export async function scanContentForLeaks(
  content: string | null,
  sourceUrl: string,
  sourceType: 'GitHub' | 'GitLab',
  filePath: string,
  repositoryFullName: string
): Promise<PartialLeakedKey[]> {
  if (!content) return [];
  
  const detectedLeaks: PartialLeakedKey[] = [];
  const lines = content.split('\n');
  
  // Проверяем, является ли файл потенциально ложным срабатыванием
  const isFileContextFalsePositive = isFalsePositiveFileContext(filePath);
  
  // Если файл является потенциально ложным срабатыванием, повышаем порог энтропии
  const entropyThreshold = isFileContextFalsePositive ? ENTROPY_THRESHOLD + 1 : ENTROPY_THRESHOLD;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    // Этап 1: Поиск кандидатов
    const candidates = findLeakCandidates(line, lineIndex);
    
    // Этап 2: Верификация кандидатов
    for (const candidate of candidates) {
      // Проверка энтропии
      const entropy = calculateEntropy(candidate.value);
      if (entropy < entropyThreshold) continue;
      
      // Проверка на известные ложные срабатывания
      if (isKnownFalsePositive(candidate)) continue;
      
      // Получаем окружающие строки для контекста
      const startLineIndex = Math.max(0, lineIndex - 2);
      const endLineIndex = Math.min(lines.length - 1, lineIndex + 2);
      const surroundingLines = lines.slice(startLineIndex, endLineIndex + 1).filter((_, i) => i + startLineIndex !== lineIndex);
      
      // Проверка контекста (тесты, примеры, документация)
      if (isFalsePositiveLineContext(line, surroundingLines)) continue;
      
      // Создаем объект утечки
      const leak: PartialLeakedKey = {
        apiKeyPreview: `${candidate.value.substring(0, 4)}...${candidate.value.substring(candidate.value.length - 4)}`,
        keyHash: generateKeyHash(candidate.value),
        keyType: candidate.type,
        sourceType,
        sourceUrl,
        contextSnippet: extractSnippet(line, candidate.index),
        entropy,
        repository: repositoryFullName,
        filePath,
        lineNumber: lineIndex + 1
      };
      
      // Добавляем утечку в список обнаруженных
      detectedLeaks.push(leak);
      
      // Сохраняем утечку в Firestore
      try {
        await saveLeak(leak);
      } catch (error) {
        logger.error(`Error saving leak to Firestore: ${error}`, { leak });
      }
    }
  }
  
  return detectedLeaks;
}

/**
 * Обрабатывает содержимое файла с обработкой ошибок
 * @param content Содержимое файла
 * @param sourceUrl URL источника
 * @param sourceType Тип источника (GitHub или GitLab)
 * @param filePath Путь к файлу
 * @param repositoryFullName Полное имя репозитория
 * @returns Массив обнаруженных утечек или null в случае ошибки
 */
export async function processFileContent(
  content: string | null,
  sourceUrl: string,
  sourceType: 'GitHub' | 'GitLab',
  filePath: string,
  repositoryFullName: string
): Promise<PartialLeakedKey[] | null> {
  try {
    if (!content) {
      logger.info(`No content for file ${filePath} in ${repositoryFullName}`);
      return [];
    }
    
    return await scanContentForLeaks(content, sourceUrl, sourceType, filePath, repositoryFullName);
  } catch (error) {
    logger.error(`Error processing file content for ${filePath} in ${repositoryFullName}: ${error}`);
    return null;
  }
}
