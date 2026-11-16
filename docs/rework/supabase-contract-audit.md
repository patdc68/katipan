# Supabase contract audit — R0

Read-only audit: 2026-11-16. Project-scoped MCP `get_project_url` confirmed `https://fslwqgfuzzgsshkotfpn.supabase.co`. Inspected catalog metadata/function definitions/grants, migration inventory and deployed Edge inventory; no application rows or token values queried and no mutation/rollback-write probe performed.

Repository base `ee79721` has 22 migrations; DEV reports the same 22 versions/names, ending `20260928124347_guest_program_google_place_id`. This proves migration-inventory agreement, not exhaustive byte-level schema/Edge equivalence. Catalog review found 59 public and 7 private tables, all with RLS enabled. Generated public types and relevant migrations/Edge handlers/tests were inspected; types were not regenerated. Snapshot migration `20261007144637_journey_a_draft_workspace_access.sql` exists only in `4c44a01`, is absent from DEV and this branch, and is not approved for adoption.

## Decision matrix

Exactly one X per row. KEEP preserves the current contract pending slice validation, not certification that every path is bug-free. CHANGE is a proposed audit/remediation decision requiring a separate contract proposal, not DDL authorization. DEPRECATE is conceptual/UI only where no separate schema exists. REMOVE is deliberately empty.

| Domain | Current table/function | KEEP | CHANGE | DEPRECATE | REMOVE | ADD | Reason | Owning agent (semantic; backend writer 02) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Core | profiles, weddings, wedding_memberships, wedding_partners, wedding_invitations; private.wedding_invitation_secrets; create/accept/role/lifecycle RPCs | X | | | | | Preserve membership and transactional client acceptance | 03 |
| Identity/Guests | wedding_people, guest_households, guests, guest_rsvps; create_guest, add_existing_person_as_guest, update_guest_person, set_guest_rsvp | X | | | | | Reuse identity; individual responses | 05; 03 partner linkage |
| Groups/allowances | entourage_roles/assignments, guest_groups/memberships, guest_allowances/claims, guest_household_rsvp_progress; delivery and claim/release RPCs | X | | | | | Grouping, delivery and RSVP independent | 05 |
| Tasks | task_categories, planning_tasks/assignees/dependencies; task RPCs | X | | | | | Preserve explicit dependency and assignment semantics | 04 |
| Places | wedding_places, wedding_place_purposes; Place RPCs; Google search/details Edge | X | | | | | Google identity separate from Wedding context and purposes | 04 |
| Styling | wedding_motifs, motif_colors/attachments, wedding_dress_codes, dress_code_*, attire_groups and related targets/colors/attachments, guest_attire_* | X | | | | | Fix client mutable-field use before changing grants; no Motif-to-Dress-Code conflation | 04 |
| Finance | suppliers, supplier_installments, supplier_payment_transactions, budget_categories/items, receipt/contract links; finance views and payment/commitment/reversal RPCs | X | | | | | Existing source separation and idempotent payment retry | 07 |
| Finance legacy | private.legacy_supplier_payments, private.legacy_payment_receipt_attachments | X | | | | | Preserve prior migration/recovery evidence; no cleanup authorized | 07 |
| Website | wedding_websites including template_key; public.website_template | X | | | | | Five existing website themes still used by client and Guide; not artwork records | 08 |
| Website sections | wedding_website_sections; website_access_mode, website_section_audience, website_section_type | X | | | | | Preserve sanitized audience/section presentation | 08 |
| Invitation authorization | private.household_website_tokens; issue_household_website_token, revoke_household_website_token, private.valid_household_website_token | X | | | | | Opaque hashed Household authorization; independent from artwork | 05 |
| Guest Guide | guest_wedding_guide and private base/projection helpers; guest-wedding-guide and guest-media Edge | X | | | | | Retain service-only sanitized assembly, Google hydration and domain projections | 08 with 04/05/06/09 |
| RSVP | guest_submit_rsvp; guest-rsvp Edge; web RSVP server handler | X | | | | | Service-only RPC verifies publication, lifecycle, token Household and Guest | 05 |
| Website lifecycle | publish_wedding_website / activate_wedding integration | | X | | | | Investigate explicit activate-then-publish versus atomic confirmation; current publish requires ACTIVE | 08 + 03 |
| Seating | seating_events/tables/seats/assignments; seat_guest, unseat_guest, delete_seating_table, visibility and CRUD RPCs | X | | | | | ATTENDING eligibility, locks, capacity/uniqueness and optional seats | 06 |
| Guest Pass | private.guest_passes; get/issue/revoke/rotate_guest_pass, guest_pass_lookup and Edge | X | | | | | Stable opaque individual identity independent of seating | 06 |
| Pass eligibility | private.can_manage_guest_pass lifecycle gate | | X | | | | ACTIVE-only in DEV; draft-management requirement needs explicit lifecycle decision | 06 + 03 |
| Attendance | guest_check_in_events, guest_check_in_state; wedding_day_check_in/reverse_check_in/dashboard; wedding-day-check-in Edge | X | | | | | Per-Guest history, client-event idempotency, no offline QR verification | 09 |
| Run of Show | wedding_day_items, wedding_day_item_memberships and current manager policies | | X | | | | Audit draft planning availability separately from active check-in gate | 09 + 03 |
| Guest Program | guest_program_items; set_guest_program_publication and review triggers | X | | | | | Explicit KEEP/UPDATE and publication remain | 09 |
| Attachments | attachments; reserve/confirm/delete and Storage policies | X | | | | | Shared private Storage and centralized metadata | 02; consumers 04/07/08 |
| Notifications | notifications, notification_devices, wedding_notification_preferences/category_preferences; private delivery outbox/push deliveries; worker RPCs/Edge | X | | | | | Preserve delivery infrastructure, idempotency and privacy | 02; presentation 04, session 03 |
| Native invitation artwork | Native template/artwork/typography/layout editor concepts; no separate artwork table found | | | X | | | Superseded by Canva; do not deprecate website templates | 08 |
| Canva connection | Proposed private.canva_connections (absent) | | | | | X | Server credential boundary; subject to security/schema design | 08 + 02 |
| Canva design link | Proposed wedding_canva_designs (absent) | | | | | X | Wedding-scoped external design metadata and Attachment reference | 08 + 02 |
| Canva server endpoints | OAuth start/callback/status/disconnect, design list/create/link/open/export and optional QR upload (absent) | | | | | X | Secure backend-only provider operations | 08 + 02 |

