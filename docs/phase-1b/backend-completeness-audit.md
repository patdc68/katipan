# Phase 1B backend completeness audit

**DEV project:** `fslwqgfuzzgsshkotfpn`

**Baseline:** `master` at `afa7352b5747c35e0a141f9c194002fe636497cd`, 2026-09-25

**Scope:** Audit only. No migration, Edge Function, or DEV change was made.

## Pre-flight and evidence

- Working tree was clean. Remote `refs/heads/master` and local `master` had the same commit. Local tracking branch was also at that commit.
- All 14 repository migrations, from `20260924044417_security_baseline` through `20260925130214_notifications_preferences`, appear in the DEV migration history in the same order.
- `packages/database/src/database.types.ts` matched types generated from DEV after line ending and trailing whitespace normalization.
- DEV security and performance advisors were checked. Security: three informational private tables with RLS and no policies, plus 43 warnings for authenticated callable `SECURITY DEFINER` functions. Performance: 30 informational unused indexes. The definer warnings require per-function authorization review; they do not alone prove a vulnerability. The unused-index findings are premature on an empty DEV database.
- DEV has 60 tables and five views in `public`/`private`. Every `public` table has RLS. Live privilege inspection found **no anon table read/write privilege and no anon function execute privilege** on these objects. The five public views use `security_invoker = true`. `private.wedding_invitation_secrets` has RLS off but neither `anon` nor `authenticated` has table privileges, and `private` is not in the exposed API schemas. This is a defense-in-depth hardening item, not evidence of current anonymous exposure; the table inventory warning overstates its exposure.
- The six expected Edge Functions are active in DEV: Google Places search/details, guest guide/RSVP, Guest Pass lookup, and Wedding-Day check-in. The repository has matching source and unit tests. This audit did not compare deployed bundle bytes with local source.
- Reviewed `AGENTS.md`, the KATIPAN Supabase skill, all migration and database-test files, Edge Function source/tests, generated types, storage helper, package configuration, and Expo/Next app structure. The apps are foundation screens, so UI behavior cannot be used as evidence of backend completeness.

### Required invariant checks

| Check | Result |
| --- | --- |
| Leave, Remove, Archive, Delete Wedding and Delete Account are distinct | Leave and Remove are distinct and implemented. Archive, Delete Wedding and Delete Account are separate concepts but lack workflows (F1). |
| Archived Weddings are restorable | **No** authorized archive/restore transition exists (F1). |
| Deleting a Wedding never deletes its User | **Yes at the FK level:** Wedding children cascade, while `weddings.created_by_user_id` points to `auth.users` and deleting a Wedding does not cascade upward. The safe application deletion workflow is still missing (F1). |
| Active couple-owned Wedding retains an active OWNER | **Yes:** deferred constraint trigger plus leave/remove guards. |
| Guest list remains private; public RSVP is impossible | **Yes for current access paths:** no anon raw-table grants; public guide has no guest-list projection; RSVP requires a valid Household token through the Edge boundary. Archived-state RSVP remains a lifecycle defect (F4). |
| Website access and seating visibility use Wedding-owned sources | **Yes:** `wedding_websites.access_mode` and `seating_events.visibility`, both keyed to a Wedding. |
| No raw private table is exposed to anon | **Yes in live grants and API schema configuration.** The unexposed invitation-secret table should still gain RLS (F9). |
| No critical V1 capability is assumed future work | **No:** F1–F8 are concrete missing or incomplete V1 paths. |

## Capability classification

