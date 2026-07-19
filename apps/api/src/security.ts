import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from './config.js';

const publicPrefixes = ['/health', '/docs', '/documentation', '/webhooks/stripe'];

export async function registerApiKeyGuard(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply) => {
    if (request.method === 'OPTIONS') return;
    if (publicPrefixes.some((prefix) => request.url.startsWith(prefix))) return;
    if (!config.API_KEY) return;

    const supplied = request.headers['x-api-key'];
    if (supplied !== config.API_KEY) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing or invalid x-api-key header.' });
    }
  });
}
