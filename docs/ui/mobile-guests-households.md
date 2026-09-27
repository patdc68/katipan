# Mobile Guests and Households

## Stitch review

Inspected the exact screens in the **Katipan Wedding Planner UI System** on 2026-09-27:

- Guests Home — `db3b28b46d7b4d44a4b6574e8367471c`
- Guest List — `831f2ac9eff147c0bb5b44f0af799c45`
- Household / Invitation Details — `7d9aed83410a4d099bc210f9963eb4dd`
- Individual Guest Details — `7cf62a6980ed4508ac37bc34d467f659`

The screens use **Warm Editorial Nuptial** and the existing five-tab Wedding shell. The mobile implementation follows the references' ivory surfaces, Playfair Display headings, Plus Jakarta Sans body, sage actions, large editorial cards, rounded status chips, 20 px page margins, and clear section hierarchy. The Guests tab opens the new nested guest stack while Home, Plan, Guests, Budget, and More remain the production tabs.

## Screens and behavior

- **Guests Home** shows live individual Guest totals, Attending / Declined / No Response counts, response progress, and Household invitation delivery totals. Household progress comes from the existing security-invoker view and the individual RSVP records.
- **Guest List** searches names, contact fields, Household names, and group labels. RSVP filters combine with optional group filters. Results keep each Guest's Household context and open individual details.
- **Household Details** separates Household invitation delivery from member RSVP progress, lists named Guests, shows existing allowance claims, and can link or release an allowance against an existing Guest. Household edits update the existing RLS-protected row because the backend contract has no household-edit RPC.
- **Individual Guest Details** shows the linked Wedding Person, Household, individual RSVP and meal fields, groups, allowance claims, existing entourage summary, safe seating summary, and manager-visible notes.
- **Create Household**, **Add Guest**, **Edit Household**, and **Edit Guest** routes use the current Wedding's IDs. Add Guest supports a new person or an existing Wedding Person. Existing people who already have a Guest record are not offered again.

All reads include the active Wedding ID and are subject to RLS. Route lookups and write guards reject Guest and Household IDs that do not belong to the selected Wedding. Guest-domain actions are offered to active Owners, Full Coordinators, and Guest Coordinators. Day-of Coordinators are read-only. The database RPCs and RLS policies remain authoritative.

## Existing backend contract

The live project and repository migration already contain `guest_households`, `guests`, `guest_rsvps`, `guest_groups`, `guest_group_memberships`, `guest_allowances`, `guest_allowance_claims`, `wedding_people`, and `guest_household_rsvp_progress`. The current RPCs cover Household and Guest creation, existing-person reuse, person updates, RSVP changes, invitation delivery tracking, and allowance claim/release. No migration was needed.

The app uses:

- `create_guest_household`
- `create_guest`
- `add_existing_person_as_guest`
- `update_guest_person`
- `mark_household_invitation_sent`
- `reset_household_invitation_delivery`
- `set_guest_rsvp`
- `claim_guest_allowance`
- `release_guest_allowance_claim`

The allowance labels use the backend enum values exactly (`PLUS_ONE`, `CHILD`). An allowance has no person identity until a real Guest is added and linked with the claim RPC. RSVP progress is derived from individual Guests. Marking an invitation SENT only updates tracking state; it does not send a message or set an RSVP.

## Intentional visual and content deviations

- The Stitch references contain example wedding names, counts, guest names, meal data, and seating. The app shows only records from the selected Wedding and uses initials instead of fabricated guest portraits.
- Guests Home replaces the example invitation artwork and decorative guest photographs with the live Guest and Household totals because the backend has no saved photo for those areas.
- The Guest List reference includes a wedding-party management block. It is omitted per the requested scope. Existing entourage roles appear as a read-only summary on Individual Guest Details.
- The Household reference suggests invitation sharing. The current RPC contract records SENT or NOT_SENT but has no delivery action, so the screen describes delivery tracking and does not imply a message was sent.
- Guest Pass and check-in controls are omitted from this slice. Individual Guest Details explicitly states that RSVP, invitation delivery, seating, Guest Pass, and check-in are separate states.
- Seating is shown only from same-Wedding assignment, event, and table rows returned under RLS. A read failure hides the summary instead of showing an unverified empty state. Exact seat IDs are not displayed.
- Household and Guest forms use the shared accessible text inputs and native keyboard behavior. The screenshot's compact toolbar actions are presented as larger buttons where needed for touch targets.

## Verification

`model.test.ts` covers summary counts, Household progress derivation, search and filters, allowance labels, available-person filtering, cross-Wedding guards, role behavior, form validation, and duplicate-submit prevention. `api.test.ts` covers Wedding-scoped reads, RPC argument mapping, direct Household editing under RLS, RSVP and delivery actions, allowance claim/release, existing-person reuse, Day-of restrictions, and cross-Wedding rejection.

All four Stitch screenshots were inspected directly. A running-app screenshot comparison was unavailable in this environment: the computer-use surface reported no browser or app, and the host has no Android `adb` or connected device. Expo route export and platform bundling succeeded, but this does not replace a pixel-level runtime review or the requested physical Android smoke journey.