| V1 capability | Status | Evidence / finding |
| --- | --- | --- |
| Wedding and profile metadata | PARTIAL | Basic names, date, timezone, location, guest estimate, ceremony style, currency, partners and profile display name exist; lifecycle/settings need defined boundaries (F1, F2). |
| Wedding membership authorization and final OWNER safeguard | COMPLETE | Membership roles/status, wedding-scoped RLS helpers, deferred active couple-owned OWNER invariant, and role tests exist. |
| Coordinator-managed creation and couple ownership transition | COMPLETE | Coordinator creates client people without accounts; partner invitation acceptance links the existing person, preserves Wedding ID and data, creates OWNER, and retains coordinator as FULL_COORDINATOR. |
| Leave Wedding and Remove Member | COMPLETE | Separate locked RPCs record `LEFT` or `REMOVED`; final OWNER and coordinator-managed controller protections exist. |
| Adding non-owner coordinators / role lifecycle | MISSING | No coordinator-role invitation/acceptance or role change operation (F3). |
| Archive, restore, completion, and Wedding deletion | MISSING | Status enum exists, but no authorized lifecycle operations (F1). |
| Delete Account | MISSING | Auth deletion is separate from Wedding deletion, but no self-service safe account-deletion workflow (F1). |
| Wedding privacy and settings | PARTIAL | Website access is stored per Wedding; broader Wedding settings/privacy source and policy are undefined (F2). |
| Website publishing, slug, access, section audience | PARTIAL | Core publishing and guest projection work; archived-state RSVP and guest presentation gaps remain (F4, F8). |
| Canonical `/w/{slug}` route and template rendering | UI-ONLY / no additional backend required | Slug and presentation-only template key exist; Next.js route/rendering are application work. |
| Guests, Households, RSVP, allowances, entourage | COMPLETE | Canonical person reuse, per-Guest RSVP, derived Household progress, invitation delivery state, allowances and assignments are modeled and tested. |
| Places and Google Places | COMPLETE | Many-to-many purpose model, independent ceremony style/place type, authorized server-side Google key and transient Google DTOs exist. |
| Attachments and Storage metadata | PARTIAL | Private bucket and centralized metadata work; controlled guest delivery for website media is missing (F8). |
| Suppliers, Budget, installments and payments | PARTIAL | Supplier, allocation and scheduled payment records exist, but commitment and actual transaction are conflated (F5). |
| Motif, Dress Code and Attire | PARTIAL | Management schema is extensive; guest guide omits important guidance and image projections (F8). |
| Planning Tasks | COMPLETE | Categories, tasks, assignees, status, acyclic dependencies and role checks exist. |
| Seating | COMPLETE | Wedding-owned events, tables, optional seats, one assignment per Guest/event, capacity/RSVP enforcement and per-event guest visibility exist. |
| Household split warning | UI-ONLY / no additional backend required | Separate Guest assignments permit a split; warning can be derived from household/table assignments. |
| Guest Pass | COMPLETE | Opaque random QR, separate reference, private pass history, revocation/rotation, authorized lookup and no seating dependency exist. Recoverable raw QR is kept only in the unexposed private table so a pass can be retrieved. |
| Wedding-Day Check-In and offline reconciliation | COMPLETE | Individual append-only events, duplicate protection, reversals, client event IDs, manual offline sync and household batch handling exist. Offline QR verification is not claimed. |
| Operational Run of Show | PARTIAL | Operational items and dashboard exist; explicit delay review and guest-facing publication confirmation do not (F6). |
| Guest Program | MISSING | No separate guest-facing schedule model or projection (F6). |
| Notifications and preferences | PARTIAL | Per-Wedding/category preferences, inbox, quiet hours and delivery outbox exist; automatic producers and worker are absent (F7). |
| Coordinator portfolio backend | UI-ONLY / no additional backend required | Existing membership-scoped Wedding queries support a coordinator's client list; agency CRM/lead pipeline are out of scope. Team onboarding and lifecycle gaps still affect portfolio actions (F1, F3). |
| Guest-facing security boundary | PARTIAL | No raw anon access, sanitized token-based guide and private RSVP are in place; finance least-privilege and archived-state guards need attention (F4, F9). |
| Marketplace, AI seating/motif, advanced floor plan, custom domains, video invitations, chat, honeymoon, registry, agency CRM, payroll, lead pipeline, white label, radio/headset, payment processing, alternative storage | POST-V1 | Explicitly excluded by `AGENTS.md`. |

## Detailed gaps

### F1 — Wedding and account lifecycle — **MISSING; blocks UI**

**Exact gap:** `public.wedding_status` declares `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVED`, but there are no archive, restore, completion or Wedding-deletion RPCs, nor an account-deletion workflow. The `public.weddings` UPDATE grant excludes `status`, and authenticated users have no Wedding DELETE grant. A service-role hard delete would cascade Wedding domain rows; it would **not** delete `auth.users` because Wedding-to-user references point outward. Existing `leave_wedding` and `remove_wedding_member` only end memberships. Archived Weddings cannot currently be archived or restored by the app.

