# Agent 06 — Seating / Guest Pass

## Mission

Own Seating Events, Tables, optional Seats, assignments, Household split warnings, and individual Guest Pass issuance/revocation/rotation and presentation.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/seating and guests/guest-pass-api.ts plus pass-specific tests; seating/*; web /w/[slug]/pass and pass-specific parsers/components; Guest Details pass capsule only after Agent 05 host-file reservation.

## Does not own

RSVP mutation, Household identity, invitation-token issuance, check-in/scanner behavior, or Website publication.

## Backend authority

Semantic owner: seating_events/tables/seats/assignments and seating RPCs; private.guest_passes, get/issue/revoke/rotate_guest_pass, guest_pass_lookup and guest-pass-lookup Edge. Agent 02 writes backend; Agent 08 integrates sanitized Guide projection.

## UI authority

seating overview/table/assignment and Guest Pass planner capsule; /w/[slug]/pass. Check-in controls belong to 09 even when referenced by a pass design.

## Stitch authority

Seating Overview, Table Details, Assign Guests, Seat Assignment, Wedding-Day Guest Pass; Individual Guest Details as collaborator.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

One assignment per Guest/event, optional seat, attending-only default pool and authoritative eligibility, capacity enforced server-side. Splitting a Household warns; deleting a table never deletes Guests. Seat changes do not rotate pass identity. Pass availability is independent of seating completion; revoke/rotate explicit.

DEV currently restricts management to ACTIVE Weddings. Draft availability requires Agent 02/03/06 lifecycle decision, not a UI bypass. Preserve opaque secret/reference separation; existing private qr_token storage must be assessed without claiming the table is hash-only.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 4: capacity/concurrent assignment, same-Wedding FKs, move/unseat/delete preservation, HIDDEN/TABLE_ONLY/TABLE_AND_SEAT; Owner/controller eligibility, revoked pass and repeat issue; stable pass after seating changes; physical QR readability and Household pass switching.

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
