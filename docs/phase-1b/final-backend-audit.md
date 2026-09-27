# Final Phase 1B backend completeness audit

**Date:** 2026-09-27

**DEV project:** `fslwqgfuzzgsshkotfpn`

**Baseline:** `master` at `3998daba66f98a31b2b69a5afc93dad97e51c814`
**Verdict: READY FOR V1 UI DEVELOPMENT**

This is an audit of the approved V1 backend contract, not a production launch approval. No implementation, migration, Edge Function, or persistent DEV data was changed. Database tests ran in transactions ending in `ROLLBACK`.

Classification used below: **COMPLETE** means an implemented V1 backend contract; **PARTIAL** and **MISSING** would denote unfinished backend behavior (none remain); **UI-ONLY** means application presentation or interaction work; **DEPLOYMENT PREREQUISITE** means external environment or provider setup; **POST-V1** is excluded scope.

## Pre-flight and validation

| Check | Result |
| --- | --- |
| Latest `master` and clean checkout | `git fetch origin master --prune` succeeded; `HEAD`, `origin/master`, and `FETCH_HEAD` were the same commit; working tree was clean. Audit branch: `chore/phase-1b-final-audit`. |
| Repository migrations versus DEV | All 19 migration versions and names match DEV in order, from `20260924044417_security_baseline` through `20260926180000_notification_delivery`. No remote-only or missing repository migration appears in history. This checks migration history and resulting schema, not a byte-level checksum of previously applied SQL. |
| Generated types | DEV-generated TypeScript types match `packages/database/src/database.types.ts` after line-ending and trailing-whitespace normalization. |
| Edge deployment | All 10 expected functions are `ACTIVE`: `google-places-search`, `google-place-details`, `guest-wedding-guide`, `guest-rsvp`, `guest-media`, `guest-pass-lookup`, `wedding-day-check-in`, `delete-wedding`, `delete-account`, and `notification-worker`. Retrieved deployed entrypoints and shared source match the repository after line-ending normalization. Older deployed `deno.json` task lists differ from the current combined task list; runtime imports and compiler options match. |
| Advisors | DEV Security and Performance Advisors checked. Security: five informational private tables with RLS and no client policy; 53 warnings for authenticated-callable `SECURITY DEFINER` RPCs. Performance: 24 informational unused indexes. [RLS no-policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [unused-index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). |
| Repository validation | `npm run lint`, `npm run typecheck`, `npm test` (one Vitest test), and `npm run build` passed. `npx --yes deno task check` passed; `npx --yes deno task test` passed 29/29 Edge tests. All 18 checked-in post-migration database test files executed through project-scoped MCP without SQL errors, each ending in `ROLLBACK`. The pre-F5 finance migration fixture requires an old schema and was not rerun against current DEV. |
| Hygiene | `git diff --check` passed. A tracked-file scan for Supabase secret, Google key, GitHub token, and private-key patterns found no matches. Only `.env.example` is tracked among environment files. Provider secrets and live delivery were not inspected. |

No Docker, Podman, temporary Supabase branch, or DEV reset was used.

## Original blockers F1–F9

| Original finding | Current status | Re-evaluation |
| --- | --- | --- |
| **F1 Wedding/account lifecycle** | **COMPLETE** | `activate_wedding`, `complete_wedding`, `archive_wedding`, and `restore_wedding` enforce authorized, locked status transitions. `leave_wedding` and `remove_wedding_member` remain distinct. `delete-wedding` uses confirmed, retryable deletion: a nonce seals the Wedding, Storage objects are removed, and the database finalizer checks for remaining objects. `delete-account` prepares memberships and people links, then Auth Admin soft-deletes the caller. Wedding deletion does not delete Auth users. Final active OWNER and coordinator-managed controller guards are tested. See `20260925135601_wedding_lifecycle_settings.sql` and `wedding-lifecycle-settings.md`. |
| **F2 Wedding settings/privacy semantics** | **COMPLETE** | `weddings.status` owns operational state; website publication/access, section audience, seating visibility, and notification preferences each retain one authoritative owner. Guest access, invitation issuance, publishing, and notification production are status-gated. A generic settings/privacy table would duplicate these sources. |
| **F3 Coordinator onboarding/role management** | **COMPLETE** | Coordinator invitations issue random, hashed, expiring tokens; acceptance and non-owner role changes are locked, Wedding-scoped operations. OWNER remains distinct from FULL_COORDINATOR. Partner acceptance still links the existing Wedding Person and preserves the Wedding and planning data. See `20260925143928_coordinator_team_finance_access.sql`. |
| **F4 Website/RSVP lifecycle guards** | **COMPLETE** | The shared active-Wedding predicate gates guide, RSVP, publication, Household tokens, and notifications. RSVP still requires a valid Household token and individual Guest identity. Non-active Weddings cannot publish or accept guest mutations; archived data remains restorable. |
| **F5 Finance source of truth** | **COMPLETE** | Budget allocation/manual non-supplier actuals, supplier commitment, installment schedule, and append-only payment/reversal transactions are distinct. Invoker views derive balances and count each actual supplier transaction once. Supplier-linked editable `budget_items.actual_amount` is disallowed; ambiguous old values and legacy rows are retained privately for audit. See `20260926131600_finance_source_of_truth.sql` and `finance-source-of-truth.md`. |
| **F6 Guest Program and schedule review** | **COMPLETE** | `guest_program_items` is separate from operational `wedding_day_items`. Operational changes mark linked guest items for explicit review without changing published times or cascading later items. An authorized publication RPC records KEEP/UPDATE review and confirmation. Published items reach the sanitized Guest Guide. See `20260926140232_guest_program_media.sql`. |
| **F7 Notification production/delivery** | **COMPLETE** backend; **DEPLOYMENT PREREQUISITE** for external delivery | Domain triggers and a daily payment-due producer create idempotent Wedding notifications. Preferences, membership, lifecycle, quiet hours, claim/finish, device registration, email and Expo dispatch, retry handling, and receipt checks are implemented. `notification-worker` is deployed and service-credential guarded. Resend configuration, mobile push credentials, and a scheduler remain external setup, not missing architecture. See `20260926180000_notification_delivery.sql` and `notification-delivery.md`. |
| **F8 Guest attire/media delivery** | **COMPLETE** | The token-scoped guide resolves general, group/role, and individual attire and colors without returning internal Guest or Attachment rows. `guest-media` authorizes a same-Wedding, eligible `GUEST_VISIBLE` Attachment and returns a 60-second private-bucket signed URL with no-store response headers. No signed URL is persisted. See `20260926140232_guest_program_media.sql` and `guest-program-media.md`. |
| **F9 Finance least privilege/security hardening** | **COMPLETE** | Finance RLS and invoker aggregates use `can_manage_wedding_finances`: OWNER, FULL_COORDINATOR, or valid temporary controller. DAY_OF_COORDINATOR, GUEST_COORDINATOR, unrelated users, and anon are denied. `private.wedding_invitation_secrets` now has RLS with no client policy. The 53 callable definer warnings are an intentional RPC audit surface, not proof of exposure: no public/private function is anon-executable, all 53 have locked empty `search_path`, and catalog scans found caller or delegated authorization references in their definitions. High-risk paths and role tests were reviewed; keep a per-function grant review as maintenance. |

## Complete V1 backend flow

| Flow stage | Classification | Backend contract / remaining application work |
| --- | --- | --- |
| Account → Wedding | **COMPLETE** | Auth-backed profiles, couple and coordinator-created Wedding operations, membership roles, and OWNER invariant. Account creation/sign-in screens are **UI-ONLY**. |
| Partner/Coordinator Collaboration | **COMPLETE** | Existing Person linkage for partner joining, secure invitations, independent partner acceptance, and coordinator role lifecycle. |
| Planning → Places | **COMPLETE** | Task assignment/dependencies and operational timeline; independent ceremony style/place type and many-to-many place purposes. Google Places server proxy is deployed; the external API key is a deployment prerequisite for live search. |
| Budget/Suppliers | **COMPLETE** | Four finance sources, transaction/reversal ledger, constrained evidence links, role-limited aggregates. No payment processing. |
| Guests/RSVP | **COMPLETE** | One real Person record, individual Guest responses, derived Household progress, invitation delivery separate from RSVP, entourage reuse, token-only guest RSVP. |
| Attire | **COMPLETE** | Dress Code, motif, groups, effective guest guidance and eligible media projections. |
| Website/Guest Guide | **COMPLETE** backend; **UI-ONLY** route/rendering | Slug, access, section audience, publication and sanitized projections are present. The canonical Next.js `/w/{slug}` route and template rendering are application work. Public visitors cannot RSVP. |
| Seating | **COMPLETE** | Event → Table → assignment → Guest, optional exact seat, attendance pool/capacity, unique active assignment, independent visibility. Household split warning is **UI-ONLY**. |
| Guest Pass | **COMPLETE** | Random opaque QR secret, separate readable reference, revocation/rotation, controlled lookup, no seating dependency. |
| Wedding Day | **COMPLETE** | Individual append-only check-in/reversal, duplicate and client-event idempotency guards, Household batch as individual events, cached-roster/manual offline reconciliation. Offline opaque QR verification is not claimed. |
| Notifications | **COMPLETE** backend; **DEPLOYMENT PREREQUISITE** for live channels | Inbox production, preference checks, outbox, device destinations and worker exist. Live email/push needs provider setup below. |
| Archive/Delete | **COMPLETE** | Reversible archive/restore, distinct confirmed Wedding deletion and separate account soft deletion with final-controller safeguards. |

## Boundary and integrity checks

- **Ownership and role scope:** Deferred active OWNER constraint and lifecycle/departure guards protect couple-owned Weddings. Coordinator-managed Weddings keep their original controller until a client independently accepts ownership; a Full Coordinator does not gain Owner deletion rights on a couple-owned Wedding. Role tests cover Owner, coordinator levels, and unauthorized callers.
- **Cross-Wedding isolation:** Wedding-scoped RLS helpers, composite same-Wedding foreign keys, role-limited finance views, and database test cases cover unrelated member and cross-Wedding references. Current DEV has no active couple-owned Wedding data, so behavioral evidence comes from rollback fixtures rather than production-like rows.
- **Guest/anon boundary:** All 59 public and seven private application tables have RLS. Anon has no table or application-function privileges. Six public views use `security_invoker=true`; all public UPDATE policies inspected have both USING and WITH CHECK. Guest web functions are service-only behind token-validating Edge boundaries. The guest list is not a public raw projection.
- **Storage privacy:** `wedding-files` is private. Storage object policies are authenticated and resolve reserved/available Wedding Attachment metadata; controlled guest media signs only authorized eligible objects. Attachment metadata is centralized and durable identity is bucket plus path.
- **Lifecycle and destruction:** Status guards close guest access and new notification production outside ACTIVE. Wedding deletion requires exact-name confirmation, a locked nonce, Storage cleanup, and final object absence. Account deletion uses the Auth caller, guards last ownership/control, and preserves historical Wedding records.
- **Definer authorization:** No anon-executable public/private application functions were found. The 53 authenticated-callable public definer functions all have empty `search_path` and an apparent caller/capability delegation in their definitions; sensitive lifecycle, invitation, finance, guest token, and worker paths were checked against migration code and role tests. The advisor count remains a review inventory, not a blocking finding by itself.
- **One source of truth:** Guest Person identity, Household grouping, individual RSVP/pass/check-in, Wedding-owned website and seating settings, separate operational and guest schedules, and the four finance source records remain distinct. No client code has a service-role key.

## 1. Blocking backend gaps

**None found in the approved V1 contract.** F1–F9 have repository migrations, deployed DEV state where applicable, authorization boundaries, and regression coverage. The verdict does not claim external delivery or a completed UI.

## 2. Non-blocking backend improvements

- Keep a signature-by-signature grant and caller-check inventory for the 53 intentional authenticated definer RPCs as they change. The current advisor warning is broad and did not reveal an anon grant or missing locked `search_path`.
- Revisit the 24 informational unused indexes after realistic data and query plans exist; empty DEV traffic is not a sound reason to drop constraint-supporting indexes.
- Add operational rate limits and observability for public token endpoints and Google Places before production traffic. This is defense in depth alongside existing opaque tokens and authorization.
- Run the preserved pre-F5 finance migration fixture in a disposable pre-F5 environment when migration replay is next exercised; it cannot be meaningfully run on the current post-F5 DEV schema.

## 3. DEPLOYMENT PREREQUISITES

- Configure and verify a Resend sending domain, `RESEND_API_KEY`, and `NOTIFICATION_FROM_EMAIL` in server-side Edge secrets; then perform live mailbox delivery checks.
- Configure an EAS project ID and APNs/FCM credentials for native builds; wire the existing device-registration helper after mobile sign-in and verify delivery on physical devices.
- Invoke `notification-worker` from an authenticated server-side scheduler, at least daily and preferably more frequently. DEV has neither `pg_cron` nor `pg_net` installed; scheduler credentials must stay server-side or in Vault, not migrations or public clients.
- Set production Supabase URLs and publishable keys for Expo/Next clients, server-held service credentials for privileged Edge paths, allowed Auth redirects/origins, and `GOOGLE_PLACES_API_KEY` for live Places search. Verify each environment rather than assuming DEV secrets are production-ready.
- Run end-to-end provider, signed-media, and destructive-operation smoke checks in the configured production-like environment before launch. These are deployment verification, not missing backend contracts.

## 4. Post-V1 items

Supplier marketplace/reviews, advanced floor plans, AI seating/motif, Canva, custom domains, video invitations, native group chat, honeymoon, registry, agency CRM, payroll/leads, white labeling, radio/headset workflows, payment processing, and alternative Storage providers remain **POST-V1** under `AGENTS.md`.

## 5. Exact recommendation for the next development phase

**Start V1 UI development now.** Build authenticated account/Wedding and collaboration flows first, then planning/places/finance/guests, then the canonical `/w/{slug}` Guest Guide and RSVP, followed by seating, passes, Wedding Day, and notifications. Bind screens to the existing generated types and authorized RPC/Edge contracts; keep provider credential and scheduler setup on the deployment track. Preserve the backend distinction among Leave, Remove, Archive, Delete Wedding, and Delete Account in the UI.

**Final verdict: READY FOR V1 UI DEVELOPMENT.**