**Affected:** `public.weddings`, `public.wedding_memberships`, `public.wedding_websites`, child-table cascade FKs, `auth.users`; `create_*_wedding`, `leave_wedding`, `remove_wedding_member` in `20260924062451_core_weddings_people_memberships.sql` and `20260924073949_ownership_client_invitation_workflows.sql`.

**Impact:** UI would otherwise confuse leaving/removing with archive/delete, or require a service key. A live Wedding can be left without a controlled retention, restore or deletion path. Account removal needs a policy for final ownership and retained Wedding data.

**Recommended implementation:** Add separate transaction-safe Owner-only Wedding status transitions (including restore), explicit permanent Wedding deletion with retention/storage cleanup and confirmation boundary, and separate account deletion/orchestration. Lock Wedding and membership rows; preserve the active couple-owned OWNER invariant; define coordinator-managed deletion authority; suppress guest access and notifications while archived; test restoration and that Wedding deletion never removes the User. Keep `Leave Wedding != Remove Member != Archive Wedding != Delete Wedding != Delete Account` in API and tests.

### F2 — Wedding privacy/settings — **PARTIAL; blocks settings UI**

**Exact gap:** `public.weddings` has basic profile fields and `public.wedding_websites.access_mode` is the single site access source. No separate Wedding-level privacy/settings record or explicit status-dependent behavior is defined for guest access, member operations, notifications and completion/archive. This is more than a missing form: settings controls would have no authoritative backend semantics.

**Affected:** `public.weddings`, `public.wedding_websites`, `public.guest_wedding_guide`, `public.guest_submit_rsvp`, notification/outbox functions.

**Impact:** Different clients could apply different privacy rules and archived Weddings can keep a published site flag. Guest-list privacy itself remains enforced by RLS; this finding does not imply a public guest list.

**Recommended implementation:** Define the approved V1 Wedding settings contract first; add only required Wedding-scoped fields and guarded transitions, with tests for guest and member access in each status. Keep website access and seating visibility as persisted Wedding-owned sources of truth, not client preferences.

### F3 — Coordinator team onboarding — **MISSING; blocks membership UI**

**Exact gap:** `issue_partner_owner_invitation` targets partner OWNER acceptance. There is no authenticated workflow to invite/add a `FULL_COORDINATOR`, `DAY_OF_COORDINATOR` or `GUEST_COORDINATOR`, accept that role, or safely change a non-owner role. `promote_wedding_member_to_owner` cannot fill this gap. The role enum and RLS support such members only when seeded/admin-created.

**Affected:** `public.wedding_invitations`, `public.wedding_memberships`, `public.issue_partner_owner_invitation`, `public.accept_wedding_invitation`, `public.promote_wedding_member_to_owner`.

**Impact:** Collaboration and coordinator portfolio actions cannot be reached through V1 user flows; direct table writes are intentionally denied. Granting broad membership writes to clients would weaken authorization.

**Recommended implementation:** Add role-specific, opaque, expiring invitation issuance/acceptance and owner-authorized role management with Wedding row locking, revocation, cross-Wedding checks and tests. Preserve the distinct Owner and coordinator roles.

### F4 — Published website and RSVP lifecycle guard — **PARTIAL; blocks guest UI**

**Exact gap:** `guest_wedding_guide` rejects an `ARCHIVED` Wedding, but `guest_submit_rsvp` checks only `wedding_websites.is_published` and token/Household membership. An archived site with `is_published = true` can still accept RSVP through `guest-rsvp`. Publishing likewise does not check Wedding status.

**Affected:** `public.publish_wedding_website`, `public.guest_submit_rsvp`, `public.guest_wedding_guide`, `supabase/functions/_shared/guest_website.ts`.

**Impact:** Public guest mutations can outlive the intended Wedding lifecycle. This becomes concrete as soon as F1 adds archiving.

