# Mobile Coordinator Portfolio and Wedding Team

## Account and membership model

Katipan does not store a permanent Couple or Coordinator account type. The same signed-in account can own one Wedding, coordinate another, and create additional client Weddings. Authority comes from each Wedding's active membership role and ownership mode.

The My Weddings workspace remains the single portfolio. Each card shows the person's role, Wedding origin, and current ownership mode. Coordinator-created Weddings stay labeled **Client Wedding** after the couple takes ownership; ordinary couple-created Weddings remain labeled **Couple-created**. The portfolio CTA opens Coordinator Onboarding without persisting a user-level coordinator flag. The zero-membership couple entry also links to the client flow.

Opening a Coordinator-created Wedding as a Full Coordinator uses the canonical Coordinator overview route. Other roles open the existing Wedding workspace. Switching still refreshes authoritative memberships, updates the selected Wedding, increments the cache revision, and remounts the workspace tabs.

## Coordinator entry and client Wedding creation

Coordinator Onboarding explains that one account can coordinate multiple Weddings and own other Weddings. It is workflow education, not account-type setup.

Create Client Wedding validates the required Wedding display name and two partner display names, plus optional date, timezone, general location, guest count, and ceremony style. The form calls `create_coordinator_managed_wedding` with the exact `ceremony_style` enum values. It creates no Auth users. The backend creates two existing Partner Person records and gives the creator the controlling Full Coordinator membership. The screen refreshes active memberships before opening the new Wedding.

No backend contract gap was found. No migration or generated-type change was needed.

## Coordinator overview and ownership transition

The canonical route is `/(coordinator)/[weddingId]/overview`. It presents client names, date, location, estimated guests, ceremony style, each Partner's joined state, the current role, Wedding status, and ownership mode. Its actions link to the existing Wedding workspace, Partner invitation, and team screen. Plan, Guests, Budget, and Wedding Day remain in their current operational screens.

Partner invitations use `issue_partner_owner_invitation` and one of the Wedding's existing, unlinked Partner Person records. They never create a replacement Person or Wedding. The raw bearer token is held only long enough to form the invitation URL for the explicit share action; it is not logged, persisted, or sent to analytics.

The shared `/accept-invitation` route accepts both invitation types. It first calls `accept_wedding_invitation`. The RPC rejects a Coordinator invitation's null Partner target before writes with the same generic `22023` error used for other invalid invitations. The client then tries `accept_coordinator_invitation` only for that deterministic database error. Authentication errors, missing responses, and transport failures stop dispatch, avoiding a retry when the server outcome is uncertain. Both server workflows remain transaction-safe; there is no client lookup of `private.wedding_invitation_secrets` or public token-kind endpoint.

When the first Partner accepts, the backend links that account to the existing Person, activates an equal OWNER membership, changes the existing Wedding to Couple-owned, and retains the coordinator as FULL_COORDINATOR. The second Partner accepts independently and becomes another equal Owner. There is no Primary Owner and no replacement Wedding.

## Team screen and permissions

The team route is `/(wedding)/[weddingId]/team`. It lists active membership identity and role, plus pending invitation metadata returned by the existing RLS policy. It never queries or displays raw token hashes. Member identity uses the RLS-visible profile display name and the existing linked Partner Person name when available.

The UI mirrors the current backend capability boundary, while every write still relies on its RPC and authorization checks:

- An OWNER of a Couple-owned Wedding, or the current Full Coordinator controller while a Wedding is Coordinator-managed, can issue Partner and Coordinator invitations and change another active Coordinator's role.
- Coordinator invitation options are FULL_COORDINATOR, DAY_OF_COORDINATOR, and GUEST_COORDINATOR. The client rejects OWNER, and the backend remains authoritative.
- A retained Full Coordinator on a Couple-owned Wedding can continue coordinating but does not receive Owner/team-management actions just for having that role. DAY_OF_COORDINATOR and GUEST_COORDINATOR do not receive Owner actions.
- Owner promotion and member removal are shown only to an OWNER of a Couple-owned Wedding. Promotion uses `promote_wedding_member_to_owner`; it can create multiple equal Owners. Removal uses `remove_wedding_member`, requires confirmation, and preserves membership history.
- A final active Owner cannot be promoted away, removed, or leave. Removing yourself is not offered; leaving uses `leave_wedding`. The coordinator controller cannot leave before ownership transition.
- Pending Partner and Coordinator invitations use `revoke_wedding_invitation` with confirmation. The RPC revokes rather than deleting history.

Every team query includes the current route Wedding ID, table reads remain RLS-protected, and the mutation RPCs bind membership/person/invitation IDs to the supplied Wedding where applicable. After role changes, promotions, removals, revocations, and leaving, the app refreshes authoritative membership state. Leaving clears the old selection/cache and routes to My Weddings.

## Stitch source selection and adaptations

The requested Stitch records were retrieved from **Katipan Wedding Planner UI System** (`13691899610292683671`): Coordinator Onboarding (`a7970cf399a44499b12d921b316d9db1`), Create Client Wedding (`2689ca94563540339ca1edbd62884161`), Invite Couple / Ownership Transition (`72c44d6876884247826048a2bb72f789`), Coordinator-Managed Wedding Overview (`4753b63a91304fac884ec6debf7681c5`), Coordinator Wedding Overview (`d99ee81c2e8743ce99a87253259dcc35`), Enhanced My Weddings (`9f449d0690074bb0bcb0875d288b24a3`), and Wedding Team & Coordinator Access (`1f25d64a13e74969a684fb476c593388`). Warm Editorial Nuptial tokens and shared mobile components remain the visual base.

The two overview entries map to one route. The chosen canonical reference is **Coordinator-Managed Wedding Overview** (`4753b63a…`), whose explicit managed-Wedding title and 780 × 5152 mobile canvas match this slice's pre-transition client state. **Coordinator Wedding Overview** (`d99ee81c…`, 816 × 4396) remains a visual variant, not another route or ownership model. This screen is extended to show the Couple-owned state after transition while preserving the same Wedding ID.

Stitch returned screenshot and HTML download links, but the available browser surface could not open them in this session. The variant choice therefore follows the screen titles, dimensions, shared source inventory, and backend contract; the feature uses the established Warm Editorial typography, colors, cards, spacing, and pill controls. A direct screenshot comparison remains a visual-review limitation and is included in physical QA.

Intentional functional adaptations are:

- The portfolio removes the sample persona switcher and shows every actual active membership and role in one list.
- Coordinator onboarding states explicitly that no permanent account role is created.
- The creation form exposes backend ceremony-style values and optional fields; its date picker reuses the native/web wedding-date control.
- Partner invitation is limited to existing Partner records, and the share sheet replaces channel-specific sample messaging.
- The overview is a client-context summary with links to the existing Wedding tools; it does not copy their dashboards.
- The team screen presents capability-appropriate actions and confirmation dialogs required by backend ownership protections.

## Deferred physical QA

Device review is deferred and does not block this slice. Review these journeys on Android and iOS:

- Coordinator onboarding and the zero-membership client-flow entry.
- Create-client form, optional date/timezone/location/count, and ceremony-style selection.
- My Weddings switching between Owner and Coordinator memberships, including cache clearing.
- Partner and Coordinator invitation deep links and share sheets.
- First Partner ownership transition and independent second Partner acceptance.
- Coordinator acceptance for each of the three Coordinator roles.
- Team role menus, Owner promotion, pending invitation revocation, member removal, and leave confirmations.
- Narrow and large Android/iOS layouts, including the confirmation modal and long member/invitation lists.
- Visual comparison against both Coordinator overview Stitch screenshots when the Stitch image links are accessible.
