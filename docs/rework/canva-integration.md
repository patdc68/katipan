# Canva V1 architecture — design only

Canva integration is approved for invitation artwork only. Agent 08 owns product semantics; Agent 02 owns future secure server/Edge and schema implementation. No connection, credential, OAuth registration, provider call with user data, table, function or deployment is created in R0.

## Proposed user flow

Connect Canva -> authorize via OAuth -> select an accessible design or create one -> open design in Canva -> provide the KATIPAN RSVP link/QR -> optionally upload QR image to the user's Canva assets -> user edits artwork in Canva -> return to KATIPAN -> link/export the final design -> explicitly distribute invitation -> Guest responds through KATIPAN.

The existing Guest/RSVP flow works independently of Canva. Do not gate invitation authorization, RSVP, Website/Guide, Guest Program, Seating, Pass or check-in on an active Canva connection. Native invitation template gallery/artwork/typography/layout editing concepts are SUPERSEDED_BY_CANVA; current website theme and section controls remain until a separately audited UI change.

## External API evidence and limits

Official documentation checked 2026-11-16 redirects former Connect API pages into the Canva Developers SDK REST API documentation. Use a user-authorized app with authorization code + PKCE; exchange credentials on the server. Account capabilities/scopes and app publication/review requirements must be verified before implementation; this design does not claim the KATIPAN integration is registered or approved. [Authentication](https://www.canva.dev/docs/apps/rest-apis/authentication/).

Use the documented design creation and listing APIs with least scopes; opening/editing occurs in Canva, never in an embedded KATIPAN graphic editor. Refresh provider metadata after return and validate access to the returned design, rather than trusting a callback ID. [Create design](https://www.canva.dev/docs/apps/rest-apis/reference/designs/create-design/), [List designs](https://www.canva.dev/docs/apps/rest-apis/reference/designs/list-designs/), [Return navigation](https://www.canva.dev/docs/apps/rest-apis/return-navigation-guide/).

Optional asset upload is an asynchronous job and must expose pending/failure/retry outcomes. Downloadable QR image and copyable secure link remain the fallback. Export is likewise a provider job; poll boundedly and do not present a timeout as a successful export. [Asset upload](https://www.canva.dev/docs/apps/rest-apis/reference/assets/create-asset-upload-job/), [Export job](https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/).

No Canva Pro-only feature is mandatory. Test the selected basic design/edit/export path with a free account and avoid paid assets; if an account cannot export a particular design, offer a supported format or link/reference/manual export. Autofill and premium brand-template automation are future/optional enhancements, not a prerequisite or automatic V1 scope expansion.

## Proposed trust boundaries

| Boundary (conceptual endpoint names) | Required behavior |
| --- | --- |
| canva-oauth-start | Verify KATIPAN session; bind one-time state and PKCE verifier to initiating account, Wedding and allowed return destination; short expiry |
| canva-oauth-callback | Verify state/replay/expiry and initiating account; exchange code server-side; never send provider tokens in deep links; consume state exactly once |
| canva-status / disconnect | Return sanitized connection/scopes/expiry state; revoke server-side and clear credential material; design references may remain marked disconnected |
| canva-designs list/create/link/open | Verify live Wedding capability and connection owner; do not allow one coordinator's connection to become accessible to all members; validate provider design access |
| canva-rsvp-asset | Consume Agent 05-authorized link/QR only after an explicit upload action; upload only required image bytes, no Guest roster or response data |
| canva-export | Reauthorize design and Wedding; start/poll job with bounded retries; reserve/confirm Attachment for bytes intentionally retained in KATIPAN |

Use Edge/server-only adapters rather than provider requests from Expo/browser. Check Supabase session authenticity and current membership at every operation; do not trust request Wedding/user IDs or user_metadata. Proposed artwork capability: OWNER and permitted FULL_COORDINATOR, including coordinator-managed controller, subject to Agent 02 capability audit; Day-of/Guest Coordinator excluded unless an explicit later contract grants access. A connection belongs to its linking user; collaborators may see authorized Wedding design metadata, not credentials or unrestricted Canva account contents.

Account/Wedding switch during OAuth or export must not attach results to the new context. Allowlist return origins/routes and provider URLs; never accept arbitrary redirects or fetch arbitrary export URLs (SSRF). Keep provider and application error details out of guest responses. Serialize refresh per connection and atomically replace refreshed credentials; a concurrent refresh must not overwrite a newer token. Revocation/expiry yields reconnect, not silent credential fallback. Reauthorize queued work after membership loss.

## Credentials and persistence classification

| Data | Classification | May persist / location | Client visibility |
| --- | --- | --- | --- |
| Client identifier | Public identifier, not a secret | Environment/application configuration | May be public; it grants no authorization |
| Client secret | Server-only secret | Edge/server secret manager, never repository or public env prefix | Never |
| Access token | Server-only bearer credential | Prefer short-lived memory; if persisted, encrypted in private connection storage with restricted server access | Never |
| Refresh token | Server-only long-lived credential | Encrypted private connection storage; key held separately in server secret manager; rotate atomically | Never |
| Scopes | Non-secret capability metadata | Private connection record; sanitized capability flags to initiating account | Only relevant safe flags |
| Expiry / refresh timestamps | Non-secret operational metadata | Private connection record | Sanitized reconnect/status information |
| Revocation / disconnect | Lifecycle metadata | revoked_at/status retained for audit; delete or render credentials unusable | Sanitized status |
| OAuth state / PKCE verifier / code | Temporary security material | Short-lived server-only state store, account/Wedding-bound; one use; code discarded after exchange | Only protocol-required state/challenge/redirect, never verifier or code in logs |

Proposed `private.canva_connections`: linking KATIPAN user, Canva account reference, encrypted token material/key version, granted scopes, expiry, refresh concurrency/version, revoked status and audit timestamps. No raw client access. Proposed `public.wedding_canva_designs`: Wedding ID, linked connection reference (no credentials), provider design ID, safe display metadata, linking actor, status, optional export Attachment ID and timestamps. Use same-Wedding constraints, unique design association where appropriate, membership RLS, restricted grants and no secrets in public rows. Final columns/schema and deletion retention require Agent 02 review; these names are conceptual, not generated types.

Canva-owned artwork stays in Canva. Any copy explicitly retained by KATIPAN uses Supabase Storage and centralized Attachment metadata; domain records store Attachment IDs, not transient export or signed URLs. Do not introduce another storage provider or store bytes in PostgreSQL.

## RSVP QR privacy and lifecycle

Agent 05 generates the authorized KATIPAN link semantics; 08 may present or export its QR image. A Household bearer URL embedded in artwork grants access to that Household, so upload/export/distribution must be deliberate and restricted to its intended recipients. Never reuse one Household's QR on a generic public invitation or share it with another Household. Generic artwork may use a public KATIPAN link, but public visitors still cannot RSVP without invitation authorization. Do not auto-issue or rotate tokens on design open, edit, reconnect or export.

Uploading a token-bearing QR to Canva is a transfer of that bearer credential embedded in an image. Explain this at the action; retain a download-only/manual placement alternative. Keep QR bytes transient unless an explicitly private Attachment is needed; never put credentials in analytics, logs, public buckets, generic previews or provider metadata titles. Revoking an invitation makes already distributed QR artwork stop authorizing access; only explicit reissue/re-export updates it. Guest Pass QR is never the Canva invitation QR and is never uploaded by this workflow.

## Gate 6 acceptance

Test connect/cancel/invalid state/expired callback/replay, account switch, scope denial, free-account create/select/open, return and permission recheck, upload unsupported/failure/manual fallback, export pending/failure/retry, reconnect/revocation and collaborator denial. Test real intended-recipient QR scan into KATIPAN, wrong Household rejection and independent RSVP responses. Website publication, guest-safe Guide, separately published Program, Seating visibility and stable Pass must still work when Canva is disconnected. No migration or feature implementation is authorized by this architecture document.
