# QA and integration gates

Agent 10 owns verdicts; Agent 00 sequences work. Each gate records tested commit, commands/results, device/OS/client build, browser, evidence references, role/account/Wedding boundaries, unresolved defects and verifier. PASS requires both automated and required physical evidence. PENDING means unexecuted; BLOCKED means a prerequisite/tool/product defect prevents execution. DEFERRED is a defect classification, never a substitute for required acceptance. R0 performs no DEV mutation or device journey.

## Gate matrix

| Gate | Automated acceptance | Physical / end-to-end acceptance |
| --- | --- | --- |
| 0 Foundation | All 11 runbooks/required sections; unique ownership; all 67 Stitch entries; backend audit/evidence; links, lint, typecheck, tests, diff and secret scan; documentation-only diff | Not applicable; explicitly no product acceptance claim |
| 1 Core Workspace | Latest restore wins; cache isolation; email callback/expiry/replay; creation/acceptance reuses identity; roles/lifecycle; no transient-loading authorization error | Fresh signup, email verification, Wedding creation, partner acceptance, session cold/resume restore, Wedding switching, logout/login, Android root Back, iOS Back/deep links, no workspace race |
| 2 Guests/RSVP | Household/Guest creation, existing-person uniqueness, independent responses, allowances, delivery separate, token expiry/revoke/wrong Household/Wedding, no public write | Household with mixed ATTENDING/DECLINED, each independent save, reopen invitation, browser keyboard, no duplicate Guest/person on account join |
| 3 Planning | Task CRUD/dependencies/date persistence; Places purpose visibility/Google separation; Motif/Dress Code/attire grants and cross-Wedding isolation | Save/reload tasks, Google/custom Places, multi-purpose place, Motif/Dress Code/attire; date/multiline keyboards and picker |
| 4 Seating/Pass | Attending-only default pool, table capacity/uniqueness/concurrency, optional seats, split warning, table deletion preserves Guest; pass identity unchanged by seat/table edits | Owner issue/view/revoke/rotate under agreed lifecycle; eligible unseated Guest receives Pass; table changes show dynamically; real QR readability; Household pass selection |
| 5 Finance | Commitment/installment/actual separation, partial and unscheduled payment, same-key retry/payload mismatch, reversal, receipt scope, canonical total refresh/no duplicates | Discover Supplier payments, numeric keyboard/validation, rebuilt native document picker, receipt upload/view/cancel/error; confirm authoritative totals after retry/reopen |
| 6 Website/Canva | OAuth state/PKCE/replay/scopes/account switch/revocation; design authorization; QR export/handoff; publish lifecycle; sanitized Guide; token-scoped RSVP | Connect, create/select/open design, free-account edit, RSVP QR optional upload/manual fallback, return/link/export, Website publish; Safari/Chrome guest-safe Guide and authorized response |
| 7 Wedding Day | Run of Show independent from Program, explicit review/publication, manual/QR duplicate protection, foreign/revoked pass, reversal history, client event replay, account-scoped offline queue | Real scanner/camera denial, manual lookup/batch per Guest, multiple staff devices, duplicate scan, undo, offline manual/reconnect, published schedule unchanged until confirmed |
| 8 Full Journey | Full existing tests, role matrix, affected builds/exports, SQL/Edge checks and all advisor dispositions; no unresolved BLOCKER/MAJOR | Couple, Guest, Coordinator, Wedding Day and Finance E2E; Android/iOS planner and Safari/Chrome guest flow; visual comparison with 01 |

## Gate 1 R1 evidence

For the resumed R1 development run, **ANDROID EMULATOR QA — BLUESTACKS** is the Android acceptance target. A physical phone is not required for this development gate. Record **PHYSICAL DEVICE RELEASE SMOKE TEST — PENDING** separately for later release QA, including camera, push, hardware lifecycle, and QR scanning. The original physical-device limitation in the following paragraph describes the first R1 run; the resumed BlueStacks evidence belongs in [R1 Core Workspace QA evidence](../qa/r1-core-workspace.md).

