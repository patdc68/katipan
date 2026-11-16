# R1 Core Workspace contract

Status: **Agent 03 implementation handoff; Agent 10 verification pending**
Scope: authentication/session restoration, onboarding handoff, Wedding workspace selection, My Weddings, coordinator portfolio entry, invitation acceptance entry, and root navigation. This contract does not authorize R2+ feature work.

## Backend contract used

Agent 02's read-only R1 audit in [the Supabase contract audit](supabase-contract-audit.md) returned KEEP for the existing Auth/profile, Wedding, membership, Partner/person, invitation, RPC, RLS, and grant contracts. No migration or generated-type change was needed, and DEV was not mutated.

The client resolves access from `wedding_memberships.status = ACTIVE`, then re-reads the accessible Wedding and Partner rows. It does not filter membership by `weddings.status`. An ACTIVE OWNER or coordinator membership remains valid for a DRAFT Wedding. Wedding lifecycle, role, and membership status stay separate.

Partner acceptance continues through `accept_wedding_invitation`; coordinator invitations continue through `accept_coordinator_invitation`. The API regression verifies the partner RPC returns the existing Wedding and person IDs and does not call a Wedding/person creation RPC. Acceptance remains server-authoritative and idempotent.

## Canonical state model

`workspaceRestorationStatus` exposes these states:

| State | Meaning and presentation |
| --- | --- |
| `AUTH_LOADING` | Supabase session is unresolved. Keep a deliberate loading screen. |
| `SIGNED_OUT` | No authenticated session exists. Auth routes are available. |
| `AUTHENTICATED_WORKSPACE_LOADING` | An authenticated account's membership list and saved selection are being resolved or revalidated. Keep loading; do not show empty, unauthorized, or unavailable. |
| `AUTHENTICATED_NO_WEDDINGS` | Authoritative membership resolution succeeded with no active memberships and no previously selected membership loss. Show the My Weddings empty state. Couple creation, coordinator entry, and invitation deep links remain available. |
| `AUTHENTICATED_WEDDING_SELECTION_REQUIRED` | Memberships are valid, but multiple accessible Weddings exist and no saved selection can be restored. Show My Weddings. |
| `AUTHENTICATED_WEDDING_READY` | The selected Wedding is in the latest authoritative ACTIVE membership result. |
| `AUTHENTICATED_MEMBERSHIP_LOST` | An authoritative result confirms the prior selection is no longer an active membership. Clear that selection and route to My Weddings. |
| `RECOVERABLE_ERROR` | Auth or workspace resolution failed due to a recoverable request/server error. Show retry/error state; a failed read is never membership loss. |

The access provider owns `AUTH_LOADING` and the signed-in principal. The workspace provider owns membership and Wedding selection resolution. The selector empty state routes to My Weddings for both no-membership and confirmed-loss outcomes, while the status and copy keep those outcomes distinct.

## Restoration and race protection

On cold start, the auth provider subscribes to auth state before applying the initial `getSession()` result. `AuthEventGeneration` rejects an initial snapshot superseded by an auth event. Authenticated workspace resolution then loads ACTIVE memberships, the corresponding Wedding rows, Partner display rows, and the account's saved Wedding preference. The saved ID is only a preference: it is accepted only when present in the latest ACTIVE membership result.

If a saved ID is invalid, restoration picks the sole remaining accessible Wedding; if there are several, it clears the saved choice and requires the user to choose. An authoritative empty result produces the no-Weddings or membership-lost state. Query errors produce `RECOVERABLE_ERROR`. When the app returns to foreground, `AppState` triggers the same membership revalidation and loading semantics.

Workspace requests use a monotonically increasing `RequestGeneration`. A new account, switch, logout, effect cleanup, or newer refresh invalidates older work. Success and catch paths check the generation and current account before committing. The initial restore also checks its mounted flag. Requests are not forcibly aborted; an old network response may finish, but it cannot update the current snapshot. Selected-Wedding storage operations are serialized per storage key, so a logout clear queued behind an in-flight write is the final operation for that account.

