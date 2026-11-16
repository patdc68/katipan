# R1 Core Workspace — QA Evidence

**QA recommendation:** PENDING PHYSICAL QA
**Run date:** 2026-11-16
**Branch:** `feat/r1-core-workspace`
**Tested source:** Commit `4528f23` (`fix: stabilize core Wedding workspace`), containing the same app/test code validated in the working tree based on `8c85122`. No app code changed after validation.
**Physical target:** None available. `adb devices` could not run because `adb` is not on PATH. Android Studio had no running window and its UI launch timed out during preflight. No device, emulator, development-client build, QA account, or Wedding fixture was used. No DEV state was created or changed.

## Automated validation

| Check | Command | Result |
| --- | --- | --- |
| Full test suite | `npm.cmd test` | PASS — 47 files, 383 tests. Baseline: 46 files, 362 tests; change: +1 file, +21 tests. |
| Focused R1 tests | `npm.cmd exec -- vitest run apps/mobile/src/workspace/model.test.ts apps/mobile/src/workspace/api.test.ts apps/mobile/src/workspace/home-api.test.ts apps/mobile/src/auth/session.test.ts apps/mobile/src/onboarding/api.test.ts apps/mobile/src/onboarding/model.test.ts` | PASS — 6 files, 55 tests. |
| Typecheck | `npm.cmd run typecheck` | PASS — all configured workspaces: mobile, web, database, types, UI, utils, validation. |
| Lint | `npm.cmd run lint` | PASS, exit 0. Web ESLint had no errors. Mobile ESLint emitted 4 warnings and no errors: duplicate import of `onboarding/provider` in `apps/mobile/src/app/_layout.tsx`, plus exhaustive-deps warnings for `requestGeneration.current` in onboarding cleanup and `requests.current` in workspace cleanup. |
| Android JS export | `npm.cmd exec --workspace=@katipan/mobile -- expo export --platform android --output-dir $qaExport` (`$qaExport = Join-Path $env:TEMP 'katipan-r1-core-android'`) | PASS — Android bundle exported after 2,002 modules. This is not device or native-build evidence. |
| iOS JS export | `npm.cmd exec --workspace=@katipan/mobile -- expo export --platform ios --output-dir $qaExport` (`$qaExport = Join-Path $env:TEMP 'katipan-r1-core-ios'`) | PASS — iOS bundle exported after 1,870 modules. No paid signing or device compile was attempted. |
| Mobile web export | `npm.cmd exec --workspace=@katipan/mobile -- expo export --platform web --output-dir $qaExport` (`$qaExport = Join-Path $env:TEMP 'katipan-r1-core-web'`) | PASS — web bundles exported; 147 static routes generated. |
| Production web build | `npm.cmd run build` | PASS, exit 0 — mobile web export plus `next build` for `@katipan/web`; Next.js 16.3.6 compiled, typechecked, generated static pages, and finalized routes. |
| Changed-path secret scan | PowerShell assembled `git diff --name-only HEAD` and `git ls-files --others --exclude-standard`, excluding `.codex/config.toml`, then ran `Select-String -List` over the 22 changed paths for private-key PEM, `sb_secret_`, service-role assignments, credentialed Postgres URLs, Google API keys, GitHub tokens, AWS access-key IDs, and Slack tokens. | PASS — no matches. `.codex/config.toml` was excluded and left untouched. |
| Whitespace/diff check | `git diff --check HEAD -- . ':(exclude).codex/config.toml'` plus a trailing-whitespace sweep of untracked files | PASS — tracked and untracked changed files are clean after Agent 01/03 contract cleanup. The local config was excluded. |

The export/build commands validate bundling and compilation only. No native Android Gradle build was available: this managed project has no `apps/mobile/android/gradlew.bat` or `apps/mobile/android` directory, and no Android SDK path or `adb` command was available. No iOS native compile was available on this Windows host (`xcodebuild` is absent). These commands do not validate native navigation, session persistence, Android hardware Back, or the installed development client.

## Automated R1 regression coverage

