begin;

set local role postgres;

create extension if not exists pgtap with schema extensions;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select extensions.no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'styling-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated', 'styling-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000603', 'authenticated', 'authenticated', 'styling-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000604', 'authenticated', 'authenticated', 'styling-guest-coordinator-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000605', 'authenticated', 'authenticated', 'styling-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000606', 'authenticated', 'authenticated', 'styling-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000607', 'authenticated', 'authenticated', 'styling-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name
)
values
  ('10000000-0000-0000-0000-000000000601', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000601', 'Styling Wedding A'),
  ('10000000-0000-0000-0000-000000000602', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000606', 'Styling Wedding B'),
  ('10000000-0000-0000-0000-000000000603', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000607', 'Styling Controller Wedding');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601', 'OWNER'),
  ('20000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000602', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000603', '10000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000604', '10000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000604', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000606', '10000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000606', 'OWNER'),
  ('20000000-0000-0000-0000-000000000607', '10000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000607', 'FULL_COORDINATOR');

set constraints all immediate;

insert into public.wedding_people (
  id,
  wedding_id,
  display_name
)
values
  ('30000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', 'Guest A'),
  ('30000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000602', 'Guest B');

insert into public.guest_households (
  id,
  wedding_id,
  display_name
)
values
  ('40000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', 'Household A'),
  ('40000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000602', 'Household B');

insert into public.guests (
  id,
  wedding_id,
  person_id,
  household_id
)
values
  ('50000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', '30000000-0000-0000-0000-000000000601', '40000000-0000-0000-0000-000000000601'),
  ('50000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000602', '30000000-0000-0000-0000-000000000602', '40000000-0000-0000-0000-000000000602');

insert into public.entourage_roles (
  id,
  wedding_id,
  name,
  description,
  sort_order
)
values
  ('60000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', 'Ceremony Witness', 'Custom role for Wedding A', 1),
  ('60000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000602', 'Wedding Party', 'Custom role for Wedding B', 1);

insert into public.attachments (
  id,
  wedding_id,
  object_path,
  original_filename,
  content_type,
  size_bytes,
  visibility,
  status,
  available_at
)
values
  ('70000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601', 'tests/styling-a/motif', 'motif.png', 'image/png', 100, 'WEDDING_MEMBER_PRIVATE', 'AVAILABLE', now()),
  ('70000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000601', 'tests/styling-a/dress-code', 'dress-code.png', 'image/png', 100, 'GUEST_VISIBLE', 'AVAILABLE', now()),
  ('70000000-0000-0000-0000-000000000603', '10000000-0000-0000-0000-000000000601', 'tests/styling-a/private', 'private.png', 'image/png', 100, 'OWNER_PRIVATE', 'AVAILABLE', now()),
  ('70000000-0000-0000-0000-000000000604', '10000000-0000-0000-0000-000000000602', 'tests/styling-b/motif', 'motif-b.png', 'image/png', 100, 'GUEST_VISIBLE', 'AVAILABLE', now());

create temporary table styling_test_state (
  label text primary key,
  value uuid not null
);

grant all on table styling_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);

with created as (
  insert into public.wedding_motifs (
    wedding_id,
    title,
    description,
    notes
  )
  values (
    '10000000-0000-0000-0000-000000000601',
    'Modern Garden',
    'Botanical forms with warm neutrals',
    'Motif identity only; not automatic Guest guidance'
  )
  returning id
)
insert into styling_test_state (label, value)
select 'motif-a', id from created;

with created as (
  insert into public.wedding_dress_codes (
    wedding_id,
    title,
    description,
    venue_advice,
    general_notes
  )
  values (
    '10000000-0000-0000-0000-000000000601',
    'Garden Formal',
    'Formal attire suitable for an outdoor celebration',
    'Choose footwear suitable for grass',
    'Bring a light layer for the evening'
  )
  returning id
)
insert into styling_test_state (label, value)
select 'dress-code-a', id from created;

insert into public.motif_colors (
  wedding_id,
  motif_id,
  color_hex,
  name,
  sort_order
)
values
  ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'motif-a'), '#112233', 'Deep slate', 0),
  ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'motif-a'), '#DDBB99', 'Warm sand', 1);

insert into public.dress_code_recommended_colors (
  wedding_id,
  dress_code_id,
  color_hex,
  name,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'dress-code-a'),
  '#445566',
  'Muted blue',
  0
);

insert into public.dress_code_avoid_colors (
  wedding_id,
  dress_code_id,
  color_hex,
  name,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'dress-code-a'),
  '#FFFFFF',
  'White',
  0
);

