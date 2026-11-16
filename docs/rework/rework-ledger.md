# Rework ledger

Agent 00 maintains this ledger. Updated 2026-11-16 for the R1 Core Workspace reservation. R1 is the first product implementation phase; this ledger entry does not claim a release gate has passed.

## Current state

| Field | Value |
| --- | --- |
| Current phase | R1 Core Workspace — PENDING PHYSICAL QA |
| Foundation branch/base | `feat/r1-core-workspace` from updated `origin/master` (`8c85122`) |
| Preserved work | wip/pre-rework-journey-a-20261116 at 4c44a01; pushed and verified during preflight |
| Local state | `.codex/config.toml` classified `KEEP_LOCAL_UNCOMMITTED`; observed as 6 added lines before branch creation and left unchanged/unstaged |
| Completed agent slices | R0 foundation; R1 Agent 00 preflight/reservation, Agent 02 read-only audit, Agent 01 Stitch contract, Agent 03 implementation, and Agent 10 automated QA. Agent 00 final disposition recorded as PENDING PHYSICAL QA |
| QA gate status | Automated G1 checks PASS; physical G1 PENDING. A-003 and A-007 remain OPEN pending Android verification |
| R1 automated test baseline | `npm.cmd test` before implementation: 46 files / 362 tests passed (Vitest 5.0.1) |
| Release readiness | NOT READY; mandatory Android physical verification remains open |
| Next authorized agent | Agent 00 holds R2. When the user connects the current Android development build and QA accounts, Agent 10 runs the seven pending physical scenarios; Agent 00 then records the final R1 gate decision |

## R1 preflight and reservation

### Git preflight classification

| Path | Classification | Evidence and action |
| --- | --- | --- |
| `.codex/config.toml` | KEEP_LOCAL_UNCOMMITTED | It was the sole modified path on `master` before branch creation (`git status --short --branch`; `git diff --stat` showed 6 insertions). User explicitly required it remain unchanged and unstaged. It was excluded from all Git mutations. |
| All other tracked/untracked paths | No local changes observed | Initial `git status --short --branch` showed no other modified or untracked paths. No files were discarded or stashed. |

`origin/master` was fetched and fast-forward checked; it was already up to date at `8c85122`. The `feat/r1-core-workspace` branch was created from that base. No merge is authorized.

### Agent 03 file and contract reservation

Owner: Agent 03. Branch: `feat/r1-core-workspace`. Start: after Agent 02 and Agent 01 complete their R1 contracts. Release: after Agent 10 verifies the applicable R1 gate and Agent 00 records the disposition. The reservation excludes every R2+ domain and excludes `.codex/config.toml`.

| Reserved scope | Exact allowed files / contracts | Collaborators and constraints |
| --- | --- | --- |
| Auth and account lifecycle | `apps/mobile/src/auth/client.ts`, `apps/mobile/src/auth/email.ts`, `apps/mobile/src/auth/email.test.ts`; additional session state and focused tests may be added only under `apps/mobile/src/auth/` | Agent 03 writer. Supabase semantics remain as audited by Agent 02. |
| Couple onboarding | `apps/mobile/src/onboarding/api.ts`, `api.test.ts`, `components.tsx`, `model.ts`, `model.test.ts`, `provider.tsx`, `WeddingDateField.tsx`, `WeddingDateField.native.tsx`, `WeddingDateField.web.tsx`; focused new onboarding tests may be added under this directory | Agent 03 writer; no shared visual primitive edits. |
| Workspace state and selection | `apps/mobile/src/workspace/api.ts`, `api.test.ts`, `context.tsx`, `model.ts`, `model.test.ts`, `placeholder-screen.tsx`, `presentation.ts`, `selector.tsx`; focused new core-workspace tests may be added under this directory | Agent 03 writer. `home-api.ts`, `home-api.test.ts`, and `home-screen.tsx` are excluded (Agent 04). Agent 04 reviews active-workspace and root Back interfaces without co-editing Agent 03 files. |
| Coordinator workspace shell | `apps/mobile/src/coordinator/api.ts`, `api.test.ts`, `client-wedding-screen.tsx`, `invite-couple-screen.tsx`, `model.ts`, `model.test.ts`, `onboarding-screen.tsx`, `overview-screen.tsx`, `team-screen.tsx`; focused new coordinator workspace tests may be added under this directory | Agent 03 writer. No coordinator feature redesign. |
| Root/access/workspace/coordinator routes | `apps/mobile/src/app/_layout.tsx`, `index.tsx`, `accept-invitation.tsx`, `auth/callback.tsx`; `apps/mobile/src/app/(access)/_layout.tsx`, `auth.tsx`, `create-wedding.tsx`, `invite-partner.tsx`, `motif-complete.tsx`, `wedding-details.tsx`, `welcome.tsx`; `apps/mobile/src/app/(workspace)/_layout.tsx`, `weddings.tsx`; `apps/mobile/src/app/(coordinator)/_layout.tsx`, `onboarding.tsx`, `create-client-wedding.tsx`, `[weddingId]/overview.tsx`, `[weddingId]/invite-couple.tsx` | Agent 03 writer. Add only focused root-navigation tests under an existing app test location after confirming test conventions. |
| Wedding root, More, Team, native app config | `apps/mobile/src/app/(wedding)/[weddingId]/_layout.tsx`, `more.tsx`, `team.tsx`; `apps/mobile/app.json` | Agent 03 owns root/tab behavior. `home.tsx` and every feature route/layout are excluded. Shared `apps/mobile/src/ui/index.tsx` is owned by Agent 01 and is not reserved to Agent 03. |
| Workspace handoff contracts | `docs/rework/r1-core-workspace-contract.md`: navigation/session state machine; selected-Wedding validation; account/Wedding/session cache scopes and revision; request cancellation/commit ownership; loading/empty/unauthorized/unavailable/recoverable-error semantics; visible Back and Android root Back rules | Agent 03 writes the Core Workspace contract for consuming domains. Agent 04 reviews only Home/root-navigation integration. Agent 00 owns this ledger. |

