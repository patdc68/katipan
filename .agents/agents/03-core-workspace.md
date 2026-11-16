# Agent 03 — Core Workspace

## Mission

Own authentication, verification, session restoration, onboarding, Wedding creation, My Weddings, active selection, cache isolation, invitation acceptance, coordinator shell, and canonical navigation.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/auth, onboarding, workspace (except Home planning content/API), coordinator (including team-screen.tsx); root/access/workspace/coordinator route groups, auth/callback, accept-invitation, Wedding root layout, more and team routes; app-level native configuration through a reserved change.

## Does not own

Feature modules, planning summaries, Guest identity mutations, finance, check-in, or schema implementation.

## Backend authority

Semantic owner: profiles, weddings, wedding_memberships, wedding_partners, wedding_invitations/private.wedding_invitation_secrets; core uses wedding_people via identity contract with Agent 05. create_couple_wedding, create_coordinator_managed_wedding, issue_partner_owner_invitation, accept_wedding_invitation, coordinator invitation/role RPCs, ownership/lifecycle RPCs, delete-account/delete-wedding. Agent 02 implements backend changes.

## UI authority

Root layout/index, /(access)/*, /(workspace)/weddings, /(coordinator)/*, /auth/callback, /accept-invitation, Wedding root tabs, more/team. Home route is Agent 04 with root navigation behavior provided here.

## Stitch authority

Welcome, Create Our Wedding, Couple & Wedding Details, onboarding completion, Invite My Katipan, both My Weddings and coordinator overview variants, coordinator onboarding/client creation/invitation, More, team/access/privacy screens; exact IDs in map.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Publish one navigation/session contract used by every feature. Selected Wedding is validated active membership, never just persisted UUID. Same-account transient failures differ from confirmed revocation. Guard overlapping restore/refresh calls and auth-stack history. Expose account/Wedding/cache revision to consumers; coordinate Home Back boundary with Agent 04.

The snapshot's workspace unavailable race and authenticated Back fixes are evidence to reproduce, not patches to import wholesale. Preserve first joined client becoming Owner and the coordinator becoming Full Coordinator without cloning records.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 1: signup, email callback/verification, Wedding creation, partner/client independent acceptance, cold/resume restore, stale requests, Wedding/account switching, logout/login, membership removal, no cache leak, Android Back, iOS Back and deep links. Include onboarding/workspace/coordinator/team tests.

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