select extensions.ok(
  (select array_agg(color_hex::text order by sort_order) from public.motif_colors)
    = array['#112233', '#DDBB99']::text[]
  and (select array_agg(color_hex::text order by sort_order) from public.dress_code_recommended_colors)
    = array['#445566']::text[],
  'Motif colors and Guest recommended colors are independently stored and ordered'
);

update public.motif_colors
set color_hex = '#AABBCC'
where color_hex = '#112233';

select extensions.is(
  (select color_hex::text from public.dress_code_recommended_colors),
  '#445566',
  'Changing a Motif color never changes a Guest recommended color'
);

select extensions.ok(
  (select color_hex::text from public.dress_code_recommended_colors) = '#445566'
  and (select color_hex::text from public.dress_code_avoid_colors) = '#FFFFFF',
  'Recommended and avoid colors remain separate guidance sets'
);

select extensions.throws_ok(
  format(
    'insert into public.motif_colors (wedding_id, motif_id, color_hex, sort_order) values (%L, %L, %L, 2)',
    '10000000-0000-0000-0000-000000000601',
    (select value from styling_test_state where label = 'motif-a'),
    '#abcdef'
  ),
  '23514',
  null,
  'Color values must use canonical uppercase #RRGGBB form'
);

with created as (
  insert into public.attire_groups (
    wedding_id,
    dress_code_id,
    title,
    description,
    instructions,
    sort_order
  )
  values
    ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'dress-code-a'), 'Guests', 'General invited Guest guidance', 'Garden formal attire', 0),
    ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'dress-code-a'), 'Ceremony Team', 'Guidance for a custom ceremony role', 'Wear the assigned accent color', 1)
  returning id, title
)
insert into styling_test_state (label, value)
select case title when 'Guests' then 'group-guests' else 'group-ceremony' end, id
from created;

select extensions.is(
  (select count(*) from public.attire_groups),
  2::bigint,
  'A Wedding supports multiple customizable Attire Groups'
);

insert into public.attire_group_recommended_colors (
  wedding_id,
  attire_group_id,
  color_hex,
  name,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '#778899',
  'Ceremony accent',
  0
);

insert into public.attire_group_avoid_colors (
  wedding_id,
  attire_group_id,
  color_hex,
  name,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '#000000',
  'Black',
  0
);

insert into public.attire_group_entourage_role_targets (
  wedding_id,
  attire_group_id,
  entourage_role_id
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '60000000-0000-0000-0000-000000000601'
);

insert into public.attire_group_guest_targets (
  wedding_id,
  attire_group_id,
  guest_id
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '50000000-0000-0000-0000-000000000601'
);

select extensions.ok(
  exists (
    select 1
    from public.attire_group_entourage_role_targets
    where entourage_role_id = '60000000-0000-0000-0000-000000000601'
  ),
  'One customizable Entourage Role can receive Attire Group guidance'
);

select extensions.ok(
  exists (
    select 1
    from public.attire_group_guest_targets
    where guest_id = '50000000-0000-0000-0000-000000000601'
  ),
  'An individual Guest can be targeted by an Attire Group'
);

with created as (
  insert into public.guest_attire_guidance (
    wedding_id,
    guest_id,
    title,
    instructions,
    notes
  )
  values (
    '10000000-0000-0000-0000-000000000601',
    '50000000-0000-0000-0000-000000000601',
    'Personal fitting note',
    'Use the tailored jacket reserved for you',
    'Private planning note'
  )
  returning id
)
insert into styling_test_state (label, value)
select 'guest-guidance-a', id from created;

insert into public.guest_attire_recommended_colors (
  wedding_id,
  guest_attire_guidance_id,
  color_hex,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'guest-guidance-a'),
  '#CC8844',
  0
);

insert into public.guest_attire_avoid_colors (
  wedding_id,
  guest_attire_guidance_id,
  color_hex,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'guest-guidance-a'),
  '#CCCCCC',
  0
);

select extensions.ok(
  exists (
    select 1
    from public.guest_attire_guidance as guidance
    where guidance.guest_id = '50000000-0000-0000-0000-000000000601'
      and guidance.instructions = 'Use the tailored jacket reserved for you'
  )
  and (select count(*) from public.guest_attire_recommended_colors) = 1
  and (select count(*) from public.guest_attire_avoid_colors) = 1,
  'Guest-specific guidance and colors form a distinct personalized precedence layer'
);

insert into public.motif_inspiration_attachments (
  wedding_id,
  motif_id,
  attachment_id,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'motif-a'),
  '70000000-0000-0000-0000-000000000601',
  0
);

insert into public.dress_code_inspiration_attachments (
  wedding_id,
  dress_code_id,
  attachment_id,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'dress-code-a'),
  '70000000-0000-0000-0000-000000000602',
  0
);