### Prerequisite and regression dependencies

- Agent 02 owns the R1 subsection in `docs/rework/supabase-contract-audit.md` (audit only; no live mutation) and may inspect repository migration/type files read-only. Agent 01 owns the R1 design contract in `docs/rework/r1-stitch-contract.md` and may query Stitch/read current UI files; no UI primitives are modified during contract work. Agent 10 owns `docs/qa/r1-core-workspace.md` and the R1 QA evidence in `docs/rework/qa-gates.md`; QA is read-only with respect to product fixes.
- Agent 02 must complete the read-only audit of Auth/profile linkage, Wedding and membership lifecycle (including DRAFT), partner/account linkage, invitation acceptance, role grants/RLS, and relevant RPCs before dependent implementation. Any required backend change stops that path pending a separate proposal/authorization.
- Agent 02 completed the R1 audit on 2026-11-16: KEEP all audited core backend contracts; no migration or generated-type update. The 22 migration names/versions match DEV, the R1 matrix is recorded in `docs/rework/supabase-contract-audit.md`, and no DEV writes occurred. Core lifecycle finding: active membership is independent of Wedding DRAFT/ACTIVE status. R1-relevant live advisors are recorded there; leaked-password protection remains an Auth-setting disposition before release.
- Agent 01 completed the R1 Stitch contract on 2026-11-16: all 21 mapped R1 screens (screenshot and HTML) and all six project IMAGE entries were retrieved/inspected. No dedicated Sign In, Sign Up, verification, or acceptance screen exists; the Warm Editorial access baseline is used. The complete design/navigation/state/Back/accessibility contract is `docs/rework/r1-stitch-contract.md`; no app code or shared UI was changed. Agent 03 is now eligible to start.
- Agent 03 completed the reserved Core Workspace implementation on 2026-11-16. A-003 is addressed with auth-event/request generations, explicit workspace restoration status, account checks, same-account recoverable errors, and delayed storage ordering. A-007 is addressed in code with post-login root replacement, a session-keyed root stack, and Couple Home Android Back handling. The implementation handoff is `docs/rework/r1-core-workspace-contract.md`. No backend change, migration, generated-type update, or DEV mutation occurred.
- Agent 03 validation on final code: full suite 47 files / 383 tests passed (baseline 46 / 362; +1 file / +21 tests); root typecheck passed; focused auth/workspace/invitation tests 37/37 passed; `git diff --check` passed. `npm.cmd run lint` and direct ESLint stalled without results, so lint is unverified. Android export reached Metro startup but did not complete; its confirmed task-specific partial output was removed. Physical Android A-003/A-007 and account-switch acceptance remain pending Agent 10/device availability.
- Agent 10 completed automated Gate 1 verification on 2026-11-16. Final reruns: `npm.cmd test` 47 files / 383 tests; focused R1 tests 6 files / 55 tests; `npm.cmd run typecheck` PASS; `npm.cmd run lint` PASS (exit 0, four mobile warnings, zero errors); Android/iOS/mobile-web Expo exports PASS; `npm.cmd run build` PASS including Next.js production build; changed-path secret scan PASS across 22 paths excluding `.codex/config.toml`; tracked and untracked whitespace checks PASS after Agent 01/03 whitespace-only cleanups. The run record and all seven physical acceptance scenarios are in `docs/qa/r1-core-workspace.md`; Gate 1 evidence is in `docs/rework/qa-gates.md`.
- Agent 10 could not perform physical Android acceptance: `adb` is unavailable, no Android target/build or QA accounts were present, Android native Gradle tooling is absent, and native iOS compile is not available on Windows. The user said they can connect the current Android build and QA accounts later. No DEV fixtures or mutations occurred. A-003 and A-007 remain OPEN; physical scenarios remain PENDING. Agent 00 final R1 gate: **PENDING PHYSICAL QA**. R2 is not authorized.
- Agent 01 must query and inspect the mapped R1 Stitch screens and publish navigation, screen-state, accessibility, safe-area, and Back contracts before Agent 03 starts UI implementation. Canonical tabs stay Home, Plan, Guests, Budget, More.
- Agent 10 must verify state-transition coverage for signed-out launch; restore/resume; no Wedding; selection fallback and A→B switch; logout and cross-account isolation; confirmed membership loss vs transient error; stale request rejection; auth-history replacement; partner identity preservation; and coordinator multi-Wedding restoration where supported. The physical Android gate must cover A-003 and A-007, root/nested/system Back, cold restart, switching, logout/login, and account isolation. Missing device access is PENDING, never PASS.
- R1 excludes Guests/RSVP, planning, Places, styling, seating, Pass, finance, Website/Canva, Run of Show, Guest Program, and Wedding-Day implementation. A cross-domain dependency is a ledger blocker, not permission to edit that domain.