## Selection and cache boundaries

| Boundary | State and invalidation |
| --- | --- |
| Session-scoped | Supabase persists its Auth session using the existing SecureStore/localStorage adapter. Access-provider draft/onboarding state resets when the authenticated user ID changes. `sessionRevision` changes on account entry/exit and keys the root navigation stack. |
| Account-scoped | Membership snapshots are tagged with the account ID and selectors return none for a different account. Selected Wedding preference is stored at `katipan.selected-wedding-id.<auth-user-id>`; logout removes that key and the legacy unscoped key. A different account cannot read the previous account's preference. |
| Wedding-scoped | `cacheRevision` advances when the selected Wedding changes, is invalidated, is lost, or the account/session is cleared. The Couple tab tree is keyed by session revision, Wedding ID, and cache revision, so local tab state remounts on a workspace change. |
| Feature data | R1 adds no durable feature-data cache. Later domain requests and caches must be keyed by authenticated account and Wedding, then discard or ignore stale results when their workspace revision changes. |

Membership remains authoritative in Supabase. A selected ID, storage key, route parameter, or cache revision is never an authorization check.

## Navigation and Back behavior

- Successful sign-in and confirmed-session entry replace to `/`. A changed `sessionRevision` remounts the root Stack, removing stale signed-out/onboarding history below the authenticated root. Invitation acceptance retains its deep-link route through authentication, then moving into the Wedding workspace resets the stack.
- Signed-in cold start routes to the validated single Wedding when available; multiple Weddings, no Weddings, selection-required, and membership-lost outcomes route to My Weddings. A coordinator-created Wedding selected by a Full Coordinator opens the existing coordinator overview/portfolio branch.
- Couple bottom tabs remain **Home, Plan, Guests, Budget, More**. Nested routes stay hidden from the tab bar.
- R1 nested screens with a valid prior route expose an in-app Back action. Deep-linked invitation acceptance returns to the authenticated root when signed in or Welcome when signed out. My Weddings only shows Back when the router has a valid prior route. Coordinator overview returns to My Weddings.
- At the Couple Home tab root, Android `BackHandler` consumes Back and leaves the user at the authenticated root. Other nested routes use normal navigator/system Back behavior. Root history replacement ensures Back cannot reveal Sign In underneath Home.

## Journey A findings and implementation response

### A-003 — intermittent unavailable/empty workspace during restore

The source path allowed the initial `getSession()` continuation and auth-state callback to race workspace restoration. Older membership success/error/finally work could then replace a newer result or clear the loading presentation. The resulting transient state could be rendered as empty/unavailable before authoritative membership resolution completed. R1 keeps account/session restoration and membership restoration explicitly loading, checks request generation/account identity in success and error paths, and treats request failure as recoverable error. The fix is covered by loading, stale-request, and recoverable-error transition tests. Physical cold-start repetition is pending Agent 10 device access.

### A-007 — Android Back reveals Sign In from authenticated Home

Successful auth previously entered an onboarding route and relied on later redirects; the root stack had no session-key reset and Home had no Android root Back guard. That left a path for stale auth history to be exposed. Auth now replaces to `/`, the root Stack remounts for a changed session revision, and Android Back at Couple Home root stays at that root. Device verification is pending Agent 10.

## Coverage and implementation limits

Vitest covers the required state transitions, including signed-out launch, cold/resume loading, no Weddings, selection restore/fallback, Wedding switch revisions, logout clearing, Account A/B isolation, confirmed membership loss, recoverable errors, stale generations, root-history key replacement, partner invitation identity preservation, and coordinator multi-Wedding restoration. The selection-storage tests also verify deletion on logout and a delayed write cannot re-create the logged-out selection after clear.

These automated tests do not mount Expo navigation or prove native Android Back behavior. Agent 10 must perform the physical Android acceptance scenarios. Until then, R1 remains pending physical QA; no physical acceptance is claimed here.