DEV Auth configuration is a prerequisite for the resumed emulator account journey. Agent 02 found `mailer_autoconfirm=false` (Confirm Email enabled); the project-scoped MCP cannot update that setting. Agent 00 must verify the user-made Dashboard change before Agent 10 submits a QA signup. The development gate may use Confirm Email disabled on DEV to exercise authenticated Core Workspace behavior. Production must re-enable email confirmation and validate the email-verification signup flow before release; this release check remains pending and is not counted as a BlueStacks development PASS.

Agent 10's R1 run is **PENDING PHYSICAL QA**. Automated acceptance passed on branch `feat/r1-core-workspace`; the run-time snapshot tested `HEAD` `8c85122` plus the uncommitted R1 working tree. The verified app/test code is now in final commit `4528f23` (`fix: stabilize core Wedding workspace`) with no app code changed after validation. Checks included `npm.cmd test` (47 files / 383 tests; baseline 46 / 362), focused workspace/auth/onboarding tests (6 files / 55 tests), `npm.cmd run typecheck`, `npm.cmd run lint` (4 mobile warnings, 0 errors), Android/iOS/mobile-web Expo exports, `npm.cmd run build`, changed-path secret scan, and tracked plus untracked whitespace checks. See [R1 Core Workspace QA evidence](../qa/r1-core-workspace.md) for exact commands, results, and physical steps. No Android target was available (`adb` is not on PATH); exports are not device evidence. A-003 workspace restoration and A-007 authenticated Android root Back remain **OPEN pending physical regression**. Agent 00 makes the final gate decision.

## Permission matrix

Agent 02 supplies exact per-RPC/table capabilities; QA must exercise OWNER, FULL_COORDINATOR, DAY_OF_COORDINATOR, GUEST_COORDINATOR, removed/left member, unrelated authenticated user, anonymous visitor, and valid/invalid/expired/revoked/foreign-Household invitation. Include coordinator-managed before client acceptance and couple-owned afterward, each partner accepting independently, final-Owner protection, and DRAFT/ACTIVE/COMPLETED/ARCHIVED boundaries. A Full Coordinator never gains Owner authority through broad planner access. Guest access stays sanitized, not raw guest-table access. UI hidden controls do not count as authorization tests.

## Journey A defect ownership

Evidence sources: current [Journey A](../qa/journey-a-couple.md) records A-001/A-002 and the original A01 pass. The preserved `4c44a01:docs/qa/journey-a-couple.md` adds later findings and reports pending device/SQL/DEV checks. Its six extra unit tests and unapplied migration are **not** on this foundation base. Original A01 does not disprove later overlapping-restoration races. Severities below for later findings are provisional architecture triage, not a claim of new device reproduction. There is no source A-004; do not invent one.

