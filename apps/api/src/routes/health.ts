import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { redis } from '../queue.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const checks = { database: false, redis: false };
    try {
      await query('SELECT 1');
      checks.database = true;
    } catch {}
    try {
      checks.redis = (await redis.ping()) === 'PONG';
    } catch {}

    const healthy = checks.database && checks.redis;
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      service: 'nexusops-api',
      timestamp: new Date().toISOString(),
      checks
    });
  });
}
