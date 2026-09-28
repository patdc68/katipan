# Mobile Guest Program

Guest Program management lives at `/(wedding)/[weddingId]/website/program`, with `new`, `[itemId]`, and `preview` routes. More opens the list; linked Run-of-Show items open the editor. The route stays outside the five bottom tabs.

## Stitch composition

**There is no dedicated standalone Guest Program screen in the Stitch inventory.** The editor composes the Warm Editorial Nuptial system from Invitation / Website Editor (`34734c9d38064818b0345ea04f48c6c5`), Website Sections & Visibility (`40ccf6e508c044c4b642b39e185ea2a8`), Preview & Publish (`7d0bb3d1cca64d97be9babc32ad866f0`), Personalized Guest Wedding Guide (`7a148a1efc6f450f8e9d60a3e49d0b61`), and Run of Show (`68915eefe91d43d2a4141f030b2dc9e6`). The editorial heading, warm canvas and ivory cards, sage actions, champagne review notice, section hierarchy, and status chips use existing shared UI tokens and components. Sample wedding facts are never embedded in production logic; the canonical demo couple is **Juan & Maria**.

Intentional deviations from the static references: date/time fields and link/place choices are native controls for an editable flow; publication and review have separate confirmations because the backend treats them as distinct actions; the preview is a Wedding-team projection of the published program because there is no general secure Guest Guide web route yet. It does not claim to be an authenticated guest session or bypass website access rules. A website that is not published is explicitly marked unavailable to guests. The program list shows actual server rows and an explicit empty state instead of illustrative events.

## Data and write boundary

`wedding_day_items` remains the operational Run of Show. `guest_program_items` is the independent guest-facing schedule. Linking with `operational_item_id` never synchronizes timing. The database trigger marks linked program items `review_required` after an operational timing or status change, leaving guest-facing timing and publication intact. The editor shows operational scheduled/actual times, status, and current guest time side by side. A proposed copy of operational scheduled time is shown and selected explicitly before the user confirms an update. There is no automatic cascade or actual-time copy.

The client uses RLS-protected direct `guest_program_items` writes only for:

- Insert: `wedding_id`, `operational_item_id`, `title`, `description`, `scheduled_start`, `scheduled_end`, `place_id`, `sort_order`. The database default keeps new items unpublished.
- Update: `operational_item_id`, `title`, `description`, `place_id`, `sort_order`.
- Delete: a same-Wedding item after an explicit screen confirmation.

Guest-facing time, publication, and review metadata are never direct-updated. `set_guest_program_publication` with `UPDATE` and an explicit `p_scheduled_start` changes schedule or publishes/unpublishes. A schedule-only action leaves `p_publish` unset and preserves publication. `KEEP` resolves a pending review without changing time or publication. Unpublishing an already published item requires confirmation. Saving descriptive content neither publishes nor changes schedule. The existing database grants and RPC remain authoritative.

Title, required start, end after start, and nonnegative order are validated in the client and database. Place and operational choices come from the selected Wedding; each write rechecks their Wedding scope, and composite foreign keys provide a final server guard. Item reads, updates, deletes, and publication prechecks are Wedding scoped. Selected Wedding or membership changes change the load key and invalidate screen data.

## Permissions and guest preview

Active Owner and Full Coordinator memberships see management actions. Day-of Coordinator and Guest Coordinator may read visible member data but receive no create, edit, delete, publish, or review controls. The existing coordinator-managed controller path remains enforced by database policy and RPC. The client never treats hiding a button as authorization.

The list labels **Draft**, **Published**, and **Review Required** separately. The preview filters `is_published = true`, follows `sort_order`, and excludes drafts. This matches the existing sanitized `guest_wedding_guide` program projection, verified in `20260926140232_guest_program_media.sql` and `20260928033653_guest_pass_guide_name.sql` and against the live function. Website publication and access mode still decide whether an actual guest can open the guide. The preview states whether the website itself is published and does not reveal a guest token. No public route or backend projection was changed in this slice.

## Verification

Model and API tests cover role gating, validation, ordering, published-only filtering, unpublished creation, standalone and linked items, same-Wedding link/place checks, descriptive-only update, delete, explicit publish/unpublish and schedule RPC calls, KEEP/UPDATE review arguments, cross-Wedding item rejection, and duplicate-submit gating. The existing `guest_program_media.test.sql` covers backend grants, role behavior, trigger independence, and guide inclusion/exclusion. No migration was needed.

## Deferred physical QA

- Date/time pickers and timezone display.
- Publish/unpublish confirmation.
- Operational comparison layout.
- Long program lists.
- Preview navigation.
- Android/iOS rendering.

Full physical QA remains deferred until core V1 integration.