**Recommended implementation:** Centralize status-aware website publication and guest mutation checks in SQL, atomically unpublish or gate archived/completed Weddings according to approved V1 behavior, and test guide/RSVP/Pass behavior across lifecycle transitions. Keep RSVP accessible only through a valid invitation token; direct anon RPC access is correctly denied today.

### F5 — Supplier finance separation — **PARTIAL; blocks finance UI**

**Exact gap:** `suppliers` has no commitment amount/contract value; `supplier_payments` is both the installment schedule and the actual payment record (`status`, `paid_at`, method, reference on one row). `mark_supplier_payment_paid` can only turn a scheduled amount into a matching paid amount. There is no separate transaction ledger for partial, multiple, corrected or unscheduled payments. `budget_items.actual_amount` can coexist with supplier payment totals, so a combined UI can double count if it treats both as spending.

**Affected:** `public.suppliers`, `public.supplier_payments`, `public.budget_items`, `public.supplier_payment_schedule`, `public.wedding_budget_totals`, `public.wedding_payment_totals`; finance RPCs in `20260925015103_suppliers_budget_payments.sql`.

**Impact:** Commitment, plan and cash paid cannot be reconciled reliably. V1 financial aggregates cannot guarantee that a supplier transaction is counted once.

**Recommended implementation:** Model supplier commitment, scheduled installments and append-only actual payment transactions separately; retain budget allocation/manual non-supplier costs separately; derive paid/remaining/overdue totals from source records with explicit allocation rules and migration for existing rows. Do not add payment processing.

### F6 — Guest Program (MISSING) and schedule-change review (PARTIAL) — **blocks Wedding-Day and website UI**

**Exact gap:** `wedding_day_items` is correctly operational only; no `guest_program` or guest schedule projection exists. The item table allows direct time/status updates, with no durable affected-item review or separate guest publication confirmation. There is no auto cascade, which matches the invariant, but no server-side record that downstream items were reviewed.

**Affected:** `public.wedding_day_items`, `public.wedding_day_dashboard`, `public.guest_wedding_guide`, `public.wedding_website_sections`.

**Impact:** A delayed Run of Show cannot safely communicate selected guest-facing changes, and clients may accidentally equate operational times with the published program.

**Recommended implementation:** Add a separate Wedding-scoped Guest Program and sanitized projection. Add explicit schedule revision/review and confirmation boundary for guest-facing changes; require a deliberate action per affected item. Keep operational changes from automatically moving later items.

### F7 — Notification production and delivery — **PARTIAL; blocks notification UI**

**Exact gap:** `enqueue_notification`, `claim_notification_deliveries` and `finish_notification_delivery` exist, but no Wedding-domain event producer calls `enqueue_notification`, and no scheduled Edge Function/worker sends email or push or finishes claimed outbox rows. The repository has no provider integration or device destination model. Inbox behavior in tests is seeded by direct service-role calls.

**Affected:** `public.notifications`, `public.wedding_notification_preferences`, `private.notification_delivery_outbox`, notification RPCs in `20260925130214_notifications_preferences.sql`; no delivery Edge Function.

**Impact:** A notification UI would appear functional for preferences and read state but would receive no normal V1 events; enabled email/push cannot deliver.

**Recommended implementation:** Define the approved event-to-recipient matrix; enqueue at transaction-safe domain boundaries with idempotency; add a server worker and destination handling for channels shipped in V1, or remove unavailable channel toggles from V1. Test opt-out, quiet hours, removal and retry behavior end to end.

### F8 — Guest attire and media projection — **PARTIAL; blocks full guest website UI**

**Exact gap:** Dress Code, color palettes, Guest-specific guidance, attire-group targets and inspiration Attachment links are stored, but `guest_wedding_guide` returns only general Dress Code text and a limited attendee group summary. It does not project recommended/avoid colors, Guest-specific guidance or safe image descriptors. The private Storage bucket offers member-authenticated reads; unauthenticated invited guests have no controlled Attachment delivery route.

**Affected:** `public.wedding_dress_codes`, `public.dress_code_*`, `public.attire_groups`, `public.guest_attire_guidance`, `public.*_inspiration_attachments`, `public.attachments`, `public.guest_wedding_guide`, `supabase/functions/guest-wedding-guide`.

