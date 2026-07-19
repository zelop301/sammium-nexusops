import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config();

const booleanString = z
  .string()
  .default('false')
  .transform((value) => value.toLowerCase() === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('postgresql://nexus:nexus@localhost:5432/nexusops'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DEMO_TENANT_ID: z.string().uuid().default('11111111-1111-4111-8111-111111111111'),
  DEMO_MODE: booleanString,
  API_KEY: z.string().default('nexus-demo-key'),
  WEB_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8080'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  HUBSPOT_ACCESS_TOKEN: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default('')
});

export const config = schema.parse(process.env);
export const allowedOrigins = config.WEB_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
