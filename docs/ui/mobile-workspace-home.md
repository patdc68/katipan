# Mobile Workspace Home

## Stitch source selection

Before implementation, inspected the actual screenshots for **My Weddings** (`9df96942a14c4734849671e04b4be370`), **Enhanced My Weddings** (`9f449d0690074bb0bcb0875d288b24a3`), and **Home Dashboard** (`1a677a73dfc74f658dba3bb5e1254615`) in the Katipan Wedding Planner UI System. The Warm Editorial Nuptial system and the shared mobile primitives remain the visual base.

**Enhanced My Weddings** is the canonical selector composition. Its portfolio cards, search and date filters, workspace summary, and clearer action hierarchy work as a single reusable wedding switcher. The earlier My Weddings screen is retained as a reference variant. Both screenshots use coordinator language and sample portfolio content, so the implementation adapts those components to every active Wedding membership rather than assuming a coordinator account type.

The Home Dashboard follows the inspected editorial order: brand and account action, celebration hero, planning progress, upcoming tasks, guest summary, places, and a shared five-tab bar. A live budget summary card appears between guests and places to satisfy the requested dashboard data coverage. The app uses the Stitch semantic palette, typography, card radii, and spacing through the existing UI tokens and components.

## Intentional visual and content deviations

- Removed coordinator-only labels, portfolio attention counts, profile/persona switcher, sample Wedding cards, and sample photos. The selector shows only current backend memberships, each person's role, Wedding status, couple/client names when available, origin, date, and location.
- The screenshot's large couple photograph is omitted because the current Wedding contract has no persisted cover-image field. The hero uses the real couple names, date/countdown, general location, and role instead of showing an unsaved preview image.
- The selector retains the enhanced screen's card/search/filter hierarchy but does not retain its coordinator-specific bottom navigation. The Wedding workspace uses one shared Home / Plan / Guests / Budget / More tab bar.
- The dashboard calls its places section **Our Places** because a Wedding Place can have several purposes and is not necessarily a venue.
- Guest totals count individual Guest and RSVP records. Seating counts are omitted because the current overview contract does not provide a safe aggregate for them.
- Added a compact **Budget at a glance** card between the guest summary and places because the task explicitly requests budget data on Home. It reads the existing finance view and follows its Owner/Full Coordinator access boundary.
- Budget totals are queried only for OWNER and FULL_COORDINATOR memberships. Other membership roles see a short access explanation, consistent with the live finance view's narrower permission boundary.
- Empty task, guest, place, date, and budget states use plain prompts tied to existing product flows. No illustrative wedding facts or recommendation/tip copy is presented as live data.
- Plan, Guests, and Budget tabs are structured placeholders in this slice. More contains account details, Wedding switching, and Sign Out.

## Data and security

No migration was needed. The implementation uses the existing `accept_wedding_invitation(p_raw_token)` RPC and direct, membership-scoped reads from `wedding_memberships`, `weddings`, `wedding_partners`, `wedding_people`, `planning_tasks`, `guests`, `guest_rsvps`, `wedding_places`, `wedding_place_purposes`, and the existing `wedding_budget_totals` view. Each dashboard source query is filtered to the active membership's `wedding_id`; RLS remains authoritative.

The selected Wedding UUID is an optional convenience value in SecureStore on native and local storage on web. It is revalidated against the signed-in account's active memberships on restore. Changing Wedding increments the workspace cache revision and remounts the tab navigator. Invitation tokens remain transient route/RPC/share values; they are not logged or written to app storage. An unauthenticated user is asked to reopen the original link if email confirmation leaves the acceptance screen.

The acceptance flow relies on the existing RPC to link the authenticated recipient to the existing person and Wedding and to perform the ownership transition. Invalid, expired, revoked, and used invitations receive a generic safe message. The client does not create or clone a Wedding or person while accepting an invitation.

## Verification notes

The three requested Stitch screenshots were compared at full resolution before implementation. Repository lint, typecheck, root tests/builds, platform exports, and static web build are recorded in the implementation PR validation summary. The Android physical-device acceptance journey could not be exercised because the host has no `adb` executable or connected device, and no Couple A/B DEV test accounts were supplied. No deliberate DEV smoke-test Wedding or person records were created.
