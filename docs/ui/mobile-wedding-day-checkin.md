# Mobile Wedding-Day Check-In

This slice implements Wedding-Day check-in for the selected Wedding workspace. The canonical demo couple is **Juan & Maria**; all screen identity and wedding values come from the active membership and backend data.

## Stitch review and dashboard choice

Inspected the three Wedding-Day Dashboard variants together, plus the Guest Check-In and QR Scanner & Manual Check-In screens in the **Katipan Wedding Planner UI System**. The shared visual base is Warm Editorial Nuptial: warm ivory surfaces, sage actions, champagne details, Playfair Display headings, Plus Jakarta Sans body text, rounded editorial cards, and mobile page gutters.

| Stitch screen | Observed composition | Decision |
| --- | --- | --- |
| Wedding-Day Dashboard `64964af2332c47a994da83d7236ae10a` (780 × 4060) | Overview-led arrangement of Wedding-Day context, guest arrival/check-in, operational schedule, and shortcuts. | Not selected; arrival entry is less prominent in the first screenful. |
| Wedding-Day Dashboard `885c999629214018a0d49eb0cbf8553b` (780 × 4032) | Puts the attendance summary and scan/manual entry high in the hierarchy, followed by current/next schedule, delayed attention, and navigation to Guest Check-In. | **Selected canonical composition.** It makes the entrance workflow immediately available while keeping Run of Show visible. |
| Wedding-Day Dashboard `767ab615485449b697eb3ee0d49cb030` (780 × 4024) | Uses the same overview, arrival, schedule, and shortcut content with a different balance between operational schedule and check-in emphasis. | Not selected; the entry into Guest Check-In is less direct than in `885c999…`. |

The variants are presentation alternatives for one route, not different data contracts or check-in states. The selected dashboard reads its attendance values and current, next, and delayed items from `wedding_day_dashboard(wedding_id)` without client-side count calculations.

The Guest Check-In reference (`36b6f94cc77143d3b8b76e0e80113827`) informs the individual Guest list, RSVP/check-in state, and arrival lookup. The QR Scanner & Manual Check-In reference (`28bad6493953451385d2cea86ca36c4f`) informs the dedicated scanner, clear result states, and manual fallback.

## Routes and behavior

- `/(wedding)/[weddingId]/day`: dashboard; linked from More and excluded from the five-tab bar.
- `/(wedding)/[weddingId]/day/check-in`: searchable individual Guest roster, RSVP and check-in filters, Household context, safely available table/seat summaries, manual check-in, and reversal.
- `/(wedding)/[weddingId]/day/scan`: QR scanner, explicit scan result, retry of the same action, and manual fallback.

The dashboard shows real ATTENDING, checked-in, and remaining counts, the current and next operational items, delayed items, scan/manual actions, and Guest Check-In browsing. An empty Run of Show gets an explicit empty state. No item management controls are shown in this slice.

The list retains ATTENDING, DECLINED, and NO_RESPONSE Guests. Search matches individual and Household names. The checked-in filters never change RSVP or seating. Each action and result is for one Guest; Household is context only. The Guest Pass reference is shown only when it comes from an authorized check-in result, since the roster contract does not provide one.

Check-in and reversal use the existing RPCs only:

- `wedding_day_dashboard`
- `wedding_day_check_in`
- `wedding_day_reverse_check_in`

The client never writes `guest_check_in_events` directly. It presents `CHECKED_IN`, `ALREADY_CHECKED_IN`, `NOT_RECOGNIZED`, `DIFFERENT_WEDDING`, `REVOKED_PASS`, `DECLINED_REVIEW`, and `NO_RESPONSE_REVIEW` distinctly. A review result does not change RSVP or create a check-in. Reversal requires confirmation and appends a reversal through the RPC; prior history remains intact.

Check-in and scanner access is available to active OWNER, FULL_COORDINATOR, DAY_OF_COORDINATOR, and GUEST_COORDINATOR memberships. Backend authorization remains authoritative. The dashboard exposes no Run-of-Show edit actions, so Guest Coordinators receive no timeline-management controls in this slice. The existing coordinator-managed controller path remains a server-side permission rule.

RSVP, Seating, Guest Pass, and Check-In remain separate domains. Check-in reads the current RSVP/seating projections for display and does not mutate RSVP, seating assignments, Guest Pass state, or pass tokens. Scan input is passed unchanged to the check-in RPC; raw QR values are held only in component memory for retry and are not logged or persisted. `DIFFERENT_WEDDING` reveals no other Wedding identity.

## Offline behavior

- Native builds cache only Guest ID, display name, Household ID/name, RSVP status, and last known check-in state in SQLite. Web builds use the corresponding minimal local-storage store.
- Changing the selected Wedding invalidates the cached roster and current screen state. Existing queued manual actions remain scoped to their original user and Wedding until the server confirms them.
- Offline manual actions are allowed only for Guests in the cached roster. Each action stores its UUID `client_event_id` and `occurred_at`; both survive retries and are sent to `wedding_day_check_in` with `p_guest_id` during sync.
- Queued actions remain pending until a server result is received. The screen does not count them as checked in before confirmation.
- QR scans are not queued or verified offline. The scanner reports that a network connection is required and offers the manual roster fallback.
- Reversal remains online-only; it retries with the same client event ID after an uncertain response.

## Permission behavior

Expo Camera permission is requested only after entering a valid, selected Wedding's scanner route. If permission is denied or unavailable, the route offers Guest Check-In search. Camera access is not requested for the dashboard or Guest list.

## Intentional visual and workflow deviations

- The selected `885c999…` hierarchy is adapted to the existing native workspace shell and shared Katipan UI components; no sixth bottom tab is added.
- The dashboard uses the live attendance summary as its first operational card and makes scan/manual actions explicit. It does not use illustrative Stitch counts or hardcoded wedding facts.
- The Guest list uses an accessible vertical row layout with search and check-in filters rather than a static mock list. Household appears as supporting identity context while check-in remains individual.
- The scanner is a dedicated route with a single-scan pause, retry, result, and Manual Check-In fallback. Permission-denied and offline states are explicit.
- No full Run-of-Show editor, schedule delay cascade, seating editor, RSVP action, or Guest Pass issue/revoke action is added.

## Deferred physical QA

- Camera permission prompts and denial recovery.
- QR scan speed and readability.
- Repeated scan behavior.
- Manual Guest search.
- Offline manual queue and sync.
- Reversal confirmation and recovery UX.
- Long Guest lists.
- Android and iOS scanner behavior.

Full physical QA happens after core V1 integration.

## Recommended next slice

Add Run-of-Show item management and explicit delay review, including role-aware controls and coordinator-managed authorization. A delay must not cascade later items automatically; guest-facing schedule changes require separate confirmation.
