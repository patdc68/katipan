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

## Forward-only migration strategy (future authorization required)

Keep website templates/columns and old clients working. First inventory actual consumers and define additive Canva metadata/secret boundaries. Propose server-only connection storage and Wedding-scoped design references with constraints, indexes, RLS/grants in the same change, then typed server contracts and compatibility tests. Do not add a second RSVP/Guest/attendance store. If native artwork-only fields are later found, stop new writes only after replacement acceptance; retain reads/data during a measured compatibility period. Drops require separate approval and proven recovery; none is proposed now.

For every proposal, record insufficiency, affected domain, forward-only plan, compatibility, RLS/grant impact, generated-type impact, DEV validation and rollback/recovery. Recover by disabling the new integration and retaining old website rendering, not destructive reset. Credentials and optional assets follow [Canva architecture](canva-integration.md). Refresh this audit before authorized schema work; the [Supabase changelog](https://supabase.com/changelog.md) was consulted, with no dependency/CLI upgrade in R0.
