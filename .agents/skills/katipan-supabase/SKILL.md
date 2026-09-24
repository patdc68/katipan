---
name: katipan-supabase-development
description: Use for any KATIPAN task involving Supabase schema design, PostgreSQL migrations, RLS, Auth, Edge Functions, Realtime, Storage integration, secure guest tokens, coordinator permissions, or database-backed domain implementation. Do not use it for purely visual UI work that does not touch backend behavior.
---

# KATIPAN Supabase Development Skill

## Goal

Implement KATIPAN backend changes safely against the project-scoped Supabase environment while preserving the Phase 0 product invariants in `AGENTS.md`.

## Mandatory first steps

1. Read the repository root `AGENTS.md`.
2. Inspect the repository structure, `supabase/`, migrations, generated database types, and environment templates.
3. Use the Supabase MCP to inspect the current remote project before assuming schema state.
4. If MCP is unavailable or unauthenticated, stop database writes and report the connection problem rather than inventing remote state.

Project ref: `fslwqgfuzzgsshkotfpn`

## Schema workflow

For every schema task:

1. Identify the domain invariant being implemented.
2. Inspect existing tables, constraints, migrations, and RLS.
3. Design the smallest compatible change.
4. Ensure tenant-owned rows resolve to a `wedding_id` boundary where practical.
5. Add PK/FK/UNIQUE/CHECK constraints instead of relying only on application validation.
6. Create/update repository migration files for committed DDL.
7. Add RLS in the same change for exposed tables.
8. Verify the intended role matrix with representative queries.
9. Run Supabase security and performance advisors.
10. Update generated TypeScript database types after the schema is stable.

Never leave intentional remote schema drift that is absent from Git migrations.

## RLS rules

Authorization is based on:

`auth.uid() -> wedding_memberships -> role/capability`

Never treat `TO authenticated` alone as authorization.

Never use user-editable metadata for permissions.

Owner, Full Coordinator, Day-of Coordinator, and Guest Coordinator must remain distinct.

A Full Coordinator must never gain ownership/deletion capabilities merely because they have broad planning access.

Guest-facing anonymous access should use sanitized projections / controlled server or Edge Function boundaries when raw table exposure could leak unrelated wedding data.

## High-risk operations

Use transaction-safe database/server operations for:

- accepting couple/partner invitations into coordinator-created weddings
- adding/removing Owners
- preventing the final active Owner from leaving
- moving a Guest between Tables while preserving uniqueness/capacity
- check-in/reversal with duplicate-scan protection
- offline queued check-in reconciliation with idempotency/client event IDs
- destructive archive/delete lifecycle actions
- secure invitation token validation
- secure Guest Pass token validation

## Secure token rules

For invitation access and Guest Passes:

- generate cryptographically random opaque values
- store hashes rather than plaintext secrets where feasible
- support revocation
- do not derive tokens from names, emails, surnames, or raw IDs
- do not expose raw token values in logs or UI

## Storage rules

Use the provider-neutral attachment model.

Do not hardcode business entities to permanent Supabase Storage URLs.

Temporary signed URLs are generated on demand and are not persistent domain data.

If Supabase Storage is used initially, keep the interface compatible with a future MEGA S4/S3-style provider.

Avoid proxying large object bytes through Edge Functions unless server-side processing is actually required.

## Verification checklist

Before declaring a backend task complete, verify:

- intended Owner access
- intended coordinator access
- unauthorized cross-wedding access is denied
- guest/public access exposes only intended projection data
- destructive operations preserve ownership invariants
- constraints reject invalid duplicate/relationship states
- migrations are reproducible
- relevant security/performance advisor findings are addressed
- generated types match the resulting schema

Summarize deliberate tradeoffs and any required future migrations.
