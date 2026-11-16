# Agent 08 — Website / Canva

## Mission

Own Wedding Website/Guest Guide presentation and Canva connection, OAuth, design select/create/open/link/export, RSVP QR asset handoff, and invitation artwork replacement.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/website and website routes except website/program; web /w/[slug] Guide and /invitation, shared guest route navigation/CSS/render parsing; future Canva client flow after authorization. Shared backend implementation remains Agent 02.

## Does not own

RSVP mutation/token authorization semantics (05), Pass issuance (06), Guest Program publication (09), guest identity, seating, check-in, or a native graphic editor.

## Backend authority

Semantic owner: wedding_websites, wedding_website_sections, website_template and presentation enums, publish_wedding_website, guest_wedding_guide/guest-media projection and guest-wedding-guide/guest-media Edge. Collaborate with 05 for Household tokens and RSVP. Proposed canva_connections/wedding_canva_designs and secure OAuth/design/asset/export server boundaries: conceptual only. Agent 02 writes backend.

## UI authority

website editor/templates/sections/preview; public Guide/invitation. Retain links to RSVP/Pass/Guest Program; do not take ownership of their mutation routes. No Canva route exists yet.

## Stitch authority

Invitation / Website Editor, Template Gallery, Sections & Visibility, Preview & Publish, Personalized Guest Wedding Guide, Guest Wedding Invitation. Preserve website portions; only native artwork portions are SUPERSEDED_BY_CANVA.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Follow canva-integration.md: connect -> OAuth -> select/create -> open Canva -> KATIPAN RSVP link/QR -> optional asset upload -> edit -> return -> link/export -> explicit distribution -> KATIPAN RSVP. No mandatory Pro or Autofill. Never expose client secret/access/refresh tokens to Expo/browser. Website publishing is separate from design export and Guest Program publishing.

Do not drop template_key or website_template. They currently drive live website themes, not a separate artwork schema. Retain current routes until a later audited replacement. Link/export output uses centralized Attachment metadata if copied into KATIPAN Storage.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 6: OAuth state/PKCE/replay/account-switch/revocation; authorized design link/export; optional upload failure/manual fallback; free-account path; return handling; publish lifecycle; guest-safe projection; expired/foreign token denial; no break to RSVP, Guide, Program, Seating, Pass or attendance.

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
