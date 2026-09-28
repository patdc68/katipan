# Wedding Website and Guest Guide V1

## Routes and implementation

Mobile management starts from More at `/(wedding)/[weddingId]/website`, then opens `templates`, `sections`, and `preview`. The existing Guest Program remains at `website/program`. Household Details owns one-time Website access link issue and revocation. The canonical guest route is the Next.js `/w/[slug]`; the existing `/w/[slug]/pass` remains the dedicated QR experience. No Expo guest route replaces it.

The planner uses RLS-protected `wedding_websites` and `wedding_website_sections` writes for editable configuration. It calls `publish_wedding_website` for publication, and `issue_household_website_token` / `revoke_household_website_token` for Household access. No client reads `private.household_website_tokens`. A new issue action invalidates the previous Household link, returns the server-generated secret once, and leaves invitation-delivery state unchanged. Normal loads never issue a token. Revocation leaves Household, Guest, RSVP, Guest Pass, and seating records intact.

## Templates

The five persisted enum values are `SAMPAGUITA`, `LUNTIAN`, `FILIPINIANA`, `MODERN_LOVE`, and `AFTER_DARK`. The gallery displays all five, and the guest route applies a corresponding editorial palette. Template changes write `template_key` only. Guest records, RSVP, program, places, seating, permissions, and section audience keep their existing sources and semantics. No unbundled stock image is substituted for the Stitch photography.

## Sections and audiences

`INTRO`, `PLACES`, `DRESS_CODE`, `RSVP`, and `CUSTOM` use `wedding_website_sections`; Guest Program is separate. Managers can add the four standard types when absent, add/delete `CUSTOM`, edit `INTRO`/`CUSTOM` content, set enabled and audience, and move sections in the ordered list. Nontext section content comes from its domain records. New sections start disabled and hidden. The backend projection excludes disabled and `HIDDEN` sections. `PUBLIC` is eligible without Household context when website access allows it. `INVITED` and `PERSONALIZED` need a valid Household token. The web parser repeats that public filter as a defense in depth. An enabled guest-visible RSVP section links token-scoped Guests to the individual RSVP flow. The Guide parser still strips private meal and response notes; see [Guest Invitation and RSVP V1](guest-invitation-rsvp.md).

## Publication and preview

Website publication is an explicit confirmed action. Unpublishing keeps configuration, sections, and Guest Program. Neither action issues tokens, sends invitations, nor marks delivery. The planner preview labels configured content as **Draft / editor preview** and may include hidden or unpublished sections for the manager. The **Live published guest experience** panel opens the real public route only when published and `ANYONE_WITH_LINK`; invited-only live access needs a real Household link. Published Guest Program items are shown separately from draft items in preview.

## Guest projection boundary

The Next server calls the existing `guest-wedding-guide` Edge Function with the publishable key and `cache: no-store`. The Edge Function calls the final `public.guest_wedding_guide(slug, token)` wrapper using its server-side credential. The Next route parses a narrow render model and passes only rendered fields to the page. It does not read raw planner/private tables or place a service-role credential in browser code. Its render model discards QR payloads, RSVP dietary/response notes, private contacts, unknown fields, and operational schedule metadata. The Pass link appears only when an active eligible Pass is projected; QR remains on `/w/[slug]/pass`.

The Guide displays title, Wedding context, eligible intro/custom sections, guest-visible Places, Dress Code and recommended colors, Household attire and entourage guidance where projected, published Guest Program, visible seating, and the Pass link where eligible. Seating follows the projection: hidden yields no row, table-only yields a table, and exact seat appears only when supplied. It never independently queries seating. Invalid, revoked, foreign-Wedding, and foreign-Household tokens are rejected by the server token lookup; the page maps failures to generic messages.

## Stitch review and deviations

Queried the six exact Stitch screens: Invitation / Website Editor (`34734c9d38064818b0345ea04f48c6c5`), Website Sections & Visibility (`40ccf6e508c044c4b642b39e185ea2a8`), Template Gallery (`03964055b9864036ace57eb7a51fc725`), Preview & Publish (`7d0bb3d1cca64d97be9babc32ad866f0`), Personalized Guest Wedding Guide (`7a148a1efc6f450f8e9d60a3e49d0b61`), and Guest Wedding Invitation (`8ddd56bf814c458ca5614d05a25663e5`). Warm Editorial Nuptial supplies the ivory canvas, Playfair headings, Plus Jakarta Sans body, sage actions, champagne accents, rounded cards, and mobile gutters. The Stitch MCP returned transient screenshot/HTML URLs rather than inline assets; download was blocked in this environment and no browser was available, so pixel-level visual comparison remains deferred.

Intentional changes from the references: the gallery uses typographic color studies instead of unbundled imagery; publication and invitation delivery have distinct actions; the planner draft preview clearly labels hidden/unpublished content; token-scoped RSVP uses a dedicated individual Guest flow; and the dedicated Pass page remains the QR surface. Actual Wedding data replaces reference examples; Juan & Maria is the canonical demo couple only in tests and documentation.

## Verification and Deferred physical QA

Client tests cover slug shape/collision mapping, five templates, role gating, configuration writes, section management and ordering, audiences, publication RPC separation, Household issue/revoke calls, duplicate-submit protection, public and invited parsing, safe errors, field stripping, seating and attire shapes, and Pass-link eligibility. Existing database SQL fixtures cover server access modes, Household/Wedding isolation, revocation, published Guest Program, attire, seating visibility, and function grants. No migration was needed. Live schema inspection confirmed current function wrappers, RLS policies, and service-only Guide RPC grant. The relevant local pgTAP run was attempted but the local Postgres port refused connections; Docker and Podman are not installed in this environment. No production data was modified for testing.

**Deferred physical QA:** Template Gallery interactions; mobile section reordering; slug editing UX; publish confirmation; public/private Guest Guide navigation; invitation-token deep links; Android/iOS planner rendering; mobile Safari/Chrome Guide rendering. Full integrated physical QA remains deferred.

## Recommended next slice

Complete core V1 integration and then run physical QA for the invitation and RSVP guest routes.
