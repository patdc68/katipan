# KATIPAN V1 product contract

CANVA DESIGNS THE INVITATION.
KATIPAN RUNS THE WEDDING.

This rework builds on the existing domain model, working backend, and Stitch baseline. It is not an empty-project rewrite. R0 changes architecture and agent contracts only; it removes no code or data and deploys nothing.

## Retained KATIPAN scope

KATIPAN owns authentication, email verification, Wedding workspace, onboarding, partner collaboration, Coordinator Mode, planning summaries, Checklist, Tasks, Planning Timeline, Places, Google Place context, Motif, Dress Code, Attire Groups, Guests, Households, RSVP, Entourage, Guest Groups, plus-one/child allowances, Seating Events, Tables, optional Seats, assignments, Guest Pass, Wedding-Day QR attendance, manual check-in, offline manual check-in queue, Run of Show, separately published Guest Program, Wedding Website / Guest Guide, Budget, Suppliers, commitments, installments, actual payments, reversals, receipts, notifications, and Wedding-Day operations.

Canva owns only invitation artwork, graphic layout, invitation fonts, decoration, and invitation photos/design. The native KATIPAN invitation graphic-design engine is superseded; native invitation template, artwork, typography, and visual layout editing concepts are deprecated. This does not deprecate Wedding Website themes or structured section editing. No database field, enum, table, existing route, or Stitch reference is removed by this foundation.

## Invitation artwork and RSVP are separate concerns

| Canva | KATIPAN |
| --- | --- |
| Invitation artwork | RSVP authorization and responses; Guest identity/data; Guest Guide; Seating; Guest Pass; Wedding-Day check-in |

Canva edits never create a Guest, set an RSVP, assign a seat, issue a pass, publish a Guest Program, or record attendance. KATIPAN links external design metadata; it never treats Canva content as authoritative Wedding data. Distribution remains an explicit action; recording invitation delivery does not send a message or imply an RSVP.

## Two QR contracts

| Contract | Authority | Payload and effect |
| --- | --- | --- |
| Invitation / RSVP QR | Agent 05; Agent 08 consumes link/asset | Secure KATIPAN URL with an opaque authorized Household/invitation token where needed. Opens the Guest/RSVP flow. A public URL alone cannot authorize RSVP. |
| Guest Pass QR | Agent 06 issues; Agent 09 scans | Opaque secret for an eligible individual Guest. Online authorized scanning records a separate check-in event. Never use a name, email, phone, surname, or raw database ID as the secret. |

The journey is **RSVP -> eligible attending Guest -> Seating -> Guest Pass -> Wedding-Day check-in**. This describes coordination of distinct domains, not one state machine or a mandatory dependency on completed seating. An eligible ATTENDING Guest can receive a pass without a table or seat. Pass identity is stable across seating changes; deliberate revoke/rotate is separate. RSVP mutation must not be invented by a seating, pass, or attendance client. Existing backend eligibility/cleanup rules must be audited before changing them.

Household is invitation grouping; individual Guest owns response, meal/dietary data, entourage participation, seat, pass, and check-in. Do not duplicate a person when an account joins. RSVP statuses remain NO_RESPONSE / ATTENDING / DECLINED. Household progress is derived; invitation delivery is independent.

## Operational and published schedules

Run of Show is internal and operational for the couple/coordinator. Guest Program is guest-facing and separately published. Delay does not cascade later operational items automatically. Linked operational changes may require explicit review; they never silently change guest times or publication. Keep the existing KEEP / UPDATE review and publication contract.

## Preserved invariants

Authorization remains User <-> Wedding Membership <-> Wedding. OWNER, FULL_COORDINATOR, DAY_OF_COORDINATOR, and GUEST_COORDINATOR remain distinct; no PRIMARY_OWNER. A couple-owned active Wedding retains an active Owner. Coordinator-created Wedding acceptance links existing people and preserves Wedding identity and all child records.

Google Place data differs from Wedding-specific place context; purposes are many-to-many. Motif differs from Dress Code. Commitment, installment, actual payment, budget estimate/allocation, and manual expense remain separate; aggregates cannot duplicate transactions. KATIPAN tracks money, never processes it.

Canonical guest URLs remain `katipan.ph/w/{slug}`. Access is ANYONE_WITH_LINK or INVITED_GUESTS_ONLY; section audiences remain PUBLIC / INVITED / PERSONALIZED / HIDDEN. Guest clients receive sanitized projections. Supabase Storage remains the only V1 file store, with centralized Attachment IDs and durable bucket/object identity. No persistent signed URLs.

Offline fallback is cached roster lookup plus queued **manual** check-in, with account/Wedding scoping and idempotent synchronization. An opaque QR is never claimed verified offline. Duplicate scans do not duplicate attendance; reversals preserve history.

See [ownership](domain-ownership.md), [backend audit](supabase-contract-audit.md), [Canva architecture](canva-integration.md), and [QA gates](qa-gates.md).