No REMOVE recommendation. No schema changes in R0. The three CHANGE rows require contract decisions; the WIP migration does not settle them.

## Specifically verified contracts

`wedding_websites` stores Wedding ID, slug, `template_key`, publication timestamps, access mode, title and introduction. `website_template` remains SAMPAGUITA, LUNTIAN, FILIPINIANA, MODERN_LOVE, AFTER_DARK. Sections store section key/type/order/audience/enabled/content. These are website presentation, not an invitation artwork engine. Current column grants permit mutable presentation fields, not arbitrary Wedding reassignment.

`private.household_website_tokens` stores Wedding/Household IDs, token hash, creation/expiry/revocation. Keep token issue/revoke semantics with Agent 05. `guest_submit_rsvp` and `guest_wedding_guide` have service_role execute access, not anon/authenticated grants. RSVP verifies published active Wedding and authorized Household before updating an existing individual response. Public routes must retain the narrow server/Edge boundary and safe errors.

`guest_wedding_guide` composes published Guest Program, allowed attire/media, seating visibility and named eligible Pass projection through existing private helpers. The final Google Place ID migration supports authorized Edge hydration. General Guide parsing discards QR/response/private fields; the dedicated Pass page receives its separate projection. Changes need each contributing domain's review.

`seat_guest` locks the RSVP row, requires ATTENDING, validates same-Wedding table and uses one existing assignment or creates one. Existing constraints/triggers cover event/seat/capacity consistency; re-run concurrency tests before changes. Pass table has both `qr_token` and `token_hash`: **not hash-only**. Plain retrievable QR is currently private for stable re-display. Agent 02/06 must assess retention/encryption and grant boundaries without rotating passes or removing re-display silently. `issue_guest_pass` and `guest_pass_lookup` are authenticated RPCs; management helper currently requires ACTIVE.

`wedding_day_check_in` accepts exactly Guest ID or QR token; validates opaque token, Wedding, revocation and RSVP; locks Guest response; uses client_event_id for replay and returns ALREADY_CHECKED_IN for an existing attendance state. Household selection is manual only. Reversal appends history. Offline source is OFFLINE_SYNC for queued manual events, not proof of offline QR verification.

`set_guest_program_publication` requires explicit KEEP or UPDATE; KEEP only resolves a pending review with publication/times unchanged, UPDATE requires guest start time. Operational changes remain separate from published schedule. `publish_wedding_website` locks Wedding and currently rejects publication unless guest access allows an ACTIVE Wedding. Do not mask lifecycle failure as transport failure.

## Deployed Edge inventory