The focused state, API, onboarding, and session tests pass for signed-out launch, cold/resume loading, no-Wedding state, authoritative selected-Wedding restore, deterministic invalid-selection fallback, Wedding A-to-B switching and cache revision, logout clearing, Account A/Account B isolation, membership loss, recoverable membership-read failure, stale request rejection, authentication-root history replacement, invitation acceptance identity reuse, and coordinator portfolio restoration. Dashboard API tests assert active-Wedding scoping and reject inactive membership. Invitation API tests assert use of the existing acceptance RPC and preserve the existing Wedding/person identity contract.

These are automated model/API tests. No live invitation was accepted, no account or Wedding was created, and no DEV contract was exercised by Agent 10. The migration/type/RLS state was not modified in R1; see the Agent 02 audit for backend contract findings.

## Physical Android acceptance — pending

All seven physical scenarios remain **PENDING** because no current Android development build/device or test accounts are available. Do not close A-003 or A-007 from exports, source review, or automated tests. On a connected development-build device, record OS, device/emulator, client build, tested source commit, and redacted evidence for each case:

| Scenario | Required physical steps | Status |
| --- | --- | --- |
| 1 — Fresh authentication and root history | Launch signed out; sign in; confirm the authenticated Wedding loads and Sign In is not underneath Home. Press Android system Back at Home; confirm Sign In never appears. Reopen KATIPAN and confirm the authenticated workspace restores. | PENDING — A-007 |
| 2 — Cold restart/resume restoration | While signed in, force-stop and reopen KATIPAN several times. Observe the deliberate loading state, then verify the same authorized Wedding. Repeat after background/resume; open Plan and Guests during/after restoration. Confirm the user never sees “Wedding workspace unavailable” while resolution is pending. | PENDING — A-003 |
| 3 — Root-tab stress | Navigate Home → Plan → Home → Guests → Budget → More → Home. Confirm the workspace remains stable and the selected Wedding does not disappear. Do not assess feature correctness. | PENDING |
| 4 — Wedding switching | If the account has two accessible Weddings, switch A → B, visit root tabs, force-stop/reopen, and verify B restores with no A title/data. No fixture may be created for this QA run. | PENDING — account data unavailable |
| 5 — Logout/login | Account A → logout → sign in as Account A again. Confirm the correct authorized workspace restores with no stale state. | PENDING |
| 6 — Cross-account isolation | If a second QA account is provided, sign out from A and sign in as B. Confirm no A Wedding ID, title, membership, or cached feature data is visible at any point. | PENDING — second account unavailable |
| 7 — Android Back and nested routes | From Sign In, authenticated Home, a nested R1 screen, My Weddings, and Home, test visible Back and Android system Back. Nested Back must return to the preceding valid authenticated screen; root Back must remain at the authenticated root or exit/minimize natively, never reveal Sign In. | PENDING — A-007 / nested Back |

### Open defect verification steps

- **A-003 — MAJOR, OPEN pending physical regression:** On Android, sign in or resume with a valid membership, allow session refresh/restoration to overlap, then open Plan and Guests while authoritative membership resolution is in progress. Repeat cold starts. Expected: loading remains visible until resolution; the valid Owner never sees the empty/unauthorized “Choose a Wedding you currently belong to” or “Wedding workspace unavailable” state due only to the race. Record each repetition and any transient state.
- **A-007 — MAJOR, OPEN pending physical regression:** Sign in, confirm authenticated Home, press Android system Back at the root, then relaunch. Expected: Sign In is never exposed from authenticated history; root behavior is native-safe, and reopening restores the authorized Wedding. Also test nested R1 routes and My Weddings with visible and system Back.

No physical evidence files exist for this run. Re-run these cases on the current Android development build after it is connected; include redacted screenshots/log references without passwords, invitation tokens, or personal data.

## QA disposition

Automated acceptance passed, with the lint warnings listed above. A-003 and A-007 have passing regression coverage in code but remain **OPEN** until their required Android physical steps pass. Account/Wedding isolation, switching, logout/login, and route history therefore remain physically unverified. **Agent 10 recommends PENDING PHYSICAL QA. Agent 00 owns the final R1 gate decision.**
