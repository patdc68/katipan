# Mobile Places

## Routes and Stitch

The mobile Places flow uses:

- `/(wedding)/[weddingId]/places` — Our Places
- `/(wedding)/[weddingId]/places/search` — Place Search
- `/(wedding)/[weddingId]/places/new` — Add Custom Place
- `/(wedding)/[weddingId]/places/[placeId]` — Place Details and Wedding context

The entry is in **More**. Places does not add a bottom tab.

The implementation queried these screens in the **Katipan Wedding Planner UI System** Stitch project (`13691899610292683671`):

| Screen | Stitch ID |
| --- | --- |
| Our Places | `9892e26086f6483a860e7623217b63b8` |
| Place Search | `01598b9a511c4bcc96e80056ce9fee56` |
| Add Custom Place | `a5b765cecc1a448aaed754b1a6ef9f01` |
| Place Details | `50a8fd7ad4ba46768082e0cfef285dcf` |
| Ceremony & Venue Setup | `0f9939a7102c44be90e46e562eee8944` |

The screens use the **Warm Editorial Nuptial** shared tokens: warm ivory surfaces, espresso text, sage actions, antique-gold accents, rounded cards, and the existing Playfair Display / Plus Jakarta Sans typography. The Wedding name and partner names come from the selected Wedding membership; the canonical demo couple is Juan & Maria.

The Stitch connector returned temporary screenshot URLs, but this workspace had no available browser surface to open them. The screen records and design-system guidance were retrieved before implementation. The feature uses the shared system tokens and the route intent from those records; the resulting screens still need visual comparison with the Stitch images during physical QA.

## Google Places and Custom Places

`GOOGLE_PLACES` rows keep the Google Place ID and Katipan-owned context. Search results and current details are transient DTOs from the authenticated `google-places-search` and `google-place-details` Edge Functions. Mobile never calls Google directly and never persists a Google display name, address, or coordinate into `custom_*` fields. A saved Google Place refreshes its current name and address through the details Edge Function when the list or detail screen loads. A successful manager detail refresh also updates the existing refresh timestamp RPC.

`CUSTOM` rows require `custom_name`. Address and coordinates are optional, and latitude/longitude must be entered together and fall within -90..90 and -180..180. Only Custom Places receive `custom_*` data through the existing RPCs.

Google search requires two trimmed characters, waits 350 ms after typing, and sends only `weddingId` and query to Supabase. Search and detail requests go through the JWT-verified Edge Functions; the Google API key remains server-side. Active duplicate Google Place IDs open the existing Wedding Place, including when two saves race. Re-saving an archived Google Place may create a new active record because the database uniqueness rule applies only to active rows.

Google photos are not present in the Edge Function DTO. Place cards use a calm editorial icon block as the visual fallback; the mobile feature does not create photo URLs or add a photo backend.

## Type, purpose, and visibility

Place type is the physical classification. Purpose describes the Wedding's use for that Place. The type choices are the exact V1 enum values: `CHURCH_RELIGIOUS`, `GARDEN`, `BEACH`, `RESORT`, `HOTEL`, `EVENT_SPACE`, `RESTAURANT`, `PRIVATE_ESTATE`, `HOME`, `CIVIL_VENUE`, `DESTINATION`, and `OTHER`.

A Place can have multiple purpose assignments, including both `CEREMONY` and `RECEPTION`. Each assignment stores its sort order, optional purpose label, private notes, guest notes, and independent `guest_visible` setting through `set_wedding_place_purpose`. Removing one purpose calls `remove_wedding_place_purpose`; it does not archive the Place. The Guest Guide visibility summary counts visible purpose assignments and never treats one visible purpose as making every purpose visible.

Private notes remain in authenticated Wedding management views and are never included in Guest Guide projection fields. Guest notes are eligible only on a guest-visible purpose included by the published Guide projection.

## Guest Guide hydration relationship

The mobile client does not hydrate guest content. The existing server path owns that work:

1. `guest_wedding_guide` includes only active Places whose specific purpose is `guest_visible`.
2. Its place projection uses an explicit `user_label` ahead of the Google name, and excludes `private_notes`.
3. `guest_website` hydrates the sanitized projection with current Google names and addresses through `guest_guide_places.ts`.
4. The Guest Program wrapper includes a linked Google Place ID; the same server hydration fills `placeName` and preserves an explicit user label.

The migration and Edge Function tests cover archived/invisible exclusion, visible purpose inclusion, private-note omission, Google name/address hydration, label precedence, and linked Guest Program names. No Guest Guide hydration was duplicated in mobile.

## Archive behavior

Archiving calls `archive_wedding_place` after an explicit confirmation. It is a soft archive; the Place is removed from the active mobile list, cannot receive new purposes, and is excluded from Guest Guide place hydration. The client never hard-deletes a Place.

## Deferred physical QA

Check these interactions on Android and iOS devices:

- Search typing, the 350 ms debounce, and the two-character minimum
- Slow network, search errors, empty results, and detail hydration fallback
- Selecting and saving a Google result, including an already-saved result
- Opening the Google Maps link
- Custom Place entry, coordinate keyboards, and paired-coordinate validation
- Place type and purpose controls, including adding, editing, reordering by sort-order value, and removing purposes
- Per-purpose guest visibility and private/guest note separation
- Long Google addresses and narrow screen wrapping
- Confirmation behavior before archiving
- Keyboard overlap, safe areas, and general layout on Android and iOS

Physical QA is deferred and does not block implementation.