All ten listed ACTIVE: google-places-search, google-place-details (04); guest-wedding-guide, guest-media (08); guest-rsvp (05); guest-pass-lookup (06); wedding-day-check-in (09); delete-wedding, delete-account (03); notification-worker (02 infrastructure). Backend technical writer is 02 throughout. Guide/RSVP/media intentionally accept guest requests with gateway verify_jwt=false and enforce token/publication within their narrow server boundary; this is not authorization to expose raw tables. Deployed source hashes were not fully compared; per-slice audit must check relevant deployed source.

## Advisors and unresolved review

Live security advisors returned five INFO [RLS-enabled private tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), 53 WARN [authenticated-callable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and one WARN [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance returned 91 INFO [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

These are open audit dispositions, not proof of exploit or permission to bulk revoke/drop. Private no-policy tables appear intentionally restricted behind functions; verify grants and narrow callers individually. For each security-definer function verify auth/capability, fixed search_path, object/Wedding binding and execute grants. Agent 02/03 must resolve Auth protection configuration before release. Unused indexes in lightly exercised DEV do not justify deletion. No advisors were changed. R1 must audit relevant core warnings; each later slice covers its functions; R8 requires recorded disposition for all warnings.

## R1 Core Workspace audit — Agent 02 (read-only, 2026-11-16)

Project-scoped Supabase MCP confirmed application URL `https://fslwqgfuzzgsshkotfpn.supabase.co` (project `fslwqgfuzzgsshkotfpn`). The audit queried catalog metadata, function definitions/grants, policies, migration inventory, advisors, and deployed deletion Edge code. No application rows, account emails, invitation tokens, or token digests were selected; no SQL/DEV mutation or write probe was run.

Repository migrations and DEV inventory match exactly: 22 versions/names, latest `20260928124347_guest_program_google_place_id`. Inspected core table columns/enums and generated public types align, including Wedding lifecycle/ownership fields, nullable membership `user_id` and roles/statuses, partner linkage, person contact fields, invitation metadata, and RPC inputs/returns. `private.wedding_invitation_secrets` remains outside public generated types. No R1 migration or type regeneration is required.

### Core Workspace decision matrix

| Contract | KEEP | CHANGE | ADD | DEPRECATE | REMOVE | Evidence / rationale |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| Auth principal and optional profile linkage | X | | | | | `profiles.id` references `auth.users.id`; RLS limits writes to the caller. Profile is optional presentation data, not session or authorization authority. |
| Wedding identity, origin, lifecycle, and ownership mode | X | | | | | Live enums and constraints match migrations/types. Wedding lifecycle states are distinct from membership status. |
| Membership identity, role, and status | X | | | | | Unique `(wedding_id,user_id)` membership; roles remain OWNER/FULL_COORDINATOR/DAY_OF_COORDINATOR/GUEST_COORDINATOR. Direct client access is read-only and RLS-scoped. |
| Partner/person account linkage | X | | | | | Same-Wedding FK and unique linked-user index prevent duplicate account linkage within one Wedding. Acceptance links an existing Person. |
| Partner and Coordinator invitations | X | | | | | Random opaque tokens are returned at issuance; only SHA-256 digests are stored privately. Acceptance locks and validates relevant Wedding/person/invitation rows. |
| Core RLS and authenticated RPC grants | X | | | | | Core rows are not directly writable by authenticated clients. SECURITY DEFINER RPCs are granted to `authenticated`, denied to `anon`, and enforce caller/role/token/lifecycle checks. |
| Account deletion preparation | X | | | | | Preparation protects final Owner/controller, marks memberships LEFT, detaches the account from the existing Person without deleting it, then supports Auth soft deletion. |
| Workspace restore reads | X | | | | | Existing membership/Wedding/Partner read contract supports authoritative client restore and membership revalidation; no backend contract change is needed. |

No CHANGE, ADD, DEPRECATE, or REMOVE decision is required for R1 backend contracts. Existing R0 CHANGE rows for other domains are separate and do not authorize R1 changes.

### Verified lifecycle and invitation behavior

- `private.has_active_wedding_membership(uuid)` checks `auth.uid()`, the same `wedding_id`, and `membership.status = 'ACTIVE'`; it does **not** filter on `weddings.status`. The Wedding, Person, Partner, and Membership SELECT policies use this helper. A valid OWNER membership on a DRAFT Wedding is visible and remains membership. A feature lifecycle restriction must not be converted into a no-membership/unavailable result.
- The deferrable active-Owner invariant applies to an `ACTIVE`, `COUPLE_OWNED` Wedding. Coordinator-managed controller invariants are separate. Changing Wedding status does not change `wedding_memberships.status`.
- `create_couple_wedding` atomically creates a DRAFT/COUPLE_OWNED Wedding, links the signed-in Auth user to partner 1, and creates an ACTIVE OWNER membership. `create_coordinator_managed_wedding` atomically creates a DRAFT/COORDINATOR_MANAGED Wedding, the creator's ACTIVE FULL_COORDINATOR membership, and two existing but unlinked partner people.
- `issue_partner_owner_invitation` requires Owner or active creating-Full-Coordinator authority and targets an existing same-Wedding Partner. The invitation lifecycle trigger allows DRAFT/ACTIVE and rejects archived or deletion-pending Weddings. `accept_wedding_invitation` locks the Wedding, invitation, secret, Person, and Partner; requires an authenticated caller; checks digest/expiry and confirmed email when bound; rejects a different linked account or a second Person for the same account; links the existing Person; creates/reactivates the person's OWNER membership; and changes coordinator-managed ownership to couple-owned on first client join. The coordinator remains FULL_COORDINATOR. The other partner accepts separately. The lifecycle trigger also prevents acceptance after archive/deletion is requested.
- Coordinator invitation acceptance allows DRAFT/ACTIVE only, rejects deletion-pending Weddings, permits only coordinator roles, and rejects an account linked to a Partner so the Owner workflow remains canonical.
- Core SELECT policies are `authenticated` only. Wedding updates are limited to specified mutable columns and Owner/Full Coordinator roles. Person/Partner/Membership direct writes are closed. Invitation SELECT is manager-scoped. `private.wedding_invitation_secrets` has RLS enabled without public client policies/grants; digest access stays in narrowly granted RPCs.
- Live `delete-account` Edge Function is ACTIVE with `verify_jwt=true`. Its deployed shared lifecycle handler validates the caller with Auth, invokes `prepare_self_account_deletion`, then soft-deletes the Auth user through its server-side service credential. Client session/workspace cache invalidation remains Agent 03 behavior.

Existing database regressions include `supabase/tests/database/core_weddings_people_memberships.test.sql`, `supabase/tests/database/ownership_client_invitation_workflows.test.sql`, and `supabase/tests/database/wedding_lifecycle_settings.test.sql`. They cover role/RLS visibility, DRAFT lifecycle, first-client ownership transition, independent second-partner acceptance, and person-identity preservation. These suites were inspected, not run against DEV; write probes were not authorized during this audit.

### Live advisor findings relevant to R1

Live security advisors returned five INFO `rls_enabled_no_policy` findings for private tables, including `private.wedding_invitation_secrets`; this is consistent with private digest storage behind RPCs. They also returned 53 WARN `authenticated_security_definer_function_executable` findings; core examples include create/issue/accept invitation and membership/lifecycle RPCs. The inspected core routines use `SET search_path = ''`; are granted to `authenticated`, not `anon`; and derive the caller from `auth.uid()` with membership, role, token, or lifecycle checks. Do not mass-revoke these intentionally callable routines; review each warning and actual caller individually.

Auth advisors report leaked-password protection disabled (one WARN). This is an Auth project setting, not a schema/type gap, and remains an open security-setting disposition before release. Performance advisors report 91 INFO unused indexes, including core Wedding/membership indexes; DEV workload is not evidence to drop them. Health advisors returned no lints. No advisor remediation or remote setting change was made during this read-only audit.

**Agent 02 handoff:** R1 can proceed to Agent 01 and then Agent 03 without a backend migration. Preserve current contracts. Use `wedding_memberships.status = ACTIVE` as membership authority independently of Wedding lifecycle; treat query failure as recoverable/error and an authoritative no-membership result as membership loss. Any later schema/RPC change returns to Agent 00 as a separately authorized proposal.

## Forward-only migration strategy (future authorization required)

Keep website templates/columns and old clients working. First inventory actual consumers and define additive Canva metadata/secret boundaries. Propose server-only connection storage and Wedding-scoped design references with constraints, indexes, RLS/grants in the same change, then typed server contracts and compatibility tests. Do not add a second RSVP/Guest/attendance store. If native artwork-only fields are later found, stop new writes only after replacement acceptance; retain reads/data during a measured compatibility period. Drops require separate approval and proven recovery; none is proposed now.

For every proposal, record insufficiency, affected domain, forward-only plan, compatibility, RLS/grant impact, generated-type impact, DEV validation and rollback/recovery. Recover by disabling the new integration and retaining old website rendering, not destructive reset. Credentials and optional assets follow [Canva architecture](canva-integration.md). Refresh this audit before authorized schema work; the [Supabase changelog](https://supabase.com/changelog.md) was consulted, with no dependency/CLI upgrade in R0.