## Open blockers and pending contract changes

| ID | Owner / support | Phase | Required decision / next action | Status |
| --- | --- | --- | --- | --- |
| C-01 | 06 + 03 / 02 | R4 | Confirm draft Pass management scope without weakening guest-facing active-only access; assess snapshot proposal | OPEN |
| C-02 | 08 + 03 / 02 | R6 | Decide explicit activation then publication versus authorized atomic confirmed publish; preserve lifecycle ownership | OPEN |
| C-03 | 09 + 03 / 02 | R7 | Decide draft Run of Show management separately from active check-in | OPEN |
| C-04 | 08 / 02, 05 | R6 | Approve additive Canva credential/design model, scoped server endpoints and Household QR transfer behavior | PROPOSED, not implemented |
| C-05 | 02 / 03 and each semantic owner | R1–R8 | Disposition 53 security-definer warnings, five private no-policy infos, leaked-password warning and 91 unused-index infos | OPEN; no automatic revocation/drop |
| C-06 | 06 / 02 | R4 | Assess private retrievable qr_token protection and retention without breaking stable re-display | OPEN |
| Q-01 | 10 / domain owners | R1–R8 | Reproduce/verify every Journey A finding in qa-gates.md; snapshot does not close findings | OPEN |
| D-01 | 01 / 08 | R6 | Produce detailed mixed-screen website/artwork design contract; preserve website theme controls | OPEN before UI work |

## Write reservations

| Scope | Single writer | Collaborating review | Release condition |
| --- | --- | --- | --- |
| R0 AGENTS.md, .agents/agents, docs/rework | Foundation author under 00 scope | 01 design, 02 backend, 10 QA responsibilities represented by runbooks; no claim of separate agent review | R0 PR handoff |
| R1 Core Workspace code/contracts listed above | Agent 03 implementation; 01/02/10 each own their reserved design/audit/QA documents | Agent 00; Agent 04 reviewed only Home/root navigation boundaries | Closed for the automated implementation slice after Agent 10's PENDING disposition; reopen only specific paths if the pending physical Android gate discovers a code defect. R2 remains unauthorized. |
| Product code, migrations, Edge implementations, DEV | None authorized in R0 | Domain owners for future proposals only | New phase authorization and gate prerequisites |

Before a new slice add exact files/exported contracts, owner, branch, start, release condition and dependencies. Shared-file changes require a single reservation even if several semantic owners review. Add completed slice commit/evidence links and update the next authorized agent only after Agent 10's gate verdict.