insert into public.attire_group_inspiration_attachments (
  wedding_id,
  attire_group_id,
  attachment_id,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '70000000-0000-0000-0000-000000000602',
  0
);

select extensions.is(
  (
    select count(*)
    from (
      select attachment_id from public.motif_inspiration_attachments
      union all
      select attachment_id from public.dress_code_inspiration_attachments
      union all
      select attachment_id from public.attire_group_inspiration_attachments
    ) as links
  ),
  3::bigint,
  'Motif, Dress Code, and Attire Group inspiration reuse centralized Attachment metadata'
);

select extensions.throws_ok(
  format(
    'insert into public.motif_inspiration_attachments (wedding_id, motif_id, attachment_id, sort_order) values (%L, %L, %L, 1)',
    '10000000-0000-0000-0000-000000000601',
    (select value from styling_test_state where label = 'motif-a'),
    '70000000-0000-0000-0000-000000000604'
  ),
  '23503',
  null,
  'Inspiration Attachment links enforce the same Wedding'
);

select extensions.throws_ok(
  format(
    'insert into public.motif_inspiration_attachments (wedding_id, motif_id, attachment_id, sort_order) values (%L, %L, %L, 1)',
    '10000000-0000-0000-0000-000000000601',
    (select value from styling_test_state where label = 'motif-a'),
    '70000000-0000-0000-0000-000000000603'
  ),
  '23514',
  null,
  'Styling inspiration rejects Attachment visibility outside Guest-visible or member-private contexts'
);

set local role postgres;

select extensions.throws_ok(
  $$update public.attachments set visibility = 'OWNER_PRIVATE' where id = '70000000-0000-0000-0000-000000000601'$$,
  '23514',
  null,
  'A linked inspiration Attachment cannot be changed to an ineligible visibility'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);

select extensions.throws_ok(
  format(
    'insert into public.attire_group_guest_targets (wedding_id, attire_group_id, guest_id) values (%L, %L, %L)',
    '10000000-0000-0000-0000-000000000601',
    (select value from styling_test_state where label = 'group-guests'),
    '50000000-0000-0000-0000-000000000602'
  ),
  '23503',
  null,
  'Cross-Wedding individual Guest targeting fails'
);

select extensions.throws_ok(
  format(
    'insert into public.attire_group_entourage_role_targets (wedding_id, attire_group_id, entourage_role_id) values (%L, %L, %L)',
    '10000000-0000-0000-0000-000000000601',
    (select value from styling_test_state where label = 'group-guests'),
    '60000000-0000-0000-0000-000000000602'
  ),
  '23503',
  null,
  'Cross-Wedding Entourage Role targeting fails'
);

delete from public.attire_group_guest_targets
where attire_group_id = (select value from styling_test_state where label = 'group-ceremony');

delete from public.attire_group_entourage_role_targets
where attire_group_id = (select value from styling_test_state where label = 'group-ceremony');

select extensions.ok(
  exists (select 1 from public.guests where id = '50000000-0000-0000-0000-000000000601')
  and exists (select 1 from public.entourage_roles where id = '60000000-0000-0000-0000-000000000601'),
  'Deleting Attire target relationships never deletes Guests or Entourage Roles'
);

insert into public.attire_group_guest_targets (wedding_id, attire_group_id, guest_id)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '50000000-0000-0000-0000-000000000601'
);

insert into public.attire_group_entourage_role_targets (wedding_id, attire_group_id, entourage_role_id)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'group-ceremony'),
  '60000000-0000-0000-0000-000000000601'
);

delete from public.attire_groups
where id = (select value from styling_test_state where label = 'group-ceremony');

select extensions.ok(
  exists (select 1 from public.guests where id = '50000000-0000-0000-0000-000000000601')
  and exists (select 1 from public.entourage_roles where id = '60000000-0000-0000-0000-000000000601')
  and not exists (
    select 1
    from public.attire_group_guest_targets
    where attire_group_id = (select value from styling_test_state where label = 'group-ceremony')
  )
  and not exists (
    select 1
    from public.attire_group_entourage_role_targets
    where attire_group_id = (select value from styling_test_state where label = 'group-ceremony')
  ),
  'Deleting an Attire Group removes only its relationships, never Guest or Entourage Role identity'
);

select extensions.ok(
  (
    select rsvp.status = 'NO_RESPONSE'
      and rsvp.responded_at is null
      and rsvp.meal_choice is null
      and rsvp.dietary_notes is null
    from public.guest_rsvps as rsvp
    where rsvp.guest_id = '50000000-0000-0000-0000-000000000601'
  )
  and (
    select count(*) = 0
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('guests', 'guest_rsvps')
      and column_name in ('table_id', 'seat_id', 'seat_number', 'seating_event_id', 'effective_dress_code')
  ),
  'Attire guidance does not change RSVP state or denormalize Seating/effective guidance onto Guests'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);

