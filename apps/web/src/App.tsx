import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type EventItem, type Metrics, type WorkflowItem } from './api';
import './styles.css';

type Tab = 'overview' | 'events' | 'workflows' | 'architecture';

const emptyMetrics: Metrics = { totalToday: 0, succeeded: 0, failed: 0, queued: 0, averageProcessingMs: 0, connectors: [] };

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status status-${status.toLowerCase().replace('_', '-')}`}>{status.replace('_', ' ')}</span>;
}

function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [metricData, eventData, workflowData] = await Promise.all([api.metrics(), api.events(), api.workflows()]);
      setMetrics(metricData);
      setEvents(eventData.items);
      setWorkflows(workflowData.items);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the command center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const successRate = useMemo(() => {
    const completed = metrics.succeeded + metrics.failed;
    return completed === 0 ? 100 : Math.round((metrics.succeeded / completed) * 100);
  }, [metrics]);

  async function generatePayment() {
    setCreating(true);
    try {
      await api.generatePayment({ amount: 4999, customerName: 'Aoki Developer', customerEmail: 'aoki@example.com' });
      await refresh();
      setTab('events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create demo event.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div><strong>NexusOps</strong><span>Sammium Tech</span></div>
        </div>
        <nav>
          {(['overview', 'events', 'workflows', 'architecture'] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
              <span className="nav-dot" />{item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" /> Demo workspace online
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">INTEGRATION COMMAND CENTER</p>
            <h1>{tab === 'overview' ? 'Revenue operations, synchronized.' : tab[0].toUpperCase() + tab.slice(1)}</h1>
          </div>
          <button className="primary" onClick={generatePayment} disabled={creating}>
            {creating ? 'Creating event…' : '+ Generate demo payment'}
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}
        {loading ? <div className="loading">Initializing NexusOps telemetry…</div> : null}

        {!loading && tab === 'overview' && (
          <>
            <section className="metrics-grid">
              <article><span>Events today</span><strong>{metrics.totalToday}</strong><small>Real-time intake</small></article>
              <article><span>Success rate</span><strong>{successRate}%</strong><small>{metrics.succeeded} completed</small></article>
              <article><span>Active queue</span><strong>{metrics.queued}</strong><small>Processing and waiting</small></article>
              <article><span>Avg. latency</span><strong>{metrics.averageProcessingMs || '—'}{metrics.averageProcessingMs ? ' ms' : ''}</strong><small>Webhook to completion</small></article>
            </section>

            <section className="two-column">
              <article className="panel">
                <div className="panel-heading"><div><p className="eyebrow">CONNECTORS</p><h2>Integration health</h2></div><span className="subtle">3 services</span></div>
                <div className="connector-list">
                  {metrics.connectors.map((connector) => (
                    <div className="connector" key={connector.name}>
                      <div className={`connector-icon ${connector.name.toLowerCase()}`}>{connector.name[0]}</div>
                      <div><strong>{connector.name}</strong><span>{connector.mode}</span></div>
                      <span className={`connection-state ${connector.connected ? 'connected' : 'simulated'}`}>{connector.connected ? 'Connected' : 'Simulated'}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel flow-panel">
                <div className="panel-heading"><div><p className="eyebrow">LIVE PIPELINE</p><h2>Event-driven flow</h2></div></div>
                <div className="flow">
                  <div><span>01</span><strong>Stripe</strong><small>Webhook source</small></div><b>→</b>
                  <div><span>02</span><strong>Normalize</strong><small>Canonical event</small></div><b>→</b>
                  <div><span>03</span><strong>Queue</strong><small>Reliable delivery</small></div><b>→</b>
                  <div><span>04</span><strong>Actions</strong><small>CRM + Slack</small></div>
                </div>
              </article>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest business events</h2></div><button className="text-button" onClick={() => setTab('events')}>View all →</button></div>
              <EventTable items={events.slice(0, 6)} onSelect={setSelected} />
            </section>
          </>
        )}

        {!loading && tab === 'events' && (
          <section className="panel full-panel">
            <div className="panel-heading"><div><p className="eyebrow">EVENT EXPLORER</p><h2>Processing history</h2></div><span className="subtle">{events.length} loaded</span></div>
            <EventTable items={events} onSelect={setSelected} />
          </section>
        )}

        {!loading && tab === 'workflows' && (
          <section className="workflow-grid">
            {workflows.map((workflow) => (
              <article className="panel workflow-card" key={workflow.id}>
                <div className="workflow-top"><span className="workflow-trigger">WHEN {workflow.trigger_type}</span><button className={`toggle ${workflow.enabled ? 'on' : ''}`} onClick={async () => { await api.toggleWorkflow(workflow.id); await refresh(); }}><i /></button></div>
                <h2>{workflow.name}</h2>
                <p>{workflow.conditions.length || 'No'} conditions · {workflow.actions.length} actions</p>
                <div className="action-chain">{workflow.actions.map((action, index) => <span key={`${action.type}-${index}`}>{action.type}{index < workflow.actions.length - 1 ? ' →' : ''}</span>)}</div>
              </article>
            ))}
          </section>
        )}

        {!loading && tab === 'architecture' && (
          <section className="architecture-layout">
            <article className="panel architecture-card">
              <p className="eyebrow">SYSTEM DESIGN</p><h2>Modular API + asynchronous worker</h2>
              <div className="arch-diagram">
                <div className="arch-node">React Command Center</div><span>HTTPS</span>
                <div className="arch-node accent">Fastify API + Webhook Gateway</div><span>Canonical event</span>
                <div className="arch-node">Redis / BullMQ</div><span>Background job</span>
                <div className="arch-node accent">Integration Worker</div>
                <div className="arch-split"><div>HubSpot CRM</div><div>Slack</div><div>PostgreSQL</div></div>
              </div>
            </article>
            <article className="panel principles">
              <p className="eyebrow">ENGINEERING PRINCIPLES</p><h2>Built for failures, not only demos</h2>
              <ul>
                <li><strong>Idempotency</strong><span>Duplicate provider events are safely ignored.</span></li>
                <li><strong>Retries</strong><span>Exponential backoff handles temporary outages.</span></li>
                <li><strong>Dead letters</strong><span>Exhausted jobs remain visible and replayable.</span></li>
                <li><strong>Tenant isolation</strong><span>Every event and workflow belongs to an organization.</span></li>
                <li><strong>Observability</strong><span>Correlation IDs and action histories expose the full path.</span></li>
              </ul>
            </article>
          </section>
        )}
      </main>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)}>×</button>
            <p className="eyebrow">EVENT DETAILS</p><h2>{selected.event_type}</h2>
            <StatusPill status={selected.status} />
            <dl>
              <dt>Provider</dt><dd>{selected.provider}</dd>
              <dt>Created</dt><dd>{formatTime(selected.created_at)}</dd>
              <dt>Attempts</dt><dd>{selected.attempts}</dd>
              <dt>Correlation ID</dt><dd className="mono">{selected.correlation_id}</dd>
              <dt>Amount</dt><dd>{String(selected.normalized_payload?.data?.currency ?? '')} {String(selected.normalized_payload?.data?.amount ?? '—')}</dd>
            </dl>
            {selected.last_error && <div className="event-error">{selected.last_error}</div>}
            <pre>{JSON.stringify(selected.normalized_payload, null, 2)}</pre>
            {(selected.status === 'FAILED' || selected.status === 'DEAD_LETTER') && <button className="primary full" onClick={async () => { await api.replay(selected.id); setSelected(null); await refresh(); }}>Replay event</button>}
          </aside>
        </div>
      )}
    </div>
  );
}

function EventTable({ items, onSelect }: { items: EventItem[]; onSelect: (item: EventItem) => void }) {
  if (!items.length) return <div className="empty-state"><strong>No events yet.</strong><span>Generate a demo payment to start the pipeline.</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>Event</th><th>Provider</th><th>Amount</th><th>Status</th><th>Attempts</th><th>Received</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} onClick={() => onSelect(item)}><td><strong>{item.event_type}</strong><span className="mono">{item.external_event_id.slice(0, 22)}</span></td><td>{item.provider}</td><td>{String(item.normalized_payload?.data?.currency ?? '')} {String(item.normalized_payload?.data?.amount ?? '—')}</td><td><StatusPill status={item.status} /></td><td>{item.attempts}</td><td>{formatTime(item.created_at)}</td></tr>)}</tbody></table></div>;
}

export default App;
