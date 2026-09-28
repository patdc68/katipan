# Mobile Seating

This slice adds Reception Seating to the selected Wedding workspace. The four implementation references are the Stitch screens in **Katipan Wedding Planner UI System**:

- Seating Overview — `37bcf12ade174183b05931169b2ec437`
- Seat Assignment — `8a10dd97f2ad437283fea964b0e22f05`
- Table Details — `d15b81832e8f4eb292e4864a292c8cf5`
- Assign Guests — `2af9a48db3824804b0e4e0a7af812204`

The screens use Warm Editorial Nuptial: the existing ivory surfaces, sage actions, champagne accents, Playfair Display headings, Plus Jakarta Sans body text, rounded editorial cards, and the current Wedding/Guests shell. Seating is linked from Guests and remains outside the five production tabs.

## Stitch comparison

- **Seating Overview:** Keeps the Reception event heading, visibility, seated and unseated counts, total capacity, Table count, and Table occupancy list. It uses the existing compact mobile cards and offers an explicit empty state before a manager creates the Reception event. No Tables or Guests are seeded.
- **Seat Assignment:** This is the selected-Table state of the same assignment flow used by Assign Guests. Both resolve to `/seating/assign` and use the existing `seating_assignments` model.
- **Table Details:** Keeps Table identity, shape, capacity and occupancy, zone and notes, named Guests with Household context, plus optional exact Seats. Edit, assign, move, unseat, and delete actions use the established Guest and Household card language.
- **Assign Guests:** Keeps the target Table context, RSVP filters and Guest rows, selection, RSVP status, and an explicit assignment action. A move edits the existing Guest/Event assignment atomically through `seat_guest`.

## Intentional deviations

The Stitch Seat Assignment and Table Details references show Seats in a spatial diagram. The checked-in `seating_seats` contract stores only a Seat label and sort order; it has no position or geometry fields. The mobile implementation therefore presents optional exact Seats in an ordered, accessible label list and picker. It does not invent floor-plan coordinates or a second seating model.

The two assignment references are workflow views, not separate sources of seating data. The selected Table opens the shared Assign Guests route. Each Guest remains an individual assignment; Household membership is supporting context and may be split after a confirmation.

On a Wedding without a Reception event, the overview shows an empty state. A manager creates the event explicitly; entering the screen does not write data. Seating visibility only controls guest-facing visibility. It does not alter internal access, RSVP, Guest Pass, or check-in.

## Deferred physical QA

- Table selection and Guest assignment tap ergonomics on Android and iOS.
- Long Guest lists and the RSVP filter row on small screens.
- Table occupancy and capacity presentation with many Tables.
- Household split confirmation wording and recovery.
- Exact Seat label picker with many Seats and occupied positions.
- Destructive Table and occupied Seat confirmations on small screens.

Full Android end-to-end QA remains scheduled after the core V1 feature set is integrated.