insert into public.attire_groups (
  wedding_id,
  dress_code_id,
  title,
  description,
  instructions,
  sort_order
)
values (
  '10000000-0000-0000-0000-000000000601',
  (select value from styling_test_state where label = 'dress-code-a'),
  'Family',
  'Family-specific guidance',
  'Coordinate with the family palette',
  2
);

select extensions.ok(
  exists (select 1 from public.attire_groups where title = 'Family'),
  'Full Coordinator can manage Wedding styling configuration'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000607', true);

insert into public.wedding_motifs (
  wedding_id,
  title
)
values (
  '10000000-0000-0000-0000-000000000603',
  'Coordinator Draft Motif'
);

insert into public.wedding_dress_codes (
  wedding_id,
  title
)
values (
  '10000000-0000-0000-0000-000000000603',
  'Coordinator Draft Dress Code'
);

select extensions.ok(
  (select count(*) from public.wedding_motifs) = 1
  and (select count(*) from public.wedding_dress_codes) = 1,
  'Temporary coordinator-managed controller can manage styling before ownership transition'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);

select extensions.throws_ok(
  $$insert into public.attire_groups (wedding_id, dress_code_id, title) values ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'dress-code-a'), 'Denied Day Of')$$,
  '42501',
  null,
  'Day-of Coordinator has read-only styling access'
);

select extensions.ok(
  (select count(*) from public.wedding_motifs) = 1
  and (select count(*) from public.wedding_dress_codes) = 1
  and (select count(*) from public.attire_groups) >= 2,
  'Day-of Coordinator can read all internal styling configuration for its Wedding'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);

select extensions.throws_ok(
  $$insert into public.attire_groups (wedding_id, dress_code_id, title) values ('10000000-0000-0000-0000-000000000601', (select value from styling_test_state where label = 'dress-code-a'), 'Denied Guest Coordinator')$$,
  '42501',
  null,
  'Guest Coordinator has read-only styling access'
);

select extensions.ok(
  (select count(*) from public.motif_colors) = 2
  and (select count(*) from public.dress_code_recommended_colors) = 1
  and (select count(*) from public.guest_attire_guidance) = 1,
  'Guest Coordinator can read internal motif, general, group, and Guest-specific guidance'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000605', true);

select extensions.ok(
  (select count(*) from public.wedding_motifs) = 0
  and (select count(*) from public.motif_colors) = 0
  and (select count(*) from public.wedding_dress_codes) = 0
  and (select count(*) from public.attire_groups) = 0
  and (select count(*) from public.guest_attire_guidance) = 0
  and (select count(*) from public.motif_inspiration_attachments) = 0,
  'Unrelated authenticated users cannot read styling configuration or Attachment links'
);

select extensions.throws_ok(
  $$insert into public.wedding_motifs (wedding_id, title) values ('10000000-0000-0000-0000-000000000601', 'Denied Unrelated')$$,
  '42501',
  null,
  'Unrelated authenticated users cannot manage styling configuration'
);

set local role postgres;

select extensions.ok(
  not has_table_privilege('anon', 'public.wedding_motifs', 'SELECT')
  and not has_table_privilege('anon', 'public.motif_colors', 'SELECT')
  and not has_table_privilege('anon', 'public.wedding_dress_codes', 'SELECT')
  and not has_table_privilege('anon', 'public.attire_groups', 'SELECT')
  and not has_table_privilege('anon', 'public.guest_attire_guidance', 'SELECT')
  and not has_table_privilege('anon', 'public.motif_inspiration_attachments', 'SELECT'),
  'Anonymous role has no styling table or inspiration-link access'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.wedding_motifs', 'SELECT')
  and has_table_privilege('authenticated', 'public.attire_groups', 'SELECT')
  and has_table_privilege('authenticated', 'public.guest_attire_guidance', 'SELECT')
  and has_table_privilege('authenticated', 'public.attire_group_guest_targets', 'DELETE'),
  'Authenticated grants expose only RLS-controlled styling operations'
);

set local role anon;

select extensions.throws_ok(
  $$select count(*) from public.wedding_motifs$$,
  '42501',
  null,
  'Anonymous Motif read is denied'
);

select extensions.throws_ok(
  $$select count(*) from public.wedding_dress_codes$$,
  '42501',
  null,
  'Anonymous Dress Code read is denied'
);

set local role postgres;

select * from extensions.finish();

rollback;
