# R1 Core Workspace — QA Evidence

## Android acceptance policy for the resumed R1 run

**ANDROID EMULATOR QA — BLUESTACKS** is the required R1 development Android gate. The earlier “PENDING PHYSICAL QA” verdict below is historical evidence from the first run; it does not describe the current target. BlueStacks results must be recorded per scenario before the development gate can pass. **PHYSICAL DEVICE RELEASE SMOKE TEST — PENDING** remains a separate release requirement for camera, push, hardware lifecycle, and QR scanning.

**DEV Auth QA dependency — pending verification:** Agent 02's read-only DEV audit found `mailer_autoconfirm=false`, meaning Confirm Email is currently enabled. The project-scoped MCP has no supported Auth configuration update. Agent 00 must verify a user-made Dashboard change before Agent 10 resumes account creation. For this emulator development gate, the target DEV setting is Confirm Email disabled so the QA account can enter the normal authenticated app flow. This is a DEV-only QA setting; production must re-enable email confirmation and validate the verification signup flow before release. No setting change or authenticated scenario is claimed here.

The resumed run uses BlueStacks serial `127.0.0.1:5555` explicitly because another Android target may be present. The development APK and scenario evidence will be recorded below after installation.

### Resumed run environment and build

| Item | Evidence |
| --- | --- |
| Source | `feat/r1-core-workspace` at `86aa735` |
| Android target | BlueStacks `127.0.0.1:5555` — `device`; Android 9; model `SM-G998B`; ABIs `x86_64,x86,arm64-v8a,armeabi-v7a,armeabi` |
| Other target | `emulator-5554` is also listed; every KATIPAN ADB action must specify `-s 127.0.0.1:5555` |
| Build profile | `apps/mobile/eas.json` `development`: Expo development client, internal distribution |
| Existing builds | Previous EAS development builds were from earlier commits and expired; no compatible local APK was found |
| Current EAS build | `f762516f-bda1-4306-92b5-6d4456a722e2`, source commit `86aa735`, FINISHED at 2026-11-16 13:26:55 UTC |
| APK | `katipan-r1-f762516f.apk` in the user temp directory; 275,072,503 bytes; SHA-256 `0F20671DB48B0B2DF123EC645867CC391CD9111B8CDCF13D153986C6AFDB139A` |
| Installation | `adb -s 127.0.0.1:5555 install -r` returned `Success`; `pm list packages` confirms `com.inventrasystems.katipan`, version `1.0.0` / versionCode `1` |
| Launcher | Resolved with `cmd package resolve-activity --brief`: `com.inventrasystems.katipan/.MainActivity` |
| Metro | Started from `apps/mobile` with `expo start --dev-client --host lan --port 8081`; listening on `http://localhost:8081`, `.env.local` loaded (values not recorded) |
| Metro connection | BlueStacks host gateway `10.0.2.2` is reachable; the development-client deep link to `http://10.0.2.2:8081` loaded the current JavaScript bundle |
| Signed-out launch | App displayed its normal welcome screen; [redacted, credential-free screenshot](evidence/r1-bluestacks-signed-out.png). The normal account-creation form is reachable. |
| Authenticated scenarios | PENDING Agent 00 verification of the DEV Confirm Email Dashboard setting and normal app sign-up; no authenticated scenario is yet PASS |

One native launch crash occurred on the first development-client introduction after Metro loaded: logcat recorded `Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)` on `mqt_v_js`, with x86_64 `libhermesvm.so` in the backtrace. A force-stop and second launch from the same build and Metro URL stayed alive and displayed the signed-out welcome screen. This is an emulator/native launch observation; repeatability and effect on R1 acceptance remain under QA review. No app code was changed by Agent 10.

### Resumed automated regression

At source commit `86aa735`, `npm.cmd run lint` passed with the same four mobile warnings and zero errors; `npm.cmd run typecheck` passed; focused R1 tests passed 6 files / 55 tests; and `npm.cmd test` passed 47 files / 383 tests, unchanged from the first R1 run. Android Expo export passed with 2,002 modules, iOS Expo export passed with 1,870 modules, and `npm.cmd run build` passed the mobile web export and Next.js production build. `git diff --check` passed for the QA documentation edits. An added-line secret scan found zero matches. A whole-file pattern scan found only a historical QA documentation example pattern, not a credential.

After documenting the pending DEV Auth setting, focused `auth/email`, `auth/session`, and onboarding API/model tests passed 4 files / 23 tests. `git diff --name-only -- apps/mobile` was empty, so the documentation update did not alter the app code validated above.

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
