/**
 * @fileOverview Utilities for filtering files during scanning process
 */
import * as path from 'path';
import { logger } from 'firebase-functions';

// Расширения файлов, которые следует игнорировать при сканировании
export const IGNORED_EXTENSIONS = new Set([
  // Изображения
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  // Архивы и бинарные файлы
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bin', '.exe', '.dll', '.so', '.dylib',
  '.jar', '.war', '.ear', '.class', '.pyc', '.pyd', '.pyo',
  // Минифицированные и сгенерированные файлы
  '.min.js', '.min.css', '.map', '.lock', '.bundle.js',
  // Медиа файлы
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
  // Документы
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Шрифты
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Другие бинарные форматы
  '.db', '.sqlite', '.dat'
]);

// Пути, которые следует игнорировать при сканировании
export const IGNORED_PATHS = [
  // Директории зависимостей
  'node_modules/', 'vendor/', 'bower_components/', 'packages/', 'venv/', 'env/',
  '.virtualenv/', '.venv/', '.env/', 'site-packages/', 'jspm_packages/',
  // Сборки и дистрибутивы
  'dist/', 'build/', 'out/', 'target/', 'bin/', 'obj/', 'lib/', 'libs/',
  // Системные и скрытые директории
  '.git/', '.svn/', '.hg/', '.idea/', '.vscode/', '.vs/', '.github/', '.gitlab/',
  // Кэши и временные файлы
  '.cache/', 'tmp/', 'temp/', 'cache/', '.sass-cache/', '.next/', '.nuxt/',
  // Статические ресурсы
  'public/assets/', 'static/assets/', 'assets/images/', 'public/images/',
  // Тесты
  'test/fixtures/', 'tests/fixtures/', 'spec/fixtures/', '__tests__/fixtures/',
  // Документация
  'docs/examples/', 'examples/', 'samples/'
];

// Максимальный размер файла для сканирования (в байтах)
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Проверяет, следует ли игнорировать файл на основе его пути и размера
 * @param filePath Путь к файлу
 * @param fileSize Размер файла в байтах (если доступен)
 * @returns true, если файл следует игнорировать, false в противном случае
 */
export function shouldIgnoreFile(filePath: string, fileSize?: number): boolean {
  // Проверка расширения
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }

  // Проверка пути
  if (IGNORED_PATHS.some(ignoredPath => filePath.includes(ignoredPath))) {
    return true;
  }

  // Проверка размера
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    return true;
  }

  return false;
}

/**
 * Фильтрует список файлов, исключая нерелевантные
 * @param files Список файлов для фильтрации
 * @returns Отфильтрованный список файлов
 */
export function filterRelevantFiles<T extends { path: string; size?: number }>(files: T[]): T[] {
  const initialCount = files.length;
  const filteredFiles = files.filter(file => !shouldIgnoreFile(file.path, file.size));
  const filteredCount = initialCount - filteredFiles.length;
  
  if (filteredCount > 0) {
    logger.info(`Filtered out ${filteredCount} irrelevant files out of ${initialCount}`);
  }
  
  return filteredFiles;
}

/**
 * Проверяет, является ли контекст файла потенциально ложным срабатыванием
 * @param filePath Путь к файлу
 * @returns true, если контекст файла указывает на возможное ложное срабатывание
 */
export function isFalsePositiveFileContext(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  
  // Файлы, которые часто содержат тестовые/пример ключи
  const falsePositivePatterns = [
    /test/i, /spec/i, /example/i, /sample/i, /mock/i, /fixture/i,
    /readme/i, /documentation/i, /docs?/i, /tutorial/i
  ];
  
  return falsePositivePatterns.some(pattern => pattern.test(lowerPath));
}

/**
 * Проверяет, является ли контекст строки потенциально ложным срабатыванием
 * @param line Строка для проверки
 * @param surroundingLines Окружающие строки для контекста (если доступны)
 * @returns true, если контекст строки указывает на возможное ложное срабатывание
 */
export function isFalsePositiveLineContext(line: string, surroundingLines: string[] = []): boolean {
  const contextText = [line, ...surroundingLines].join(' ').toLowerCase();
  
  // Контексты, которые часто указывают на тестовые/пример ключи
  const falsePositivePatterns = [
    /test/i, /example/i, /sample/i, /mock/i, /fake/i, /dummy/i,
    /don't use/i, /do not use/i, /not real/i, /placeholder/i,
    /your_/i, /my_/i, /replace with/i
  ];
  
  return falsePositivePatterns.some(pattern => pattern.test(contextText));
}
