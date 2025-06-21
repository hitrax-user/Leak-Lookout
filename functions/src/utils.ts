import * as crypto from 'crypto';

export const API_KEY_PATTERNS: { name: string; regex: RegExp }[] = [
  // AWS Keys
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  // Refined regex to reduce false positives from things like commit hashes.
  // It looks for a 40-character Base64 string that is not preceded or followed by other alphanumeric characters.
  { name: 'AWS Secret Key', regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
  
  // Google Keys
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\\_-]{35}/g },
  { name: 'Google OAuth Client ID', regex: /[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com/g },
  { name: 'Firebase API Key', regex: /AIzaSy[0-9A-Za-z_-]{33}/g },
  
  // Payment Services
  { name: 'Stripe Live Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Stripe Test Secret Key', regex: /sk_test_[0-9a-zA-Z]{24}/g },
  { name: 'Stripe Publishable Key', regex: /pk_(live|test)_[0-9a-zA-Z]{24}/g },
  { name: 'PayPal Client ID', regex: /A[a-zA-Z0-9_-]{20}/g },
  { name: 'Square Access Token', regex: /sq0atp-[0-9A-Za-z_-]{22}/g },
  
  // Communication Services
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,10}\/B[0-9A-Z]{8,10}\/[0-9a-zA-Z]{24}/g },
  { name: 'Slack API Token', regex: /xox[pbar]-[0-9]{12}-[0-9]{12}-[0-9a-zA-Z]{24}/g },
  { name: 'Twilio API Key', regex: /SK[0-9a-fA-F]{32}/g },
  { name: 'Twilio Account SID', regex: /AC[a-zA-Z0-9]{32}/g },
  { name: 'SendGrid API Key', regex: /SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}/g },
  { name: 'Mailchimp API Key', regex: /[0-9a-f]{32}-us[0-9]{1,2}/g },
  
  // Development Platforms
  { name: 'GitHub Personal Access Token', regex: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}/g },
  { name: 'GitHub OAuth Access Token', regex: /gho_[A-Za-z0-9_]{36}/g },
  { name: 'GitLab Personal Access Token', regex: /glpat-[0-9a-zA-Z_-]{20}/g },
  { name: 'Heroku API Key', regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g },
  
  // Database Connections
  { name: 'MongoDB Connection String', regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/]+\/?[^\s]*/g },
  { name: 'PostgreSQL Connection String', regex: /postgres(ql)?:\/\/[^:]+:[^@]+@[^\/]+\/?[^\s]*/g },
  { name: 'MySQL Connection String', regex: /mysql:\/\/[^:]+:[^@]+@[^\/]+\/?[^\s]*/g },
  
  // JWT and Auth
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*$/g },
  { name: 'Basic Auth Credentials', regex: /Basic [A-Za-z0-9+/=]{20,}/g },
  { name: 'Bearer Token', regex: /Bearer [A-Za-z0-9._~+/-]+=*$/g },
  
  // Cloud Platforms
  { name: 'Azure Connection String', regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=core\.windows\.net/g },
  // NOTE: This pattern is very broad and can lead to false positives.
  { name: 'Azure Function Key', regex: /[0-9a-zA-Z]{40,}/g },
  { name: 'Digital Ocean Token', regex: /do[a-z0-9_-]{64}/g },
  
  // Generic Patterns (VERY high false positive risk, use with extreme caution)
  { name: 'Generic API Key', regex: /[a-zA-Z0-9_-]{32,45}/g },
  { name: 'Generic Secret', regex: /secret[_-]?[a-zA-Z0-9]{10,45}/gi },
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
