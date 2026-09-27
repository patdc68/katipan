# Mobile Entourage, Guest Groups, and Allowances

## Stitch review

Inspected the exact **Entourage Management** screen (`6da61dba2f2247bb97b434a85b7d474c`) on 2026-09-27, then re-checked **Guest List** (`831f2ac9eff147c0bb5b44f0af799c45`), **Household / Invitation Details** (`7d9aed83410a4d099bc210f9963eb4dd`), and **Individual Guest Details** (`7cf62a6980ed4508ac37bc34d467f659`). The implementation uses Warm Editorial Nuptial and the existing five-tab Wedding navigation shell.

The Entourage route carries over the reference's ivory surface, Playfair Display headings, Plus Jakarta Sans body text, sage actions, rounded cards and chips, 20 px page gutters, role-first hierarchy, and a clear multi-role explanation. It uses real role and assignment rows for the active Wedding.

## Implemented flows

- Entourage role list, optional descriptions, assignment summaries, create/edit/delete, and Guest assignment/removal. A Guest may have multiple roles. These actions do not change RSVP, seating, Guest Pass, or check-in state.
- Guest Group create/rename/delete, membership add/remove, Guest List group filtering, and group display on Individual Guest Details. Group membership is independent of Household membership.
- Household-level CHILD allowances and sponsor-level PLUS_ONE allowances, including definition create/edit/delete, named-Guest claim/release, and claimed/remaining capacity. Claims use existing Guest records and do not change RSVP.
- DAY_OF_COORDINATOR sees the domain read-only. Owner, Full Coordinator, and Guest Coordinator can manage where the existing backend allows it; the active Wedding context and RLS remain authoritative.

## Backend contract

No migration was needed. Group, membership, entourage role, assignment, and allowance definitions use direct writes to the existing RLS-protected tables. Allowance claims and releases use the existing `claim_guest_allowance` and `release_guest_allowance_claim` RPCs. Client checks reject mismatched Wedding or Household IDs early; database constraints, triggers, and RLS enforce the final boundary and capacity rules.

PLUS_ONE requires a sponsor Guest in the same Wedding and Household as the allowance. CHILD is Household-level and always has a null sponsor. Allowances require `max_count > 0`. The UI does not create placeholder people for unused capacity.

## Intentional visual and content deviations

- The Stitch Entourage screen shows preset role groups and target-capacity progress. The backend has no role capacity or authoritative category model, and `preset_key` is metadata only, so the route presents roles in stored order with live assignment counts and does not assume preset roles exist.
- The screen's attire/style guidance card is not included because that belongs to another data flow and is outside this feature's scope.
- The Entourage navigation only links All Guests and Entourage. Seating is not included in this slice.
- Group and allowance controls reuse the established Guest and Household card, chip, and form language because there are no dedicated Stitch screens for these domains. Controls remain compact within the existing screen hierarchy.
- No sample groups, roles, guests, or allowance records are seeded into Wedding data. The couple placeholder used by the app is Juan & Maria.

## Deferred physical QA

No physical-device testing blocks this branch. On a real Android/iOS device, verify touch layout and keyboard behavior for role and group forms, role assignment/removal, group filtering, PLUS_ONE and CHILD definition forms, allowance claim/release and full-capacity feedback, read-only DAY_OF presentation, and state refresh after switching Weddings.

## Recommended next slice

Seating management, using the existing Wedding-scoped Guest records and preserving the one-active-assignment-per-Guest-per-event rule.
