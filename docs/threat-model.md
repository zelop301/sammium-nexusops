# Threat Model

## Protected assets

- External provider tokens and webhook secrets
- Customer identity and payment metadata
- Workflow definitions
- Tenant-specific operational history
- Event replay capability

## Main threats and controls

| Threat | MVP control | Production hardening |
|---|---|---|
| Forged Stripe event | Signature verification when configured | Mandatory secret per tenant and secret rotation |
| Duplicate delivery | Unique tenant/provider/external-event constraint | Action-level idempotency keys |
| Cross-tenant access | Every query filters by tenant ID | Authenticated membership claims and PostgreSQL row-level security |
| Stolen API key | Header API key can be enabled | Short-lived sessions, OAuth/OIDC, RBAC, rotation |
| Secret leakage | Environment variables; logger redaction | KMS-backed encryption and dedicated secret manager |
| Replay abuse | Explicit replay endpoint | RBAC, reason field, approval policy, immutable audit log |
| Malformed payload | Zod schema validation | Provider contract tests and payload size limits |
| Provider outage | Queue retries and dead-letter state | Circuit breakers, provider-specific rate limiting, alerting |

## Honest MVP boundary

This repository is a portfolio-ready architecture baseline, not a certified production platform. It intentionally uses a simple API key and a demo tenant so reviewers can run the complete workflow quickly. Production deployment should add user authentication, organization membership, role-based permissions, encrypted per-tenant credentials, and PostgreSQL row-level security.
