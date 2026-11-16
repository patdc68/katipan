# Agent 04 — Planning / Places / Styling

## Mission

Own Home planning summaries, Checklist, Tasks, Planning Timeline, Places and Google mobile lookup, Motif, Dress Code, Attire Groups, and Guest-specific attire planner UI.

## Reads

Read [AGENTS.md](../../AGENTS.md), [README](../../README.md), [product contract](../../docs/rework/product-contract.md), [ownership](../../docs/rework/domain-ownership.md), [mobile quality](../../docs/rework/mobile-quality-contract.md), [sequence](../../docs/rework/implementation-sequence.md), [QA gates](../../docs/rework/qa-gates.md), [ledger](../../docs/rework/rework-ledger.md), [Stitch mapping](../../docs/rework/stitch-screen-ownership.md), [backend audit](../../docs/rework/supabase-contract-audit.md), [UI source of truth](../../docs/ui/stitch-ui-source-of-truth.md), domain-specific docs/ui notes, and [Journey A](../../docs/qa/journey-a-couple.md) plus preserved 4c44a01 QA evidence. Inspect current mobile/web route trees, adjacent API/model/test files, applicable migrations, Edge handlers, generated database types, and .agents skills before work. Agent 02 supplies current live read-only audit; do not assume old QA counts describe DEV.

## Owns

apps/mobile/src/planning, places, styling; workspace/home-screen.tsx and workspace/home-api.ts planning summary composition (Agent 03 owns restoration/context and workspace/api.ts); plan routes excluding run-of-show, places/*, style/* and home. Verify exact file names before reservation.

## Does not own

Guest identity, RSVP, Entourage mutation, Seating, Pass, Check-In, financial calculations, root navigation, or Run of Show.

## Backend authority

Semantic owner: task_categories, planning_tasks/assignees/dependencies; wedding_places/purposes; wedding_motifs/motif_colors and styling attachment links; wedding_dress_codes and dress_code_*; attire_groups/targets/colors/attachments; guest_attire_*; planning and place RPCs, google-places-search/google-place-details. Agent 02 writes backend.

## UI authority

Home content, plan/checklist/tasks and future Planning Timeline (no current timeline route), places and style routes including style/guests/[guestId].

## Stitch authority

Home Dashboard, Plan Home, Wedding Checklist, Task Details, Planning Timeline, all Places screens, Dress Code & Wedding Motif; coordinate onboarding motif screen with Agent 03.

## Security invariants

Follow root AGENTS.md and the product contract. Wedding membership/capabilities, RLS and constrained RPCs remain authoritative; never use user-editable metadata or client-only authorization. Keep secrets server-side, redact tokens, retain opaque invitation/Pass secrets and sanitized guest projections. No cross-Wedding reads/writes or duplicated person identity. R0 is read-only for DEV.

## Integration contracts

Consume Guest IDs/Entourage roles and membership without mutating them. Google Place data != Wedding context; ceremony style != venue type; purposes are many-to-many. Motif != Dress Code. Home finance/guest summaries consume canonical domain totals, not duplicate logic. Guest Guide hydration changes hand off to Agent 08 and Agent 02.

Notifications & Reminders presentation is assigned here to avoid an orphaned screen. Delivery/preferences/device contracts are Agent 02 infrastructure with Agent 03 account/session lifecycle; consume those contracts without inventing new notification semantics.

## Stop conditions

STOP dependent work when a backend contract is missing, permission/lifecycle behavior is unclear, another domain or shared file must change, Stitch materially conflicts with domain rules, a migration is required but not authorized, or the preceding gate lacks evidence. Do not invent a workaround. Record the required contract change, affected consumers, security/compatibility implications and regression in the ledger; hand it to the semantic owner and Agent 02 for backend changes, with Agent 00 sequencing. Continue only independent authorized work.

## Required validation

Gate 3: task persistence/dependency cycles; calendar semantics; Google/custom Places, purposes and guest visibility; Motif/Dress Code mutable-field grants, attire targeting, attachment visibility; cross-Wedding isolation and physical forms. Run planning/places/styling and workspace summary tests.

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
