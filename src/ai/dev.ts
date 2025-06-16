import { config } from 'dotenv';
config();

import '@/ai/flows/generate-remediation-steps.ts';
import '@/ai/flows/enhance-snippet-context.ts';
import '@/ai/flows/validate-leaked-key.ts';