| Finding ID | Severity | Owner | Supporting | Likely subsystem / route | Required regression gate |
| --- | --- | --- | --- | --- | --- |
| A-001 Places tab routing | MAJOR | 03 | 04, 01, 10 | Wedding Tabs/places nested Stack; fix d71a5db is already in base, physical regression remains open | G1 five tabs and Back; G3 Places navigation |
| A-002 native DocumentPicker | BLOCKER (environment) | 07 | 03 native build, 10 | Supplier payment screens; dependency declared, installed development client lacked module | G5 rebuilt Android/iOS picker and receipt; reclassify as product defect if still failing |
| A-003 workspace unavailable race | MAJOR | 03 | 02, 10 | auth snapshot/events and membership restoration, Plan/Guests entry | G1 out-of-order snapshots, account switch, resume and no false unavailable |
| A-005 numeric Budget keyboard overlap | MAJOR | 07 | 01, 03 config, 10 | Budget amount forms / native keyboard layout | G5 focused field/submit visibility on Android/iOS |
| A-006 inconsistent nested Back | MAJOR | 03 (navigation contract) | 04/05/06/07/08/09 implement own routes; 01/10 | Guest, Entourage, styling, Seating, Places and other nested controls | G1 canonical behavior then G2–G7 route-specific Back/deep links |
| A-007 authenticated Back exposes Sign In | MAJOR | 03 | 04 Home host, 10 | Auth success history and Android root Home | G1 sign-in/resume/root Back/reopen |
| A-008 Guest Pass management availability | MAJOR | 06 | 02, 03 | ACTIVE-only private.can_manage_guest_pass versus draft planner expectations | G4 explicit lifecycle role matrix and unseated eligible Guest |
| A-009 Dress Code / Attire Group authorization | MAJOR | 04 | 02, 10 | Styling upsert attempts protected wedding_id UPDATE | G3 create/update allowed fields, group creation, reload and unauthorized denial |
| A-010 Supplier payment discoverability | MINOR | 07 | 01, 10 | Budget Item -> Supplier Details -> Payment Schedule | G5 complete commitment/installment/payment path without coaching |
| A-011 Website publication failure | MAJOR | 08 | 02, 03, 10 | Draft publish rejected by current lifecycle contract | G6 agreed activation/publication flow and safe live Guest page |
| QA-ROS (un-numbered snapshot finding) | MAJOR | 09 | 02, 03, 10 | Draft operational timeline management / Add action | G7 add/persist/dashboard; no Guest Program mutation; draft check-in still denied |
| QA-DATE (un-numbered snapshot finding) | MINOR | 07 | 04/09 for own dates, 01/10 | Supplier commitment date and shared calendar semantics | G3/G5/G7 Android/iOS timezone round trip |
| QA-ICONS (un-numbered snapshot finding) | POLISH | 01 | 03, 10 | Custom tab SVG adaptation in snapshot lacks exact visual comparison | G1 compare all five tab icons against Stitch; do not assume snapshot canonical |
| QA-TOOLS (Phase 0 limitation) | BLOCKER (verification environment) | 10 | 02 | Missing local SQL/Edge runner reported historically | Before affected gate: provision authorized local tooling and run SQL/Edge tests; no DEV workaround |

No defect is fixed or closed in R0. Snapshot code remains preserved separately. A-009/A-011 snapshot records historical rollback-only probes; this audit does not repeat them. The reported Run of Show video was unavailable to the prior session; retain that evidence limitation.

## Reproduction and resolution record

For each finding copy the source reproduction and capture: exact steps; expected behavior; actual behavior; route; affected domain; owning and supporting agent; tested commit/device/build; severity; evidence path; regression requirement; fix commit; resolution verification with date/verifier. Keep historical evidence and new results distinct. Never record raw RSVP links, QR payloads, passwords, provider tokens or private guest data in screenshots/logs.

Minimum reproduction recipes for later findings: A-003 overlap session restore/auth refresh then open Plan/Guests; A-005 focus amount and open numeric keyboard; A-006 enter nested route then use visible/system Back; A-007 sign in then root Back; A-008 issue/view Pass for ATTENDING Guest on DRAFT Wedding; A-009 save existing Dress Code then create Attire Group; A-010 follow Budget Item to record payment; A-011 confirm publish on DRAFT; QA-ROS open draft timeline and add item; QA-DATE choose/save/reopen date across timezone; QA-ICONS compare tab glyphs to actual screens. Expected behavior is the product/phase contract, not a workaround from the snapshot.

## Validation policy

Run repository `npm run lint`, `npm run typecheck`, `npm test`, `git diff --check` and changed-file secret scan for every slice. Build/export affected applications for product slices. Agent 02 additionally runs relevant SQL/Edge tests and security/performance advisors for authorized backend changes; do not pretend Vitest executes Deno/SQL tests. Rebuild native clients after native dependency/config changes. Existing A01, unit tests and JS exports cannot substitute for required device acceptance.

BLOCKER: security/data loss, wrong-Wedding exposure, financial duplication or inability to continue journey. MAJOR: important V1 function broken. MINOR: non-blocking interaction/validation/discoverability defect. POLISH: visual/copy consistency. DEFERRED: explicitly postponed work with rationale and owner; cannot hide required V1 regression. Feature fixes go to their owner, never implemented by QA while testing.
