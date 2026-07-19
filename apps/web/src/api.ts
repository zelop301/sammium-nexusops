const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_API_KEY || 'nexus-demo-key';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || '11111111-1111-4111-8111-111111111111';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-tenant-id': TENANT_ID,
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface EventItem {
  id: string;
  provider: string;
  external_event_id: string;
  event_type: string;
  status: string;
  correlation_id: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
  normalized_payload: { data?: Record<string, unknown> };
}

export interface WorkflowItem {
  id: string;
  name: string;
  trigger_type: string;
  enabled: boolean;
  conditions: unknown[];
  actions: Array<{ type: string }>;
}

export interface Metrics {
  totalToday: number;
  succeeded: number;
  failed: number;
  queued: number;
  averageProcessingMs: number;
  connectors: Array<{ name: string; connected: boolean; mode: string }>;
}

export const api = {
  metrics: () => request<Metrics>('/api/v1/metrics/summary'),
  events: () => request<{ items: EventItem[]; total: number }>('/api/v1/events?limit=30'),
  workflows: () => request<{ items: WorkflowItem[] }>('/api/v1/workflows'),
  generatePayment: (body: { amount: number; customerName: string; customerEmail: string }) =>
    request('/api/v1/demo/payments', { method: 'POST', body: JSON.stringify({ ...body, currency: 'PHP' }) }),
  replay: (eventId: string) => request(`/api/v1/events/${eventId}/replay`, { method: 'POST' }),
  toggleWorkflow: (workflowId: string) => request(`/api/v1/workflows/${workflowId}/toggle`, { method: 'PATCH' })
};
