import * as crypto from 'crypto';

export const API_KEY_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\\_-]{35}/g },
  { name: 'Stripe Live Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8}\/B[0-9A-Z]{8,11}\/[0-9a-zA-Z]{24}/g },
  { name: 'Twilio API Key', regex: /SK[0-9a-fA-F]{32}/g },
  // Add more patterns as needed
];

export function calculateEntropy(str: string): number {
  if (!str) return 0;
  const charMap: { [char: string]: number } = {};
  for (const char of str) {
    charMap[char] = (charMap[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const char in charMap) {
    const p = charMap[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function extractSnippet(content: string, index: number, length = 50): string {
  const halfLength = Math.floor(length / 2);
  const start = Math.max(0, index - halfLength);
  const end = Math.min(content.length, index + halfLength + (length % 2)); // Adjust for odd length
  
  let prefix = start > 0 ? "..." : "";
  let suffix = end < content.length ? "..." : "";
  
  return prefix + content.substring(start, end) + suffix;
}

export function generateKeyHash(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
