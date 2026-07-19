# Architecture

## Context

Sammium NexusOps receives provider events, converts them to a provider-neutral contract, processes them asynchronously, and exposes operational state through a web command center.

```mermaid
flowchart LR
  Stripe[Stripe Webhooks] --> API[Fastify Webhook Gateway]
  Web[React Command Center] --> API
  API --> DB[(PostgreSQL)]
  API --> Queue[(Redis / BullMQ)]
  Queue --> Worker[Integration Worker]
  Worker --> HubSpot[HubSpot CRM API]
  Worker --> Slack[Slack Incoming Webhook]
  Worker --> DB
```

## Payment sequence

```mermaid
sequenceDiagram
  participant S as Stripe / Demo Generator
  participant A as API Gateway
  participant P as PostgreSQL
  participant Q as BullMQ
  participant W as Worker
  participant H as HubSpot
  participant L as Slack

  S->>A: payment_intent.succeeded
  A->>A: verify signature + normalize
  A->>P: insert event with unique external ID
  A->>Q: enqueue event ID
  A-->>S: 200/202 accepted
  Q->>W: process-event
  W->>P: load event + workflows
  W->>H: upsert customer
  W->>L: send notification
  W->>P: store actions and mark succeeded
```

## Deliberate architectural decisions

- **Modular monolith API:** lower operational complexity than premature microservices.
- **Separate worker process:** isolates slow or unreliable external calls from webhook response latency.
- **Canonical event model:** provider-specific payloads do not leak into workflow logic.
- **At-least-once processing:** duplicates are expected and neutralized through database idempotency.
- **PostgreSQL as system of record:** the queue accelerates processing, while durable business state remains queryable.
