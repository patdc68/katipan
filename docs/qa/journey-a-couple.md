# Journey A — Couple Integration QA

**Run status:** IN PROGRESS - automated branch checks pass; DEV verification and physical Android regression remain pending.

**QA branch:** `qa/journey-a-couple`
**Base commit:** `22e15bb8659a1cdb3565c449fcdd886946501e6c` (`master` at branch creation; merged Coordinator/Team PR #46)
**Run date:** 2026-09-28 initial preflight; follow-up checks 2026-10-07 and 2026-10-08 (Asia/Manila)
**Application:** KATIPAN mobile-first V1; linked DEV only

## Environment and test identity

- Repository uses npm workspaces and `package-lock.json` (`npm@11.17.0`). Runtime versions: Node `v24.19.0`, Expo `57.0.24`, Expo Router `57.0.22`, React Native `0.86.3`, Next.js `16.3.6`.
- The project-scoped Supabase MCP returned `https://fslwqgfuzzgsshkotfpn.supabase.co`, matching the repository's expected project. No production URL was used.
- The live DEV schema reports 59 public tables, all with RLS enabled. All 22 applied migration versions/names match the repository; latest is `20260928124347_guest_program_google_place_id`.
- DEV already contains three Wedding records. Their identities were not queried. Create a genuinely new account and a new Couple-owned Wedding; do not reuse or clean up existing Weddings.
- Partner 1 is referred to as **Account A / Juan dela Cruz**. Partner 2 is **Account B / Maria Santos**. No test accounts have been created yet; passwords and account secrets are never recorded here.
- Canonical Wedding: **Juan & Maria Wedding**, with a future date selected during Phase 2. No Wedding ID exists for this run yet.
- No controlled fixtures or other DEV data were created during preflight.

## Scope and handling

- The original `qa/journey-a-couple` preflight branch changed documentation only. Follow-up code and local migration work is on `codex/journey-a-fixes`; no Supabase data was changed.
- No `supabase db reset --linked`, remote migration, or DEV write was run. The Expo platform exports produce bundles, not an installable Android APK; no native APK build or installation was attempted.
- `.codex/config.toml` had a pre-existing uncommitted modification when work began. It was not read, edited, staged, or included in the QA document. Keep it out of any QA commit.
- Follow `AGENTS.md` product invariants and `docs/ui/stitch-ui-source-of-truth.md` when comparing screens. That UI note documents Warm Editorial Nuptial and Stitch screen mappings; current Expo Router files were inspected for implemented routes.
- Capture screenshots/log references without passwords, invitation raw tokens, Guest Pass QR payloads, API keys, or Supabase secrets. Redact a token-bearing URL before attaching an image.
- Record Wedding/User IDs only when useful for internal reproduction. Never record raw invitation or Guest Pass tokens.

## Phase 0 — Automated preflight

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Git status and branch | PASS with pre-existing worktree change | Started at current `master` commit `22e15bb`; branch `qa/journey-a-couple` created from that commit. Pre-existing `.codex/config.toml` modification remains untouched. |
| Coordinator/Team merge on master | PASS | HEAD is merge commit for `feat/mobile-coordinator-team`; current mobile route tree includes `team.tsx`, coordinator onboarding, client Wedding, invite-couple, and overview routes. |
| Lint | PASS | `npm.cmd run lint` |
| Typecheck | PASS | `npm.cmd run typecheck` |
| Unit/integration tests | PASS | `npm.cmd test`: 46 test files, 362 tests passed. Vitest excludes `supabase/functions/**`. |
| Root workspace build | PASS | `npm.cmd run build`: Expo web export and Next.js build completed. |
| Android Expo export | PASS | `expo export --platform android`; output written to a temporary directory outside the repository. |
| iOS Expo export | PASS | `expo export --platform ios`; output written to a temporary directory outside the repository. |
| Web Expo export | PASS | `expo export --platform web`; output written to a temporary directory outside the repository. |
| Next.js production build | PASS | `npm.cmd run build --workspace=@katipan/web`; Next.js 16.3.6 production build completed. |
| Relevant Edge tests | BLOCKED — environment | Eight Deno test files exist under `supabase/functions/tests`, covering Google Places, Guest Guide/website/media, Guest Pass, Wedding Day check-in, lifecycle, and notification worker. Deno and Docker are not installed/on PATH. The Supabase CLI help probe was also blocked when its telemetry write under the user profile was denied. No Edge or pgTAP SQL tests were run against DEV. |
| Secret-pattern scan | PASS | Scanned app, package, migration, test, docs, and `.env.example` paths for JWT/service key, Google key, private-key, and credentialed database URL shapes. No matches. `.codex` and `.env.local` were not scanned. |
| Placeholder-name audit | PASS | No prohibited sample-name matches in audited app, package, Supabase, docs, or root guidance paths. |
| `git diff --check` | PASS | No whitespace errors reported. |

**Phase 0 gate:** BLOCKED only on unavailable Edge/SQL test tooling. This is an environment limitation, not an observed product defect. All other requested preflight checks passed. No Journey A workflow phases were started during preflight; A01 is the physical checkpoint recorded below.

## Current route and contract map

The Expo Router entry route restores the session, then routes unauthenticated users to `/(access)/welcome`, authenticated users with no Wedding to `/(access)/create-wedding`, and members to Wedding Home or `/(workspace)/weddings`. Welcome links to `/(access)/auth`; Couple onboarding uses `/(access)/wedding-details`, `/(access)/create-wedding`, `/(access)/motif-complete`, and `/(access)/invite-partner`.

Current Couple journey route groups under `apps/mobile/src/app` include:

- Workspace/Home: `/(workspace)/weddings`, `/(wedding)/[weddingId]/home`, `more`
- Places: `places`, `places/search`, `places/new`, `places/[placeId]`
- Styling: `style`, `style/motif`, `style/dress-code`, `style/attire-groups`, guest attire detail
- Planning: `plan`, `plan/checklist`, task create/detail/edit, `plan/run-of-show`
- Guests: guest list/details/edit, households, entourage, Guest Pass API
- Website/Program: templates, sections, preview, editor, guest program list/detail/preview
- Budget/Suppliers: budget dashboard, categories/items/expenses, suppliers, installments, payments
- Seating and Wedding Day: seating event/tables/assignment, `day`, `day/check-in`, `day/scan`
- Guest web routes: `apps/web/src/app/w/[slug]`, invitation, RSVP, confirmation, pass, plus `/api/w/[slug]/rsvp`

Relevant migration/RPC contracts reviewed before QA:

- Couple creation and partner ownership: `20260924062451_core_weddings_people_memberships.sql`, `20260924073949_ownership_client_invitation_workflows.sql`; RPCs `create_couple_wedding`, `issue_partner_owner_invitation`, `accept_wedding_invitation`.
- Places: `20260924154257_wedding_places_purposes.sql`; RPCs `create_google_wedding_place`, `create_custom_wedding_place`, `update_wedding_place_context`, `set_wedding_place_purpose`, `archive_wedding_place`; DEV Edge Functions `google-places-search` and `google-place-details`.
- Guests/RSVP and styling: `20260924124000_guests_households_rsvp_entourage.sql`, `20260925023719_motif_dress_code_attire.sql`; RPCs include `create_guest_household`, `create_guest`, `add_existing_person_as_guest`, `set_guest_rsvp`, and household invitation-delivery RPCs.
- Planning: `20260925031847_planning_tasks_timeline.sql`; task create/update/status/assignment/dependency RPCs.
- Budget and supplier finance: `20260925015103_suppliers_budget_payments.sql`, `20260926131600_finance_source_of_truth.sql`, `20260928111405_supplier_payment_idempotency.sql`; supplier, commitment, installment, payment, reversal, budget-item, and receipt-attachment RPCs.
- Website, RSVP, Guest Guide, and Program: `20260925070520_wedding_website_guest_guide.sql`, `20260926140232_guest_program_media.sql`, `20260928124347_guest_program_google_place_id.sql`; `publish_wedding_website`, `issue_household_website_token`, `guest_wedding_guide`, `set_guest_program_publication`; web RSVP endpoint `/api/w/[slug]/rsvp` and active DEV `guest-rsvp` / `guest-wedding-guide` Edge Functions.
- Seating/Guest Pass/Wedding Day: `20260925073623_seating.sql`, `20260925075659_guest_pass.sql`, `20260925084800_wedding_day_operations.sql`; `seat_guest`, `unseat_guest`, `delete_seating_table`, Guest Pass issue/get/revoke/rotate RPCs, `wedding_day_dashboard`, check-in and reversal RPCs.

Generated types are in `packages/database/src/database.types.ts`; the file includes the reviewed public table, enum, and RPC contract surface. Remote applied migrations match the 22 local migration files exactly. The active DEV Edge Function inventory includes the Google Places, guest guide/RSVP/pass, media, check-in, deletion, and notification functions.

## Physical Android checkpoint

### A01 — PASS

- The tester intentionally logged out, then signed back in.
- KATIPAN restored the expected existing Wedding workspace.
- The expected Wedding belonged to the signed-in account.

**Conclusion:** This single sign-in/sign-out checkpoint passed; it did not exercise the overlapping auth and membership restoration sequence later recorded as A-003. No Wedding/User IDs or account secrets were recorded.

## Manual phases

The remaining manual phases are **PAUSED - not run** until the Android development client is rebuilt and the physical regression steps below pass. Automated checks and local code inspection do not close device findings.

### Phase 1 — Fresh account

**Status:** PAUSED — not run
**Routes:** `/` → `/(access)/welcome` → `/(access)/auth`

- Launch to Welcome and record the first screen before tapping.
- Create a genuinely new Couple account. Check invalid email, invalid/short password, valid sign-up, confirmation behavior, session persistence, and sign-in.
- Confirm the new account reaches clean onboarding without a Wedding from another account. Record any email-confirmation or device limitation.

### Phase 2 — Create Couple Wedding

**Status:** PAUSED — not run
**Routes:** `/(access)/create-wedding`, `/(access)/wedding-details`, `/(access)/motif-complete`, `/(wedding)/[weddingId]/home`

- Use the Couple flow, not Coordinator client creation. Enter Juan dela Cruz, Maria Santos, `Juan & Maria Wedding`, a future date, timezone, general location, estimated guest count, and ceremony style.
- Observe the current Motif onboarding step. Verify one Wedding, `COUPLE_OWNED`, correct origin, creator OWNER, exactly two partner Person records, no duplicate Person records, stable Wedding ID, and Home opens.

### Phase 3 — Invite Partner

**Status:** PAUSED — not run
**Routes:** `/(access)/invite-partner`, `/(access)/auth`, `/accept-invitation`

- From Account A, target the existing Maria Partner Person and issue an invitation. Do not place the raw link/token in this document or screenshots.
- In Account B/session, accept the link and verify both accounts become equal OWNERs on the same Wedding; existing Maria Person is linked; no duplicate Person, no `PRIMARY_OWNER`, no Wedding clone, and both accounts open the Wedding.
- Make a harmless edit from Maria and verify Juan sees it after refresh. Test switching sessions and cached-state isolation.

### Phase 4 — Places

**Status:** PAUSED — not run
**Routes:** `places`, `places/search`, `places/new`, `places/[placeId]`

- Test Our Places, Google minimum search length/debounce, select/save/hydrate Google Place, Custom Place create/edit, context, CEREMONY and RECEPTION purposes, one Place with multiple purposes, guest visibility, private notes, guest notes, and archive confirmation.
- Verify Google rows do not copy Google data into `custom_*`; Custom Place uses custom fields. Archive a disposable Place only and confirm it leaves active surfaces; preserve the Place needed later.

### Phase 5 — Motif & Dress Code

**Status:** PAUSED — not run
**Routes:** `style`, `style/motif`, `style/dress-code`, `style/attire-groups`

- Create/edit Motif and colors; reorder colors; try inspiration upload only if physical picker is available.
- Create Dress Code title, description, venue advice, recommended colors, and avoid colors. Verify Motif colors do not silently populate Guest recommendations.
- Create Principal Sponsors Attire Group with instructions, recommended colors, and avoid colors.

### Phase 6 — Planning

**Status:** PAUSED — not run
**Routes:** `plan`, `plan/checklist`, task create/detail/edit, `plan/timeline`

- Create realistic tasks including “Confirm ceremony venue,” “Finalize guest list,” and “Pay photographer balance.” Test edit, due date, completion, ordering/status, timeline representation, and Home dashboard reflection.
- Reserve Run of Show for Phase 16.

### Phase 7 — Guests

**Status:** PAUSED — not run
**Routes:** `guests`, `guests/list`, `guests/add`, household details/edit, `guests/entourage`

- Create Household A with Roberto Santos and Elena Santos; Household B with Carlo Reyes and a partner/Plus-One scenario. Add a child if supported and one Guest with an Entourage role.
- Test Household, individual Guest, edit, Groups, Entourage, Plus-One/named conversion, child allowance, and invitation delivery. Keep RSVP, delivery state, Household, identity, Entourage, and allowance distinct; check for duplicate Person/Guest records.

### Phase 8 — Attire targeting

**Status:** PAUSED — not run
**Routes:** `style/attire-groups`, `style/guests/[guestId]`

- Assign a Group directly to a Guest and via Entourage role; test one Guest affected by multiple Groups if available. Add Guest-specific guidance.
- Verify general Dress Code, Group guidance, and Guest-specific guidance remain distinct. Do not manually duplicate calculated precedence.

### Phase 9 — Wedding Website

**Status:** PAUSED — not run
**Routes:** `website`, `website/templates`, `website/sections`, `website/preview`; public `/w/[slug]`

- Configure template/title/introduction, PLACES, DRESS_CODE, RSVP, and relevant sections, audience/access mode. Preview before publish; then publish.
- Check private Place notes are absent, only guest-visible purposes are exposed, Google Place name/address are current, Dress Code renders, and personalized content is not public. Do not weaken privacy to force rendering.

### Phase 10 — Guest invitation / RSVP integration

**Status:** PAUSED — not run
**Routes:** Household invitation, `/w/[slug]/rsvp`, `/api/w/[slug]/rsvp`

- Issue one controlled Household website token, open its link in a browser, submit one ATTENDING and one DECLINED individual response, then refresh the Couple app.
- Verify one invitation Household remains intact, responses are individual, declined Guest remains, no duplicate RSVP row appears, and RSVP does not imply check-in. Never record the raw token.

### Phase 11 — Seating

**Status:** PAUSED — not run
**Routes:** `seating`, `seating/tables/[tableId]`, `seating/assign`

- Create/use Reception event; set visibility; create tables/capacities and optional seats. Assign attending Guests, move, unseat/reseat, and set a Guest-visible mode.
- Verify declined Guest cannot be newly seated; attending unseated Guest can be seated; one active assignment per Guest/event; capacity rules; Household split warns only; table deletion preserves Guests.

### Phase 12 — Budget

**Status:** PAUSED — not run
**Routes:** `budget`, `budget/categories`, category details, `budget/items/new`, `budget/expenses/new`

- Create Venue, Photo & Video, and Catering categories. Create/edit Budget Item estimates and a manual non-Supplier actual amount.
- Verify canonical dashboard/category totals update without duplicating Supplier transactions.

### Phase 13 — Suppliers

**Status:** PAUSED — not run
**Routes:** `budget/suppliers`, supplier create/detail/edit

- Create Photographer and Caterer. Test edit, status progression, contact details, linked Budget Item, and commitment.
- Verify committed, scheduled, paid, remaining, overdue, and unscheduled-paid values stay distinct.

### Phase 14 — Supplier installments/payment

**Status:** PAUSED — not run
**Routes:** supplier detail, installments, payments

- For one Supplier, set a PHP 60,000 commitment and two PHP 30,000 installments; record a PHP 10,000 partial payment. Verify `PARTIALLY_PAID`, unpaid balance, Supplier/Wedding/Budget totals, and linked Budget Item `actual_amount` remains null.
- Record a second payment only if useful. Test receipt upload/view only if physical picker is available. Do not simulate an ambiguous duplicate retry in this journey.

### Phase 15 — Guest Program

**Status:** PAUSED — not run
**Routes:** `website/program`, program item detail/new/preview; public `/w/[slug]`

- Create guest-facing program entries, link one to the Google Place, publish the appropriate items, and leave a draft.
- Verify Guest Program remains separate from Run of Show; published items hydrate the current Google Place name; drafts are not guest-visible.

### Phase 16 — Run of Show

**Status:** PAUSED — not run
**Routes:** `plan/run-of-show`, item detail/new

- Create operational Wedding-Day items, set schedule/responsible member/status, and review linked Guest Program items when supported.
- Change operational timing and verify it does not automatically mutate published Guest Program timing. Do not exercise every Wedding-Day status edge case.

### Phase 17 — Guest Pass readiness

**Status:** PAUSED — not run
**Routes:** Guest details/Guest Pass and public `/w/[slug]/pass`

- For an ATTENDING Guest, verify pass availability according to current flow, individual identity, correct Wedding, and current seating reflected dynamically where intended.
- Treat RSVP and Pass as separate. Inspect token opacity without copying the QR payload or raw token into notes/screenshots.

### Phase 18 — Wedding-Day readiness

**Status:** PAUSED — not run
**Routes:** `day`, `day/check-in`, `day/scan`

- Open the Wedding-Day Dashboard and check attending roster, seating context, Pass availability, Run of Show, manual lookup, and QR scanner entry point.
- Do not check any Guest in during Journey A.

### Phase 19 — Cross-account collaboration

**Status:** PAUSED — not run
**Routes:** re-enter Home and the edited planning/styling/guest surface from each account

- From Maria, change one harmless planning/styling/Guest value. From Juan, refresh/re-enter and verify the authoritative value.
- Switch sessions and confirm no locally cached data from another account or Wedding appears.

## Defect log

The Edge/SQL test-runner limitation is recorded under Phase 0 as an environment limitation. A-001 is a product-code defect. A-002 is currently classified as an environment blocker.

| ID | Severity | Affected route | Exact step | Expected | Actual | Reproduction | Evidence | Suspected component/API/RPC | Useful Wedding/User IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-001 | MAJOR — OPEN; physical Android regression pending | Wedding bottom navigation, `/(wedding)/[weddingId]` | Sign in and open the expected Wedding workspace on Android. | Only Home, Plan, Guests, Budget, and More appear as canonical tabs. | Those five appear, along with four additional Places tabs: `places/index`, `places/search`, `places/new`, and `places/[placeId]`. | Open the signed-in Wedding workspace; the extra Places routes appear in the bottom navigation even after the hidden parent `Tabs.Screen` mitigation. | Physical Android QA confirmed the issue persisted after the previous mitigation; no screenshot/log file attached. | Final root cause: `places` lacked a nested Stack `_layout.tsx`, so Expo Router flattened its child routes into the Wedding Tabs navigator. See diagnosis and regression steps below. | Not recorded |
| A-002 | ENVIRONMENT BLOCKER | Supplier payments; native document picker | Open supplier payment screens that import the document picker in the installed Android development client. | The installed development client provides the `ExpoDocumentPicker` native module. | Runtime error: `Cannot find native module 'ExpoDocumentPicker'`. | Run the payment flow in the currently installed Android development client. | Runtime error observed; no screenshot/log file attached. | `apps/mobile/src/suppliers/payments/screens.tsx` imports the module. `apps/mobile/package.json` already declares `expo-document-picker ~57.0.2`; the installed client predates this native dependency. Rebuild after A-001 is merged. If the rebuilt client still errors, reclassify as a product build/configuration defect. | Not recorded |

Severity definitions: **BLOCKER** (journey cannot continue, security/data corruption, wrong-Wedding access, financial duplication, irreversible destructive action); **MAJOR** (important V1 function broken with workaround); **MINOR** (non-blocking visual/UX/validation issue); **POLISH** (visual consistency/copy/layout); **DEFERRED** (known physical-device or V1.1 enhancement).

### A-001 diagnosis and fix

**Status: OPEN — awaiting physical Android regression.** Compilation, tests, and exports do not close this finding.

- **Previous diagnosis:** the parent Wedding Tabs layout omitted `places` from its hidden feature entries.
- **Previous mitigation:** added `<Tabs.Screen name="places" options={{ href: null, title: "Wedding Places" }} />` to `apps/mobile/src/app/(wedding)/[weddingId]/_layout.tsx`.
- **Physical QA result:** the issue persisted; four Places child routes still appeared as tabs.
- **Final root cause:** `places/index.tsx`, `places/search.tsx`, `places/new.tsx`, and `places/[placeId].tsx` had no nested layout boundary. Expo Router flattened them into the parent Wedding Tabs navigator, so hiding `name="places"` alone was insufficient.
- **Fix:** added `apps/mobile/src/app/(wedding)/[weddingId]/places/_layout.tsx` with the established `<Stack screenOptions={{ headerShown: false }} />` pattern. The parent hidden `places` entry is retained.
- **Route-structure audit:** compared Places with `budget/_layout.tsx`, `website/_layout.tsx`, `seating/_layout.tsx`, and `style/_layout.tsx`; all use a nested Stack with headers hidden (Style also specifies its existing slide animation). Audited every immediate Wedding feature directory: `budget` (16 routes), `day` (3), `guests` (9), `places` (4), `plan` (8), `seating` (3), `style` (6), and `website` (8). Places was the only directory missing a boundary; all now have a nested Stack layout.
- **Automated validation (2026-10-02):** `npm run lint`, `npm run typecheck`, `npm test` (46 files / 362 tests), Android/iOS/web `npx expo export --platform <platform>` from `apps/mobile`, root `npm run build`, `npm run build --workspace=@katipan/web`, and `git diff --check` all passed. Expo Router route-tree checks on Android, iOS, and web reproduced four flattened `places/...` children when the Places layout was excluded, and confirmed those routes are nested under `places` when it is included. The parent Tabs configuration exposes exactly Home, Plan, Guests, Budget, and More. Physical navigation/back behavior remains pending the regression below.

### A-001 physical Android regression steps

1. Load this fix in the physical Android development client with a fresh Metro bundle (`npm run start --workspace=@katipan/mobile -- --clear`), then fully reload the app. Record the tested commit, device, and client build.
2. Sign in and open the expected Wedding workspace. Confirm exactly five bottom tabs in order: **Home, Plan, Guests, Budget, More**. Confirm `places/index`, `places/search`, `places/new`, and `places/[placeId]` never appear as tabs.
3. Open **More → Manage Wedding Places** and confirm Our Places loads for the same Wedding.
4. From Our Places, open Place Search, then use **Back to Our Places**. Open Add Custom Place, then use **Cancel**. Open an existing Place's details, then use **Back to Our Places**. Repeat these flows using Android system Back; confirm each returns to the preceding Places screen.
5. From Our Places, use its back control or Android system Back to return to the originating workspace screen. Confirm the canonical five tabs still work after leaving and reopening Places and after reloading the Wedding workspace.
6. Attach screenshots/device-log references and record pass/fail. Close A-001 only after all physical Android regression steps pass; otherwise keep it open with the failing route and reproduction.

## Screenshots and logs to capture manually

Use phase-numbered names such as `A01-welcome.png`, `A02-wedding-details.png`, `A03-partner-invite-redacted.png`, then `A04-places-*` through `A19-cross-account.png`. Capture before/after states around failures and refreshes, with the visible route and platform/build when possible. Redact emails if not needed, all passwords, every raw invitation/Guest Pass token, QR payloads, API keys, and private Place notes from public-site screenshots. Add file paths or device-log references to the defect row.

## DEV cleanup notes

- Preflight created no account, Wedding, invitation, fixture, file, or other DEV data.
- During Journey A, use one fresh Couple account pair and the single canonical Wedding, then only the minimum controlled Guests, places, tasks, finance rows, and program entries needed by the phases.
- Keep unrelated pre-existing DEV data untouched. Do not permanently archive the only Place needed later. At the end, list only test-owned data for cleanup; do not run broad deletion/reset operations as part of this QA run.

## Current verdict and Journey A fix-branch status

**Fix branch:** `codex/journey-a-fixes` (no merge or deployment performed).

The original A01 physical checkpoint remains a pass. The findings below have local code fixes or migration changes prepared, but the app and migration remain unapplied in DEV. This follow-up therefore records implementation and automated evidence separately from DEV and device verification. All physical Android retests remain pending; no Android device or `adb` is available in this session.

### Finding status

| Finding / branch status | Local implementation and automated evidence | Physical Android / DEV retest status |
| --- | --- | --- |
| A-001 Places tabs (FIXED IN CODE; device confirmation OPEN) | Rechecked the nested Places Stack boundary and hidden parent tab entry; tab glyphs are now a consistent SVG set. Android export and source route checks are recorded with the build results below. | Physical Android retest required: exactly five tabs, Places routes remain nested, and Places Back/system Back return correctly. |
| A-002 document picker (dependency present; installed-client finding OPEN) | `expo-document-picker@57.0.2` is declared and installed; Android export checks the JS bundle. This cannot add a native module to an already installed development client. | Rebuild/install the Android development client, then open the document picker from a Supplier payment. |
| A-003 workspace restore (FIXED IN CODE; device retest OPEN) | Added latest-request guards for overlapping initial session snapshots, auth events, wedding restore, and membership refreshes. Vitest covers a stale initial snapshot, overlapping restores, superseded workspace reads, and retaining only the same account's previously verified membership. | Physical Android retest required: resume/sign in, exercise overlapping auth refreshes, then open Plan and Guests; confirm the Owner never sees “Wedding workspace unavailable.” |
| A-005 numeric Budget keyboard (CONFIG FIXED IN CODE; device retest OPEN) | Android config now uses `softwareKeyboardLayoutMode: resize`; typecheck and Android export validate the config/bundle. | Physical Android retest required with the numeric keyboard open on Budget amount fields; verify the focused input and entered value remain visible while scrolling. |
| A-006 nested Back controls (FIXED IN CODE; device retest OPEN) | Added or clarified visible Back actions across Guest, Entourage, Styling, Seating, Places, and existing nested task, Budget, Supplier, Website, and Run of Show screens. | Physical Android retest required for each nested route and Android system Back behavior. |
| A-007 Home system Back (FIXED IN CODE; device retest OPEN) | Auth success replaces the auth route with the root route; Android Home consumes hardware Back and exits instead of exposing Sign In. | Physical Android retest required: press system Back on authenticated Home, reopen the app, and confirm the signed-in Wedding returns. |
| A-008 Guest Pass (MIGRATION PREPARED; unresolved in DEV) | Local migration permits eligible Owner/Full Coordinator pass management in DRAFT Weddings while guest-facing lookup remains active-only. A draft Owner/ATTENDING Guest SQL regression case was added. | SQL test was not run and migration was not applied. Verify Owner issue/view/rotate for an ATTENDING Guest after the migration is applied in DEV. |
| A-009 Dress Code / Attire Group (FIXED IN CODE; database/DEV verification OPEN) | Dress Code and Motif saves now insert or update only allowed mutable fields instead of upserting `wedding_id`. Vitest covers Owner Dress Code create/update and dependent Attire Group creation; a database RLS assertion was added. | Automated app test passed. Database RLS test could not run locally; verify Dress Code save and Attire Group creation in the DEV app. |
| A-010 Supplier payments path (PATH CLARIFIED IN CODE; device retest OPEN) | Budget Item now names the Supplier Details and Payment Schedule path; the item row exposes “Supplier Details & Payments.” The finance model is unchanged. | Physical Android retest required: follow the path and confirm installments and payment actions are discoverable. |
| A-011 website Publish (MIGRATION PREPARED; unresolved in DEV) | Local migration row-locks the Wedding, authorizes lifecycle management, and atomically activates a DRAFT Wedding on confirmed Publish. The SQL regression checks ACTIVE/published state and the guest guide page. | SQL test was not run and migration was not applied. Verify Confirm Publish and the live guest page in DEV after authorized rollout. |
| Run of Show (UI FIXED; DRAFT POLICY PREPARED; SQL/DEV verification OPEN) | Draft Owners can manage operational timeline items; a visible “Add Operational Item” action is present in the Timeline heading and empty state. Guest Program remains separate. Vitest covers Draft role eligibility; database assertions cover timeline/dashboard visibility, Guest Program separation, check-in denial, and unauthorized roles. | SQL test was not run. Physical Android retest required: create an item and verify it appears on the timeline and Wedding-Day dashboard without creating a Guest Program entry. |
| Date selection (PICKERS IN PLACE; device timezone retest OPEN) | Supplier commitment date now uses the shared date picker. Wedding, task, installment, payment, Run of Show, and Guest Program date selections use native or browser calendar/date-time pickers; date-only values retain local calendar semantics. | Physical Android retest required for selection, saved value, validation, and timezone behavior. |
| Tab icon visual audit (UNRESOLVED visual comparison) | Matching Stitch screens were queried before the SVG change. Their screenshot/HTML payloads were inaccessible from this workspace; the exact limitation and intentional SVG adaptation are documented in `docs/ui/journey-a-navigation-icons.md`. | Unresolved visual comparison against the actual Stitch screens; automated checks do not verify glyph fidelity. |

### Pre-fix reproduction notes

| Findings | Reproduction evidence before the fix | Limit |
| --- | --- | --- |
| A-001 / A-002 | Existing Journey A physical QA records capture the extra Places tabs and the missing `ExpoDocumentPicker` native module. | This follow-up had no Android device; regression remains open. |
| A-003 | The out-of-order race is reproduced in the regression test: an initial session snapshot is invalidated by auth events, and a slower prior account restore cannot commit after a newer restore completes. | Automated concurrency reproduction; not an on-device reproduction. |
| A-005 / A-006 / A-007 / A-010 / date selection | Existing Android findings were traced to the numeric-field window resize setting, missing nested controls / auth history, the Budget-to-Supplier route, and the manually typed Supplier commitment date. | Source-level reproduction/audit only in this follow-up; on-device keyboard, Back, discoverability, and picker behavior remain open. |
| A-008 | The reported Owner/ATTENDING Guest denial matched the Guest Pass helper's active-only Wedding gate; the local SQL case now exercises an Owner issuing a pass for an ATTENDING Guest in a draft. | No remote probe or persistent DEV write in this follow-up; pgTAP not run locally. |
| A-009 | A rollback-only DEV Owner Dress Code save reproduced `42501 permission denied for table wedding_dress_codes`; the client upsert attempted an UPDATE including protected `wedding_id`. | No persistent DEV write; app mock test passes, database assertion not run locally. |
| A-011 | A rollback-only DEV Owner publish on a DRAFT Wedding reproduced `23514 Only an active Wedding may publish a website`; the publish function's active-only lifecycle check was the cause. | No persistent DEV write; migration and guest-page SQL regression not applied or run. |
| Run of Show | The supplied `1000033763.mp4` finding reports “All 0” and no visible creation action. Source inspection found DRAFT Owners failed the management check that gated both add actions. | The video file was not available in the workspace; model coverage is automated, device and SQL retests remain open. |
### Verification and limitations

- `npm.cmd test`: **PASS**, 46 files / 368 tests, including focused overlap, workspace, styling API, and Run of Show model tests.
- `npm.cmd run lint`: **PASS** after the final source changes (`npm.cmd run lint`).
- `npm.cmd run typecheck`: **PASS** after the final source changes (`npm.cmd run typecheck`).
- Android Expo export: **PASS** (`expo export --platform android`), output written to a task-specific temporary directory. `expo config --json` resolves `softwareKeyboardLayoutMode` as `resize`. The export is a JS bundle, not an installable APK or proof of native-module availability.
- SQL/pgTAP tests: **NOT RUN**. Docker and `psql` are not available. Deno is not available for Edge tests. No remote database change or fixture write was performed.
- Physical Android: **NOT RETESTED**. `adb` and a connected Android device are unavailable. Automated export does not verify IME layout, system Back, native document picker availability, or on-device navigation.
- `npm.cmd run build`: **PASS** after the final source changes (Expo web export and Next.js production build). `git diff --check`: **PASS** after the final QA edit.

**DEV-only handling:** work stayed on the local fix branch. No production environment, remote migration, deployment, merge, or persistent DEV write was used. A-008, A-011, and Run of Show migration behavior remain unverified in DEV until a separately authorized rollout and regression run.

Google Place photos remain deferred.