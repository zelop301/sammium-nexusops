# ADR-0001: Use a modular API with a separate integration worker

**Status:** Accepted

## Context

The project must demonstrate modern integration practices without introducing unnecessary deployment and debugging overhead.

## Decision

Use one Fastify API for HTTP concerns and one separately deployable worker for background integration jobs. Keep business modules separated in code and share provider-neutral event contracts.

## Consequences

- Webhook latency is independent from HubSpot and Slack response time.
- The worker can scale separately from the API.
- Local development remains understandable for a student portfolio.
- Modules can later be extracted into services if scale or team ownership justifies it.
