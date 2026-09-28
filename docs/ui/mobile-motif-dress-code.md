# Mobile Wedding Motif and Dress Code

## Stitch screens and design system

This slice uses the **Warm Editorial Nuptial** design system from Stitch project `13691899610292683671` and queried these matching screens:

- **Dress Code & Wedding Motif** — `32592b422653485da231c8a52992e638`
- **Wedding Motif & Onboarding Complete** — `cc9eb4285dd846fea49152bcc8c4f6e6`
- **Personalized Guest Wedding Guide** — `7a148a1efc6f450f8e9d60a3e49d0b61`

Stitch returned mobile screen records with 780 px canvas metadata and transient screenshot/HTML download URLs. The available browser surface was empty, and those URLs were inaccessible through the web tool, so pixel-level screenshot and HTML comparison could not be completed in this environment. The implementation follows the shared Warm Editorial Nuptial tokens already used by the mobile foundation: Playfair Display headings, Plus Jakarta Sans body copy, the ivory canvas, sage actions, champagne accents, rounded cards, and 20 px gutters.

## Motif and Dress Code are separate

Wedding Motif describes the Wedding aesthetic. Its title, description, planner notes, palette, and inspiration images are managed through `wedding_motifs`, `motif_colors`, and `motif_inspiration_attachments`.

Dress Code tells Guests what to wear. Its free-text title, description, venue advice, general notes, recommended colors, avoid colors, and inspiration images are managed through the Dress Code tables. Saving a Motif never creates or copies Guest attire colors.

Motif notes are shown only in the authenticated planner. The Guest Guide continues to use its existing sanitized projection.

## Color hierarchy

The planner keeps each collection separate:

1. Motif colors describe the overall Wedding look.
2. General Dress Code recommended and avoid colors guide Guests.
3. An Attire Group can specialize the general guidance for matching Guests.
4. Guest-specific colors apply to one Guest's explicit special case.

Input accepts six hexadecimal digits with an optional `#` and writes uppercase `#RRGGBB`. Recommended and avoid collections stay separate. If a color appears in both lists, the planner shows a review message and leaves both records intact.

## Attire Groups and targeting

Attire Group titles are Wedding Dress Code data, not a fixed category list. Groups hold optional descriptions and instructions, independent recommended/avoid colors, and inspiration images.

A group can target individual Guests, Entourage roles, or both. The planner references the existing Guest and role rows without changing Guest identity, RSVP, Seating, or Entourage membership. Each assignment is scoped to its Wedding and group. A Guest can remain assigned to several groups; adding one target never clears another group's assignment.

## Guest-specific override

Individual Guest Details links to a separate Guest Attire Guidance screen. It shows the general Dress Code, groups currently applicable through direct Guest targets or existing Entourage roles, and the selected Guest's own optional title, required instructions, notes, and colors. The screen does not repeat Guest Details editing or compute a second effective projection.

The Guest Guide backend remains authoritative. Its current precedence is Guest-specific instructions/colors, then applicable Attire Group guidance, then general Dress Code guidance. The mobile planner shows each source separately so a manager can see where guidance came from.

## Inspiration attachments

Motif, Dress Code, and Attire Group images use the existing Attachment lifecycle: reserve the Wedding-scoped object, upload to the private `wedding-files` bucket, confirm the upload, then create the corresponding inspiration link. Only `GUEST_VISIBLE` and `WEDDING_MEMBER_PRIVATE` are offered. The default is planner-only. Signed URLs are short-lived and held in memory for viewing.

Removing an inspiration image confirms and deletes only the selected styling link. It keeps the underlying Attachment available for any other link or later reuse. Resetting a Motif, Dress Code, or Attire Group also confirms before cascading away its inspiration links. Failed uploads use `mark_attachment_deleted` and Storage cleanup where possible; client code never directly changes Attachment status.

## Guest Guide integration

Guest-visible inspiration remains filtered by the existing Guest Guide projection to eligible `GUEST_VISIBLE`, `AVAILABLE` Attachments. Planner-only media stays out of the guest projection. The existing guide parser and database/Edge tests remain responsible for general Dress Code colors, avoid colors, personalized guidance, applicable Attire Groups, Guest-specific overrides, and attachment visibility. This feature does not modify those backend projections.

The Guest-specific planner route renders only the selected Guest's guidance and matching groups. It is an authenticated planner screen, separate from the token-scoped public Guest Guide projection.

## Permissions and Wedding isolation

All active Wedding members can read styling data where RLS allows. Edit controls are shown to Owners and Full Coordinators, including the valid coordinator-managed controller path. Day-of and Guest Coordinators see read-only styling screens. The API scopes reads and writes by the active Wedding, confirms target Guest/role rows, and relies on existing RLS and same-Wedding foreign keys for final authorization.

The workspace hook keys the styling response to Wedding ID, membership, and workspace cache revision. Changing Wedding invalidates the old styling response before the new one is rendered.

## Intentional deviations from Stitch

- The three requested screen render URLs were returned by Stitch but could not be opened in the available environment. Shared Warm Editorial Nuptial tokens were used; no pixel-perfect match is claimed.
- Image selection uses the installed Expo document picker and existing Attachment lifecycle rather than introducing a new picker or permanent image URL.
- Color editing uses validated hex text input plus swatch previews because the project has no established native color-picker component. Native color picker and reordering ergonomics remain in physical QA.
- The workspace is linked from More and Guest Details. It does not add a bottom tab.
- The Guest Guide's sanitized projection remains the source of truth for effective guest-facing attire.

## Deferred physical QA

- color input/picker ergonomics
- palette reordering
- Attire Group management
- multi-select Guest targeting
- Entourage role targeting
- Guest-specific guidance
- inspiration picker/upload
- image viewing
- Android/iOS layouts
- Guest Guide media display
