import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rawBody from 'fastify-raw-body';
import { config, allowedOrigins } from './config.js';
import { registerApiKeyGuard } from './security.js';
import { healthRoutes } from './routes/health.js';
import { demoRoutes } from './routes/demo.js';
import { webhookRoutes } from './routes/webhooks.js';
import { eventRoutes } from './routes/events.js';
import { workflowRoutes } from './routes/workflows.js';
import { metricRoutes } from './routes/metrics.js';
import { pool } from './db.js';
import { eventQueue, redis } from './queue.js';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    redact: ['req.headers.authorization', 'req.headers.x-api-key', 'body.access_token']
  },
  requestIdHeader: 'x-correlation-id'
});

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Origin not allowed'), false);
  }
});
await app.register(sensible);
await app.register(rawBody, { field: 'rawBody', global: false, encoding: false, runFirst: true });
await app.register(swagger, {
  openapi: {
    info: {
      title: 'Sammium NexusOps API',
      version: '0.1.0',
      description: 'Event-driven integration platform API.'
    },
    servers: [{ url: `http://localhost:${config.PORT}` }]
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });
await registerApiKeyGuard(app);

await app.register(healthRoutes);
await app.register(demoRoutes);
await app.register(webhookRoutes);
await app.register(eventRoutes);
await app.register(workflowRoutes);
await app.register(metricRoutes);

app.setErrorHandler((error: unknown, request, reply) => {
  request.log.error(error);
  const normalized = error instanceof Error ? error : new Error(String(error));
  const candidateStatus = (error as { statusCode?: number } | null)?.statusCode;
  const statusCode = typeof candidateStatus === 'number' && candidateStatus >= 400 ? candidateStatus : 500;
  return reply.code(statusCode).send({
    error: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : normalized.name,
    message: statusCode === 500 && config.NODE_ENV === 'production' ? 'Unexpected server error.' : normalized.message,
    correlationId: request.id
  });
});

const close = async () => {
  await app.close();
  await eventQueue.close();
  await redis.quit();
  await pool.end();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
console.log(`[api] Sammium NexusOps listening on http://localhost:${config.PORT}`);
