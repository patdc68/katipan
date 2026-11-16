# Agent 09 — Wedding Day

## Mission

Own Wedding-Day Dashboard, Run of Show, explicit Guest Program linkage/review/publication, manual and QR check-in, duplicate protection, reversals, offline manual queue, and synchronization.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/wedding-day, run-of-show, guest-program; day/*, plan/run-of-show/*, website/program/* and corresponding client tests. Directory placement does not change ownership.

## Does not own

RSVP, seating or Guest identity mutation; Guest Pass issuance; Website publication; Canva artwork.

## Backend authority

Semantic owner: wedding_day_items/memberships, guest_program_items, guest_check_in_events and guest_check_in_state; wedding_day_dashboard/check_in/reverse_check_in, set_guest_program_publication, wedding-day-check-in Edge. Agent 02 writes backend; Agent 08 renders published guest projection.

## UI authority

day dashboard/check-in/scan, operational timeline and Guest Program editor/preview. Guest-facing published schedule is composed by Agent 08 from the authoritative projection.

## Stitch authority

All three Wedding-Day Dashboard variants, Guest Check-In, QR Scanner & Manual Check-In, Run of Show; Guide as collaborator. Guest Program uses documented adaptation where no dedicated Stitch screen exists.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Run of Show != Guest Program; check-in != RSVP != Seating != Pass issuance. Internal time changes flag review, never silently publish. Each selected Household Guest gets an individual event. Offline cached lookup creates queued manual events, never verified opaque QR. Synchronization reauthorizes membership and handles duplicate client event IDs.

Draft operational management is a pending lifecycle contract decision; current DEV active-only behavior must be represented truthfully. Do not change RSVP or assign a table to make scanning succeed.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 7: timeline/no cascading delay, explicit KEEP/UPDATE publication, manual/QR/wrong Wedding/revoked pass/duplicate scan, batch per-Guest events, reversal history, offline retry/reconnect/account switch and authoritative counts. Device camera permission/denial and Android/iOS queue tests.

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
