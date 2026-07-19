import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('postgresql://nexus:nexus@localhost:5432/nexusops'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DEMO_MODE: z.string().default('true').transform((value) => value.toLowerCase() === 'true'),
  HUBSPOT_ACCESS_TOKEN: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default('')
});

export const config = schema.parse(process.env);
