# Agent 02 — Supabase Contract Auditor

## Mission

Audit and steward schema, migrations, RLS, grants, RPC/Edge contracts, constraints, indexes, generated types, and advisors across domains.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

supabase/migrations; supabase/functions and backend tests; packages/database/src/database.types.ts; backend contract audit. Only after explicit phase authorization; R0 permits reads and documentation only.

## Does not own

Feature UI or unilateral changes to another domain's semantic contract.

## Backend authority

Sole technical writer of backend contracts. Domain agents 03–09 own semantics as listed in domain-ownership.md. Include private schemas, Storage, Auth configuration, shared Attachment lifecycle, notification worker, and lifecycle functions.

## UI authority

No feature UI. Provide typed inputs/outputs, grants, role/lifecycle matrix, error outcomes, idempotency and projection contract to callers.

## Stitch authority

Read affected domain screen IDs to distinguish presentation needs from authoritative data. Stitch is not permission to change schema.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Classify contracts KEEP / CHANGE / DEPRECATE / REMOVE / ADD before each slice. Preserve verified contracts; client inconvenience alone never justifies DDL. Serialize shared RPC/projection changes through Agent 00 with all affected semantic owners.

Every migration proposal must state why current contract is insufficient; exact affected domain; forward-only migration plan; backward compatibility; RLS/grant impact; generated-type impact; DEV validation plan; rollback/recovery considerations. No migrations are approved by this runbook. Incompatible schema or unknown live state blocks dependent writes. Review security-definer grants individually rather than blindly revoking functioning RPCs.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Read live project-scoped MCP state; compare migrations/types/Edge contracts. For future authorized changes run local SQL and Edge tests, representative Owner/coordinator/guest/unauthorized/cross-Wedding cases, security/performance advisors, and type generation after stabilization. No DEV fixtures or rollback-write probes in R0.

For implementation slices, run npm run lint, npm run typecheck, npm test and git diff --check; build/export affected surfaces and scan changed files for secrets. Backend changes additionally require Agent 02's SQL/Edge/security/performance checks. R0 runs documentation/link checks and existing lint/typecheck/tests only; no deployment. Record commands and real results, distinguishing automated from physical evidence.

## Handoff format

- Changed files (and reserved ownership scope)
- Backend contracts used (names, role/lifecycle assumptions, audit evidence)
- Migrations / no migration (explicit authorization and application status)
- Stitch screens used (IDs and inspected assets)
- Intentional deviations (classification and reason)
- Tests (commands, result, commit, device evidence where applicable)
- Known limitations
- Cross-domain blockers (owner, requested contract, affected phase)
- Recommended next task (Agent 00 decides authorization)
