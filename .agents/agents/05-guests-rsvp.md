# Agent 05 — Guests / RSVP

## Mission

Own Households, Guest identity reuse, independent RSVP, Entourage, Guest Groups, allowances, invitation authorization, RSVP links, and invitation delivery state.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/guests excluding pass capsule/API reserved to Agent 06; Guest/Household/Entourage routes; web RSVP and confirmation routes, RSVP form/actions and /api/w/[slug]/rsvp; Guest-domain parsers/validation and tests.

## Does not own

Artwork, Website presentation shell, authoritative Seating/Pass/check-in mutations, styling targets, or root navigation.

## Backend authority

Semantic owner: wedding_people Guest identity operations (partner linkage coordinated with 03), guest_households, guests, guest_rsvps, guest_groups/memberships, guest_allowances/claims, entourage_roles/assignments, guest_household_rsvp_progress; create_guest_household/create_guest/add_existing_person_as_guest/update_guest_person, set_guest_rsvp, guest_submit_rsvp, delivery/allowance RPCs; private.household_website_tokens and issue/revoke/validation semantics; guest-rsvp Edge. Agent 02 writes backend.

## UI authority

guests/* except Agent 06 pass module; /w/[slug]/rsvp and confirmation; /api/w/[slug]/rsvp. Agent 08 owns /invitation page composition and consumes Agent 05's CTA/authorization contract.

## Stitch authority

Guests Home, Guest List, Individual Guest Details, Household / Invitation Details, Entourage Management, Katipan Guest RSVP Form and Confirmation; Guest Wedding Invitation as collaborating owner.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Household != Guest != RSVP != invitation delivery != seating != check-in. Invitations identify authorized Household context with opaque tokens; public visitors cannot RSVP. Canva receives a KATIPAN link/QR asset, never authority to write responses. Reuse existing person/Guest for Entourage and account joins.

Own guest_submit_rsvp semantics even though it resides in a website migration/shared Edge file. Shared _shared/guest_website.ts is written by Agent 02 with 05 approving RSVP behavior and 08 approving guide behavior. Physical RSVP acceptance covers browser keyboard and multi-Guest response editing.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 2: create Household/Guest, existing-person reuse, independent mixed responses, allowance claims/concurrency, token expiry/revoke/wrong Household/Wedding, no public RSVP, no duplication. Run mobile Guest and web RSVP tests plus SQL/Edge authorization cases via Agent 02.

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
