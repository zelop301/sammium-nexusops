import type { FastifyRequest } from 'fastify';
import { config } from './config.js';

export function getTenantId(request: FastifyRequest): string {
  const header = request.headers['x-tenant-id'];
  if (typeof header === 'string' && header.length > 0) return header;
  return config.DEMO_TENANT_ID;
}
