# Phase 1B Wedding lifecycle and settings contract

## V1 sources of truth

`public.weddings.status` is the Wedding-level operational setting. The migration adds `archived_from_status` solely to restore the prior state and `deletion_requested_at`/`deletion_nonce` solely to coordinate permanent deletion. No general settings table or duplicate privacy toggle is needed in V1.

| Concern | Authoritative source |
| --- | --- |
| Wedding operational state | `weddings.status` |
| Wedding profile | Existing `weddings` columns |
| Website publication and access | `wedding_websites.is_published` and `access_mode` |
| Section audience | `wedding_website_sections.audience` |
| Seating visibility | `seating_events.visibility` |
| Notification preferences | User + Wedding preference tables |
| Guest list privacy | RLS and controlled projections; always private |

## State behavior

| State | Member planning | Guest Guide / RSVP / Pass retrieval | New household tokens and partner invitations | Wedding notifications | Website publishing |
| --- | --- | --- | --- | --- | --- |
| `DRAFT` | Allowed by existing roles | Unavailable | Partner invitations allowed; household tokens blocked | Suppressed | Blocked |
| `ACTIVE` | Allowed by existing roles | Available when the site is published and token/access rules pass | Allowed | Allowed | Allowed |
| `COMPLETED` | Existing member records remain available; activate reopens operations | Unavailable | Blocked | Suppressed | Blocked |
| `ARCHIVED` | Existing member records remain available for restoration/deletion | Unavailable, even if `is_published` remains true | Blocked | Suppressed; pending delivery skipped | Blocked |

The centralized `private.wedding_allows_guest_access` predicate requires `ACTIVE` and no pending deletion. It is used at the public guide, RSVP, publication, Household token, and notification boundaries. Guest Pass member retrieval and scanning already require `ACTIVE`. Existing RSVP, Guest, seating, and Pass rows are not changed by state transitions. Website publication and existing Household tokens remain stored during archive; restoring a previously active Wedding resumes the same valid guest access. Completed Weddings must be explicitly reactivated before guests can access the site again.

`activate_wedding` accepts `DRAFT` or `COMPLETED`; `complete_wedding` accepts `ACTIVE`; `archive_wedding` accepts any non-archived state; `restore_wedding` returns to the recorded prior state. An active couple-owned Wedding must have an active Owner. All transitions lock the Wedding and caller membership. A couple-owned Wedding requires an active `OWNER`; a coordinator-managed Wedding requires the original creator to remain its active `FULL_COORDINATOR`. An ordinary Full Coordinator of a couple-owned Wedding cannot control lifecycle.

## Distinct destructive workflows

`leave_wedding` and `remove_wedding_member` retain their existing meanings and guards. Archive is reversible and retains all Wedding data. Permanent Wedding deletion is a separate `delete-wedding` Edge workflow: the authorized manager confirms the exact Wedding name, `request_wedding_deletion` seals and archives the Wedding, the service-role function lists Storage objects under its Wedding prefix, the Edge Function deletes those objects through the Storage API, and `finalize_wedding_deletion` verifies that no objects remain before deleting Wedding-owned database rows. Pending deletion is retryable and cannot be restored. The Storage write trigger serializes uploads with the deletion lock. Auth users are never deleted by this path.

`delete-account` is a separate authenticated Edge workflow. `prepare_self_account_deletion` locks all active memberships, rejects a final Owner or coordinator-managed controller, marks eligible memberships `LEFT`, unlinks the account from Wedding People, and clears its profile/notifications/preferences. The Edge Function then uses Auth Admin **soft deletion** with its server-held service credential. This keeps historical actor foreign keys valid while disabling the Auth account. A trigger prevents a soft-deleted account from creating or rejoining a Wedding with a still-valid JWT. The Auth deletion trigger also refuses deletion if an active Wedding membership reappears between preparation and the Auth call. If Auth Admin fails, the caller may retry; Wedding data remains intact. Historical invitation and check-in actor identifiers remain as audit references to the tombstoned Auth row.

Neither Edge Function accepts a caller-supplied user ID. Both validate the caller's bearer token with Auth. Their service credential stays in the Edge environment and is never returned.

## Security notes

`private.wedding_invitation_secrets` has RLS enabled and no client policies. Existing token issuance/acceptance remains inside narrowly authorized definer workflows. Lifecycle definer functions use `auth.uid()`, a locked `search_path`, Wedding row locks, and explicit role checks. Service-only deletion functions require the service-role JWT and are not granted to `anon` or `authenticated`.
