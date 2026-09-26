# Phase 1B: Guest Program and guest media

Migration: `20260926140232_guest_program_media.sql`

## Schedule contract

`guest_program_items` owns guest-facing times and publication. An optional
`operational_item_id` links to `wedding_day_items` for traceability only.
Changing an operational item's scheduled or actual times or status marks each
linked Guest Program item `review_required`, clears its previous confirmation,
and leaves its guest-facing times and publication unchanged. No later item moves.

Only an Owner, Full Coordinator, or the authorized temporary controller can
create and edit Guest Program items or call
`set_guest_program_publication`. The RPC locks the item and records the reviewer,
confirmation time, and `KEEP` or `UPDATE` resolution. `KEEP` retains the
published time. Guest-facing time and publication columns have no direct
authenticated UPDATE grant. DAY_OF_COORDINATOR can update the operational
Run of Show but cannot confirm or publish the Guest Program.

The Guest Guide includes published Guest Program items only while the existing
Wedding lifecycle and website publication checks allow guest access.

## Attire and media

The sanitized Guest Guide projects general Dress Code text and colors. A valid
Household invitation token adds guidance for that Household's Guests, including
applicable Attire Groups, Entourage roles, and Guest-specific instructions.
Effective instructions and each color list resolve in this order: Guest,
applicable group/role, then general. Groups with equal applicability use their
existing sort order. Internal Guest and Attachment rows are never returned.

Media descriptors contain eligible Attachment IDs only. `guest-media` checks
the slug, published website, active Wedding, section audience, optional
Household token, same-Wedding Attachment, `GUEST_VISIBLE` visibility,
`AVAILABLE` status, and an applicable inspiration link before requesting a
60-second signed URL from the private `wedding-files` bucket. Tokenless
requests require an `ANYONE_WITH_LINK` site and a PUBLIC Dress Code section;
they can receive only its Dress Code media. Motif and applicable Attire Group
media require a valid Household token.
The Edge response uses `Cache-Control: no-store`; signed URLs are not saved.

## Verification

The database test runs in a rollback transaction and covers independent
schedules, review confirmation, no cascade, publication and lifecycle,
Household attire isolation and precedence, token expiry/revocation, media
eligibility, cross-Wedding access, and raw anon isolation. Local Edge tests cover
request validation, denied requests, and temporary signing. The full database
suite ran against DEV after deployment; the deployed Edge Function was verified
active.
