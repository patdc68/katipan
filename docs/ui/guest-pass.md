# Guest Pass V1

## Stitch review

Inspected the exact Stitch **Wedding-Day Guest Pass** screen (`a1de105df6424e7ba6f1bc15ecd82d86`) and **Individual Guest Details** screen (`7cf62a6980ed4508ac37bc34d467f659`) in the Katipan Wedding Planner UI System. The base is Warm Editorial Nuptial: ivory surfaces, Playfair Display headings, Plus Jakarta Sans body text, sage controls, champagne hairlines, rounded cards, and mobile page gutters.

The guest page uses the Stitch hierarchy for wedding context, an individual pass holder, a high-contrast QR on white, a separate human-readable reference, and current seating. A Household with several active passes gets named Guest choices; only the selected Guest's QR is displayed. The admin capsule is added to the existing Individual Guest Details card hierarchy.

## Access and data

- `/w/[slug]/pass` requires the existing Household invitation token. The Next server page calls the existing `guest-wedding-guide` Edge Function with `cache: no-store`; the Edge Function calls the sanitized `guest_wedding_guide` RPC.
- The route passes only the parsed Guest Pass projection and wedding context into its client component. It does not query Guest, Wedding Person, or private Guest Pass tables.
- Each pass name is the persisted Wedding Person display name from the Wedding-scoped Guest Guide projection. The pass parser does not invent a name or pass through other Wedding Person fields.
- The QR renderer receives the opaque `qrPayload` unchanged. It uses dark modules on white with a four-module quiet zone and no overlay. The reference appears separately as a fallback.
- The browser pass selector and admin preview keep raw QR values in component memory. They do not write them to local storage or log them. Browser printing uses the current pass without issuing or rotating another one.
- Guest Guide seating is read on each request. No seating is shown when the sanitized projection is empty; a table-only projection shows the Table, and a seat label appears only when the backend included it.

## Planner behavior

- Pass administration uses `get_guest_pass`, `issue_guest_pass`, `revoke_guest_pass`, and `rotate_guest_pass` through the authenticated mobile Supabase client.
- Planner actions are shown only to an active Owner or Full Coordinator. Guest Coordinator and Day-of Coordinator actions are hidden. The RPC authorization remains authoritative, including the coordinator-managed controller path.
- Issue and rotation are offered only for an Attending Guest. RSVP and seating are not changed by Pass actions. Revoke and rotation require an explicit confirmation.
- The existing read RPC returns only an active Pass. After an explicit Issue action, the existing issue RPC safely reports when a previous Pass was revoked; the screen then offers explicit Rotate. Reopening the details screen never issues or rotates a Pass.

## Intentional deviations

- The Stitch Guest Pass reference includes a broader Wedding Guide, example schedule and attire sections, and a simulated scan/check-in state. This route presents only the requested individual Pass and guest-visible seating. Scan simulation, scanner UI, and check-in mutation are omitted from this slice.
- The Stitch Individual Guest Details capsule uses check-in language. The implementation uses Guest Pass wording for its management section and preview; check-in history stays independent.
- Browser print is available for the currently selected pass. The page does not add a share control that would redistribute the Household invitation URL.
- Stitch reference data is illustrative. The implementation uses the selected Wedding and the sanitized invited Household projection; the canonical demo couple remains Juan & Maria.

## Deferred physical QA

- QR readability and scanning on real Android and iOS devices.
- Screen brightness and readability at the wedding entrance.
- Switching among several named Guests in one Household.
- Safari and Chrome share/print behavior.
- Presentation of the current Table and Seat after a seating change.

## Recommended next slice

Wedding-Day check-in integration, with a separate authorized scanner flow and explicit mutation/history handling.
