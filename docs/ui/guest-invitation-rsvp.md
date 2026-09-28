# Guest Invitation and RSVP V1

## Routes and access

The guest flow is available on the existing Next.js Wedding website:

- `/w/{slug}/invitation`
- `/w/{slug}/rsvp`
- `/w/{slug}/rsvp/confirmation`
- `/w/{slug}` for the Wedding Guide
- `/w/{slug}/pass` for an eligible Guest Pass

The Household invitation token remains in the `token` query parameter while guests move among these Wedding routes. The token is a bearer credential. Pages validate its shape before making a request; the existing `guest-wedding-guide` Edge Function and database RPCs validate that it is active, unexpired, and belongs to the requested Wedding and Household. A well-formed token alone does not authorize access.

The Guide transport uses `cache: "no-store"`. RSVP form submission sends the token in the request body to the same-site `/api/w/{slug}/rsvp` Route Handler. The token is held in the page URL and component memory only. The flow does not write it to local storage, session storage, persisted query caches, analytics, or logs, and it is not put on unrelated outbound links.

For `INVITED_GUESTS_ONLY`, the Wedding Guide and invitation require a valid Household token. For `ANYONE_WITH_LINK`, public visitors can read the sanitized general Guide and invitation. A visitor without a valid Household token has no working RSVP submission path; the invitation shows a disabled RSVP action with a short access message. There is no public lookup by name, email, or phone.

The current Guide projection includes RSVP Guests in its enabled, guest-visible RSVP section. The Guide links to RSVP only when that section is present for the authorized Household. If the token-scoped projection has no named RSVP Guests, the dedicated route shows a guest-friendly unavailable message. Public allowance capacity is never used to invent respondents.

## Server-side mutation boundary

The browser never calls `guest_submit_rsvp` and never receives a service-role key. Live Supabase inspection confirmed that the RPC execute grant is restricted to `service_role`. The Next.js Route Handler is marked server-only and accepts one fixed payload shape: `slug`, `token`, `guestId`, `status`, `mealChoice`, `dietaryNotes`, and `responseNotes`. It checks that the body slug matches the route, rejects extra fields, validates the opaque token and Guest UUID shape, and permits only `ATTENDING` or `DECLINED`.

The handler makes one fixed PostgREST call to `guest_submit_rsvp` using the server environment key `SUPABASE_SERVICE_ROLE_KEY`. It does not accept a table or RPC name from the request. The database function remains responsible for confirming that the Guest belongs to the token-authorized Household in the slug’s Wedding. It updates the existing individual Guest RSVP row; repeated submissions do not create rows. Database errors are mapped to brief guest-facing messages and are never returned raw.

The existing `guest-rsvp` Edge Function also remains narrowly bound to the same RSVP RPC. Its public input validation permits `ATTENDING` and `DECLINED`; `NO_RESPONSE` remains an internal/default database state.

## Individual Guest responses

The RSVP form renders only named Guests in the authorized projection. Each Guest has an independent current status, Attend and Decline radio choices, and a separate Save action. “2 of 3 responded” is derived from those individual statuses. No Household RSVP record or client-side Household status is created.

Meal choice, dietary notes, and response notes are shown when Attend is selected and remain prefilled when editing an attending response. If a Guest changes to Decline, any existing values remain in the draft and are submitted with that response; the database owns any downstream behavior. Guests can change `ATTENDING` to `DECLINED` or the reverse while the invitation token remains valid.

The confirmation page lists only Guest names and response statuses for the authorized Household. It does not render meal choices, dietary notes, or response notes. Both the Guide and RSVP edit route remain available from confirmation.

RSVP submission calls only `guest_submit_rsvp`. The client does not directly mutate Seating, Guest Pass, or Check-In state. Existing database behavior, including any downstream review or cleanup, remains authoritative.

## Stitch comparison

Reviewed these exact screens in the Katipan Wedding Planner UI System:

- Guest Wedding Invitation (`8ddd56bf814c458ca5614d05a25663e5`)
- Katipan Guest RSVP Form (`dc03c9f7276641759b7dbb6f61a73756`)
- Katipan RSVP Confirmation (`c7664aafdf2c45188bc2f310b06a32c2`)
- Personalized Guest Wedding Guide (`7a148a1efc6f450f8e9d60a3e49d0b61`)

The implementation uses Warm Editorial Nuptial: ivory and template surfaces, Playfair Display headings, Plus Jakarta Sans body text, sage actions, champagne-toned rules, rounded cards, and the established mobile gutters. The invitation and confirmation keep the reference screens’ centered editorial hierarchy, ornaments, concise copy, Household guest list, response summary, and clear route actions. The Guide keeps its existing Wedding template presentation and adds token-preserving guest navigation.

Intentional deviations:

- The reference invitation has a couple portrait, countdown, and motif swatches. The sanitized Guide projection supplies no authorized invitation portrait, countdown, or separate motif palette for this flow, so the page uses the existing invitation text, Wedding date, location, and a typographic ornament without substituting reference imagery or invented wedding facts.
- The Stitch RSVP form groups a Household and presents a combined confirmation action. KATIPAN shows a separate response card and save action for each Guest, with native radio controls, because RSVP belongs to each individual Guest.
- Meal choices are text fields because the current backend contract supplies one nullable `meal_choice` string and no menu option catalog.
- The confirmation focuses on private Household response names and statuses. It omits table and pass details from the reference summary; Guest Pass remains available through its own route when the projection includes an active Pass.
- Dietary and response notes stay on the token-scoped RSVP form and never enter the general Guide render model or confirmation summary.

## Privacy and error handling

Invalid, expired, revoked, missing, or wrong-Wedding tokens do not produce an RSVP form. The database verifies Guest-to-Household membership; a browser-supplied Guest ID is not an authorization substitute. Unpublished websites, malformed requests, network failures, and duplicate clicks receive guest-friendly messages. The form prevents a second in-flight submission for the same Guest, then refreshes the authoritative projection after a successful update.

## Deferred physical QA

This branch is not blocked on physical-device testing. Deferred until core V1 integration:

- invitation deep-link behavior
- mobile RSVP form ergonomics
- keyboard behavior
- multi-Guest Household editing
- validation messages
- confirmation flow
- Safari and Chrome behavior
- accessibility checks on real devices

## Recommended next slice

Complete core V1 integration, then run the deferred physical QA across the invitation, multi-Guest RSVP, confirmation, and Guest Pass routes.