**Impact:** Persisted V1 attire/media facts cannot be rendered to the intended guest without either omissions or unsafe raw Storage exposure. Direct public bucket access would compromise private files.

**Recommended implementation:** Extend the token-scoped guide projection with effective per-Guest attire/colors and only eligible Attachment IDs; provide a short-lived, token-checked media delivery/signed-URL boundary. Preserve bucket/path metadata as the durable source and do not persist signed URLs.

### F9 — Member financial least privilege and private-table hardening — **PARTIAL; blocks broad coordinator UI**

**Exact gap:** Finance SELECT policies use `has_active_wedding_membership`, so DAY_OF_COORDINATOR and GUEST_COORDINATOR can read all supplier, budget and payment rows; finance tests explicitly expect this. `FINANCIAL_PRIVATE` Attachment metadata has narrower access, but linked payment/contact data remains readable. `private.wedding_invitation_secrets` has RLS disabled despite revoked client privileges. Forty-three callable public `SECURITY DEFINER` functions are advisor warnings and need a documented authorization review, especially after lifecycle additions.

**Affected:** finance SELECT policies/views in `20260925015103_suppliers_budget_payments.sql`, `private.wedding_invitation_secrets`, public definer RPCs. Advisor references: [authenticated definer function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [private table RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Impact:** Lower-scope coordinators receive financial details unless that access is explicitly approved. The private secrets table has no current anon path, but RLS would reduce future grant mistakes.

**Recommended implementation:** Confirm the V1 role capability matrix, then narrow finance RLS and views if guest/day-of coordinators do not need financial read access; add representative role tests. Enable RLS on the unexposed invitation-secret table with no client policies after verifying privileged workflows. Review definer RPC grants and their caller/tenant checks individually; avoid blanket revocation of legitimate workflows.

## Validation and limits

- `npm run typecheck`, `npm run lint`, and `npm test` passed. The npm test command runs one Vitest file; it does not execute the SQL or Deno test suites.
- A tracked-file secret scan for common Supabase secret, Google key, GitHub token and private-key patterns found no matches. Environment-dependent deployed secrets were not inspected.
- Database test files cover many Owner, coordinator, cross-Wedding and anon cases, but new F1–F9 behavior has no tests because it is not implemented. No mutation was made on DEV during this audit.

## 1. Blocking backend gaps before UI

F1 Wedding/account lifecycle; F2 Wedding settings semantics; F3 coordinator-team onboarding; F4 website lifecycle guard; F5 finance separation; F6 Guest Program and schedule review; F7 actual notification production/delivery; F8 guest attire/media projection; F9 financial role scope before broad coordinator screens. Foundation UI work can proceed in isolation, but these features are not ready to wire end to end.

## 2. Non-blocking backend gaps

- Enable RLS on `private.wedding_invitation_secrets` as defense in depth and document the 43 public definer RPC authorization reviews.
- Revisit the 30 informational unused-index findings after realistic DEV data and query plans exist.
- Rate-limit public token endpoints and Google Places usage before production traffic; current 256-bit opaque tokens and Wedding membership checks remain the main authorization boundaries.

## 3. Safe to defer post-V1

Supplier marketplace/reviews, advanced floor plans, AI seating/motif, Canva, custom domains, video invitations, native group chat, honeymoon, gift registry, agency CRM, payroll/leads, white labeling, radio/headset, payment processing and alternative Storage providers.

## 4. Recommended next implementation order

1. Define and implement F1/F2 lifecycle and settings, with F4 status-aware guest access in the same migration set.
2. Implement F3 team invitation/role transitions and resolve F9 role visibility before coordinator UI consumes raw tables.
3. Correct F5 finance source-of-truth model before finance screens or aggregates are built.
4. Add F6 Guest Program/review and F8 guest attire/media projection before Wedding-Day and website UI.
5. Complete F7 notification producers/worker for the channels actually shipped in V1.

## 5. Verdict

**Phase 1B backend is not ready for V1 UI development as an integrated product.** Authenticated foundation screens and isolated components can start, but the blocking contracts above must be implemented before their workflows are wired to production data. The next task should be the Wedding lifecycle/settings migration and tests, including archive/restore, separate deletion boundaries, and status-aware website/RSVP behavior.
