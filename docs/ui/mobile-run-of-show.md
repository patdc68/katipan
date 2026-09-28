# Mobile Run of Show

The operational Run of Show is available at `/(wedding)/[weddingId]/plan/run-of-show`, with `new` and `[itemId]` routes for creation and details. Wedding-Day Dashboard opens the timeline; returning to it refreshes `wedding_day_dashboard` so current, next, and delayed cards remain server derived. No bottom tab was added.

## Stitch comparison

Inspected the exact Run of Show screen `68915eefe91d43d2a4141f030b2dc9e6` and rechecked selected Wedding-Day Dashboard `885c999629214018a0d49eb0cbf8553b` in **Katipan Wedding Planner UI System**. The list follows the Run of Show's editorial heading, sage filter pills, amber delay attention card, compact current/attention summary, vertical timeline rail, ivory item cards, status chips, place and responsible team lines, and operational versus Guest Program labels. The dashboard retains the selected arrival-first composition and its current/next/delayed server aggregate.

Warm Editorial Nuptial shared tokens supply surface, sage, champagne, typography, spacing, and card shape. All timeline content comes from the active Wedding. The Stitch sample name and cue facts are not production data; the canonical demo couple is **Juan & Maria**.

Intentional deviations:

- Stitch's “Key Milestones” filter is omitted because V1 operational items have no milestone attribute. The list filters only real backend statuses.
- Stitch's illustrative “+15m Shift” and impact modal are replaced with an accurate delayed warning and item-by-item editing. The backend has no automatic suggested shift, and a delay does not authorize changing later items.
- Stitch's static card artwork, crew notifications, pacing delta, and check-in count inside a timeline cue are omitted because they have no Run-of-Show item contract. The Wedding-Day Dashboard retains its own attendance aggregate.
- Item details, date/time controls, responsibility selection, and Guest Program review use native screens and shared controls. They add the interaction needed to operate the static Stitch timeline.

## Operational and guest-facing boundary

The client reads and writes `wedding_day_items` and `wedding_day_item_memberships` through their existing RLS policies. It writes no Guest Program time through those tables. A `guest_program_item` is linked only by `operational_item_id`; it keeps its own title, times, and publication state. Operational timing or status updates rely on the existing database trigger to set `review_required`. The UI displays the returned server review state and does not invent one locally.

The Run-of-Show item now shows each linked Guest Program item's Published/Draft and Review Required state and opens the dedicated Guest Program editor. That editor compares operational scheduled/actual timing with the guest-facing schedule. Owner and Full Coordinator may choose **Keep Guest Schedule** or **Update Guest Schedule** with an explicit guest-facing start and optional end. The existing `set_guest_program_publication` RPC performs the confirmation. Publication remains a separate explicit action. An update never copies actual time automatically or publishes by default. A Day-of Coordinator sees the pending review but has no resolution controls.

Marking an item delayed updates only its status. It does not change scheduled times, following items, or guest-facing times. Later operational items must be edited individually. Starting and completing record actual times only after the user selects those labelled actions. Scheduled times remain intact.

## Permissions and scope

Active Owner, Full Coordinator, and Day-of Coordinator memberships receive operational controls; Guest Coordinator receives read-only timeline access. Owner and Full Coordinator receive guest-facing review controls. The existing coordinator-managed controller path remains enforced by backend policy and publication RPC. Every read and write is filtered to the selected Wedding. Item, membership, place, and Guest Program review IDs are checked against that Wedding before mutation. The responsible picker lists active authenticated memberships only; the database trigger and composite foreign keys independently enforce active, same-Wedding assignment. Place selection lists non-archived places in the selected Wedding, with a null option.

Item validation requires title, scheduled start, ordered scheduled and actual ends, nonnegative sort order, and a same-Wedding place. The native picker selects local date and time and sends ISO timestamps; web uses `datetime-local` converted from local time to ISO. Errors are rendered as safe messages without PostgreSQL text. Duplicate submit gating prevents concurrent repeated actions.

## Verification

The new model/API tests cover role controls, time validation, chronological reads, CRUD and cross-Wedding guards, status timing without cascade, responsible assignment, explicit KEEP and UPDATE RPC arguments, unpublished preservation, and duplicate submit gating. Existing database tests in `wedding_day_operations.test.sql` and `guest_program_media.test.sql` cover RLS role behavior, linked review trigger behavior, no downstream or guest schedule cascade, Day-of publication denial, and KEEP/UPDATE database effects.

## Deferred physical QA

- Timeline scrolling.
- Date/time picker behavior and timezone display.
- Rapid status updates.
- Delayed-state UX.
- Responsible-member selection.
- Guest-program review confirmation.
- Android/iOS layout.

Full physical QA follows core V1 integration.
