# AGENTS.md — KATIPAN

## Mission

Build KATIPAN, a mobile-first wedding-planning ecosystem for couples, professional coordinators, and wedding guests.

Core product principle:

> One wedding. One source of truth. Different experiences for the people involved.

The repository must implement the approved V1 product model rather than inventing new wedding workflows.

## Primary stack

Preferred architecture:

- Mobile: Expo + React Native + TypeScript
- Web: Next.js + TypeScript
- Backend: Supabase Postgres, Auth, RLS, Realtime where justified, Edge Functions
- Validation: Zod
- Storage: Supabase Storage for V1, with centralized PostgreSQL attachment metadata

Before installing dependencies, inspect the existing repository and package manager. Do not replace an established package manager or project structure without a reason.

## Supabase project

Project ref: `fslwqgfuzzgsshkotfpn`

Application URL: `https://fslwqgfuzzgsshkotfpn.supabase.co`

Use the project-scoped Supabase MCP configured in `.codex/config.toml`.

Never confuse the application API URL with the MCP server URL.

## Working rules

1. Read this file before implementation.
2. Inspect existing code, migrations, and schema before changing anything.
3. Use Supabase MCP to inspect live project state instead of guessing.
4. Do not make destructive database changes unless explicitly required.
5. Every committed database change must be reproducible from repository migrations.
6. After database/RLS changes, verify behavior and run Supabase security/performance advisors.
7. Do not silently introduce features outside approved V1 scope.
8. Keep domain logic independent of UI whenever possible.
9. Prefer explicit constraints and transaction-safe server operations over client-only assumptions.
10. Preserve backward-compatible migration paths where reasonable.

## Product invariants

### Wedding membership

Authorization is based on:

`User <-> Wedding Membership <-> Wedding`

V1 membership roles:

- OWNER
- FULL_COORDINATOR
- DAY_OF_COORDINATOR
- GUEST_COORDINATOR

There is no PRIMARY_OWNER.

A couple-owned active wedding must retain at least one active OWNER.

A Full Coordinator is not an Owner.

### Coordinator-created weddings

A coordinator can create and fully manage a client wedding even if the couple has no Katipan accounts.

Client people can later join independently through secure invitations.

When a client joins:

- link the authenticated account to the existing person
- preserve the existing wedding ID
- do not clone guests, suppliers, seating, tasks, budget, places, or program
- first joined client becomes OWNER
- coordinator transitions to FULL_COORDINATOR
- the other partner remains not joined until accepting separately

### People / guests

A real wedding person must not be duplicated merely because they later create a Katipan account.

A Household is an invitation grouping, not an RSVP, seating, or check-in identity.

Individual Guests own:

- RSVP
- meal/dietary response
- entourage roles
- seating
- Guest Pass
- check-in

Entourage assignment must reuse the existing Guest/person record.

### RSVP

Individual statuses:

- NO_RESPONSE
- ATTENDING
- DECLINED

Household RSVP progress is derived from individual responses.

Invitation-delivery state is separate from RSVP state.

### Places

Ceremony style and venue/place type are independent.

A Wedding Place can have many purposes.

One purpose can have many Wedding Places.

Do not introduce permanent `ceremony_place_id` or `reception_place_id` assumptions.

### Suppliers / finance

Katipan tracks money but does not process/disburse money.

Keep distinct:

- supplier commitment
- scheduled installment
- actual payment transaction
- budget allocation
- manual expense/planned non-supplier cost

Budget aggregates source records and must not duplicate supplier transactions.

### Wedding website

Canonical URL shape:

`katipan.ph/w/{slug}`

Website access:

- ANYONE_WITH_LINK
- INVITED_GUESTS_ONLY

Section audience:

- PUBLIC
- INVITED
- PERSONALIZED
- HIDDEN

Templates control presentation only and must never own/duplicate authoritative wedding data.

Public visitors cannot RSVP.

### Seating

Model:

`Seating Event -> Table -> Seating Assignment -> Guest`

Exact seat is optional.

One active seating assignment per Guest per Seating Event.

Only ATTENDING guests normally appear in the default seating pool.

Household splitting is allowed with a warning.

Deleting a table never deletes guests.

Guest seating visibility:

- HIDDEN
- TABLE_ONLY
- TABLE_AND_SEAT

### Guest Pass

Guest Pass availability does not depend on seating completion.

Use secure opaque tokens.

Never encode a person's name, email, phone, surname, or raw database ID as the QR secret.

Human-readable guest reference is separate from the secret token.

Seat/table changes must not regenerate the Guest Pass.

### Wedding-Day check-in

RSVP, seating, Guest Pass, and check-in are separate concepts.

Check-in belongs to individual Guests.

Household batch operations create one Check-In Event per selected Guest.

Duplicate scans must not duplicate attendance.

Undo/reversal must preserve history.

V1 offline fallback is cached roster lookup + queued manual check-in. Do not claim an opaque QR was verified offline when it was not.

### Run of Show

Operational timeline and Guest Program are distinct.

A delay does not automatically cascade all later times.

Affected items must be reviewed explicitly.

Guest-facing schedule changes require separate confirmation.

## Security rules

- Enable RLS on every table in an exposed schema.
- `TO authenticated` is not sufficient authorization by itself; policies must enforce wedding membership/capabilities.
- Never use user-editable `user_metadata` for authorization.
- Never expose Supabase service-role/secret keys to Expo or browser code.
- Prefer publishable keys in public clients.
- UPDATE policies require appropriate SELECT access and both USING/WITH CHECK conditions.
- Treat SECURITY DEFINER functions as exceptional; do not use them merely to bypass RLS problems.
- Guest/public experiences should receive sanitized projections, not unrestricted raw guest/private table access.
- Invitation and Guest Pass secrets must be random, opaque, and stored hashed where practical.
- Ownership transitions, destructive lifecycle operations, token acceptance, and concurrency-sensitive operations should use transaction-safe server/database boundaries.

## Attachments / storage

Supabase Storage is the only V1 file-storage provider.

PostgreSQL stores centralized Attachment metadata, never file bytes. Domain records reference Attachment IDs rather than permanent URLs, and durable object identity is the Supabase Storage bucket plus object path.

Private objects use authenticated access and may use short-lived signed URLs in future delivery workflows. Do not persist temporary signed URLs or permanent authenticated/public URLs.

Alternative storage providers are out of scope. Do not introduce MEGA, MEGA S4, generic S3, provider-selection, or provider-adapter abstractions without a future explicit measured requirement.

Never expose Supabase service-role or secret keys in Expo, browser, or other public clients.

Recommended metadata includes:

- wedding_id
- bucket_id
- object_path
- original_filename
- MIME/content type
- byte size
- visibility class
- checksum
- encryption version if app-level encryption is later added

Supplier, Guest, Dress Code, Wedding Website, and other domain tables should reference Attachment IDs rather than duplicating Storage locators.

## Scope discipline

Explicitly out of V1 unless separately approved:

- supplier marketplace/reviews
- advanced venue floor-plan editor
- AI seating
- AI motif generation
- Canva integration
- custom wedding domains
- video invitations
- native Katipan group chat
- honeymoon planner
- gift-registry platform
- coordinator agency CRM
- employee/payroll tools
- lead pipeline
- white labeling
- radio/headset broadcast workflows
- payment processing

Future-ready architecture is welcome; shipping unapproved UI/features is not.

## Database workflow

Before schema work:

1. Inspect existing tables and migrations.
2. Confirm no conflicting schema already exists.
3. Design or update the logical model.
4. Use migrations for committed DDL.
5. Add constraints, indexes, and RLS with the same change.
6. Verify representative Owner, Coordinator, and unauthorized-user cases.
7. Run security and performance advisors.
8. Generate/update TypeScript database types after schema stabilization.

Do not leave remote-only schema drift that is absent from the repository.

## Code quality

- TypeScript strict mode where practical.
- Avoid `any` unless justified.
- Validate external input at boundaries.
- Keep authorization server-side/RLS-enforced even when UI hides controls.
- Keep components focused and domain behavior testable.
- Add tests for state transitions and high-risk permission boundaries.
- Do not hardcode sample wedding facts into production logic.
