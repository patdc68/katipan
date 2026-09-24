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
  ('00000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated', 'place-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000402', 'authenticated', 'authenticated', 'place-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000403', 'authenticated', 'authenticated', 'place-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000404', 'authenticated', 'authenticated', 'place-guest-coordinator-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000405', 'authenticated', 'authenticated', 'place-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000406', 'authenticated', 'authenticated', 'place-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000407', 'authenticated', 'authenticated', 'place-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name,
  ceremony_style
)
values
  ('10000000-0000-0000-0000-000000000401', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000401', 'Place Wedding A', 'RELIGIOUS'),
  ('10000000-0000-0000-0000-000000000402', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000406', 'Place Wedding B', 'CIVIL'),
  ('10000000-0000-0000-0000-000000000403', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000407', 'Place Controller Wedding', 'UNDECIDED');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000401', 'OWNER'),
  ('20000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000403', '10000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000403', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000404', '10000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000404', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000406', '10000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000406', 'OWNER'),
  ('20000000-0000-0000-0000-000000000407', '10000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000407', 'FULL_COORDINATOR');

set constraints all immediate;

create temporary table place_test_state (
  label text primary key,
  place_id uuid not null
);

create temporary table purpose_test_state (
  label text primary key,
  purpose_id uuid not null
);

grant all on table place_test_state, purpose_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);

insert into place_test_state (label, place_id)
values
  (
    'google-main',
    public.create_google_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      '  google-place-main  ',
      'BEACH',
      '  Main venue  ',
      'private context',
      'guest context'
    )
  ),
  (
    'custom-one',
    public.create_custom_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      '  Family Garden  ',
      'GARDEN',
      '  1 Garden Lane  ',
      14.5001,
      121.0001,
      null,
      'private custom context',
      'guest custom context'
    )
  ),
  (
    'custom-two',
    public.create_custom_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      'Second Estate',
      'PRIVATE_ESTATE'
    )
  );

select extensions.ok(
  (
    select place.source = 'GOOGLE_PLACES'
      and place.google_place_id = 'google-place-main'
      and place.custom_name is null
      and place.custom_address is null
      and place.custom_latitude is null
      and place.custom_longitude is null
      and place.user_label = 'Main venue'
      and place.created_by_user_id = '00000000-0000-0000-0000-000000000401'
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'google-main')
  ),
  'Google Place stores only its Place ID and KATIPAN-owned context'
);

select extensions.ok(
  (
    select place.source = 'CUSTOM'
      and place.google_place_id is null
      and place.google_place_id_refreshed_at is null
      and place.custom_name = 'Family Garden'
      and place.custom_address = '1 Garden Lane'
      and place.custom_latitude = 14.5001
      and place.custom_longitude = 121.0001
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'custom-one')
  ),
  'Custom Place stores KATIPAN-owned name, address, and optional coordinate pair'
);

select extensions.ok(
  (
    select wedding.ceremony_style = 'RELIGIOUS'
    from public.weddings as wedding
    where wedding.id = '10000000-0000-0000-0000-000000000401'
  )
  and (
    select place.place_type = 'BEACH'
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'google-main')
  ),
  'Religious ceremony style remains independent from BEACH Place type'
);

select extensions.throws_ok(
  $$
    select public.create_google_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      'google-place-main'
    )
  $$,
  '23505',
  null,
  'Duplicate active Google Place ID is rejected within one Wedding'
);

select extensions.throws_ok(
  $$
    select public.create_custom_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      'Missing longitude',
      'OTHER',
      null,
      14.5,
      null
    )
  $$,
  '23514',
  null,
  'Custom coordinates must be supplied as a complete pair'
);

select extensions.throws_ok(
  $$
    select public.create_custom_wedding_place(
      '10000000-0000-0000-0000-000000000401',
      'Invalid latitude',
      'OTHER',
      null,
      90.0001,
      121
    )
  $$,
  '23514',
  null,
  'Custom latitude must be within its valid range'
);

select public.update_wedding_place_context(
  (select place_id from place_test_state where label = 'custom-one'),
  'EVENT_SPACE',
  'Updated Garden',
  null,
  null,
  null,
  'Updated label',
  'updated private',
  'updated guest'
);

select extensions.ok(
  (
    select place.place_type = 'EVENT_SPACE'
      and place.custom_name = 'Updated Garden'
      and place.custom_address is null
      and place.custom_latitude is null
      and place.custom_longitude is null
      and place.user_label = 'Updated label'
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'custom-one')
  ),
  'Place context workflow updates KATIPAN-owned fields without changing source identity'
);

select extensions.throws_ok(
  $$
    select public.update_wedding_place_context(
      (select place_id from place_test_state where label = 'google-main'),
      'BEACH',
      'Forbidden cached Google name',
      null,
      null,
      null,
      null,
      null,
      null
    )
  $$,
  '22023',
  null,
  'Google Place update cannot persist custom or cached Google fields'
);

select public.mark_google_wedding_place_refreshed(
  (select place_id from place_test_state where label = 'google-main')
);

select extensions.ok(
  (
    select place.google_place_id_refreshed_at is not null
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'google-main')
  ),
  'Google Place validation can mark the stored Place ID refreshed'
);

select extensions.throws_ok(
  $$select public.mark_google_wedding_place_refreshed((select place_id from place_test_state where label = 'custom-one'))$$,
  '22023',
  null,
  'Custom Place cannot be marked as a refreshed Google Place ID'
);

insert into purpose_test_state (label, purpose_id)
values
  (
    'custom-one-ceremony',
    public.set_wedding_place_purpose(
      (select place_id from place_test_state where label = 'custom-one'),
      'CEREMONY',
      10,
      true,
      'Garden ceremony',
      'private ceremony notes',
      'guest ceremony notes'
    )
  ),
  (
    'custom-one-reception',
    public.set_wedding_place_purpose(
      (select place_id from place_test_state where label = 'custom-one'),
      'RECEPTION',
      20
    )
  ),
  (
    'custom-two-ceremony',
    public.set_wedding_place_purpose(
      (select place_id from place_test_state where label = 'custom-two'),
      'CEREMONY',
      30
    )
  );

select extensions.is(
  (
    select count(*)
    from public.wedding_place_purposes
    where place_id = (select place_id from place_test_state where label = 'custom-one')
  ),
  2::bigint,
  'One Place supports many purposes'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_place_purposes
    where wedding_id = '10000000-0000-0000-0000-000000000401'
      and purpose = 'CEREMONY'
  ),
  2::bigint,
  'One purpose supports many Places'
);

select extensions.is(
  public.set_wedding_place_purpose(
    (select place_id from place_test_state where label = 'custom-one'),
    'CEREMONY',
    5,
    false,
    'Updated ceremony',
    null,
    null
  ),
  (select purpose_id from purpose_test_state where label = 'custom-one-ceremony'),
  'Purpose workflow updates the existing Place-purpose assignment instead of duplicating it'
);

select extensions.ok(
  (
    select assignment.sort_order = 5
      and not assignment.guest_visible
      and assignment.purpose_label = 'Updated ceremony'
    from public.wedding_place_purposes as assignment
    where assignment.id = (select purpose_id from purpose_test_state where label = 'custom-one-ceremony')
  ),
  'Purpose context update is persisted'
);

select extensions.ok(
  public.remove_wedding_place_purpose(
    (select place_id from place_test_state where label = 'custom-one'),
    'RECEPTION'
  ),
  'Purpose workflow removes only the requested assignment'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_place_purposes
    where place_id = (select place_id from place_test_state where label = 'custom-one')
      and purpose = 'RECEPTION'
  ),
  0::bigint,
  'Removed purpose assignment is gone while the Place remains'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
insert into place_test_state (label, place_id)
values (
  'full-created',
  public.create_custom_wedding_place(
    '10000000-0000-0000-0000-000000000401',
    'Full Coordinator Place'
  )
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000407', true);
insert into place_test_state (label, place_id)
values (
  'controller-created',
  public.create_google_wedding_place(
    '10000000-0000-0000-0000-000000000403',
    'controller-google-place'
  )
);

select extensions.is(
  (select count(*) from public.wedding_places),
  1::bigint,
  'Temporary coordinator-managed controller can create and read its Wedding Place'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000403', true);
select extensions.throws_ok(
  $$select public.create_custom_wedding_place('10000000-0000-0000-0000-000000000401', 'Denied Day Of')$$,
  '42501',
  null,
  'Day-of Coordinator has read-only Place access'
);
select extensions.ok(
  (select count(*) from public.wedding_places) >= 4,
  'Day-of Coordinator can read all Places in the Wedding'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000404', true);
select extensions.throws_ok(
  $$select public.create_custom_wedding_place('10000000-0000-0000-0000-000000000401', 'Denied Guest Coordinator')$$,
  '42501',
  null,
  'Guest Coordinator has read-only Place access'
);
select extensions.ok(
  (select count(*) from public.wedding_places) >= 4,
  'Guest Coordinator can read all Places in the Wedding'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000405', true);
select extensions.throws_ok(
  $$select public.create_custom_wedding_place('10000000-0000-0000-0000-000000000401', 'Denied Unrelated')$$,
  '42501',
  null,
  'Unrelated authenticated user cannot manage Places'
);
select extensions.is(
  (select count(*) from public.wedding_places),
  0::bigint,
  'Unrelated authenticated user cannot read Places'
);
select extensions.is(
  (select count(*) from public.wedding_place_purposes),
  0::bigint,
  'Unrelated authenticated user cannot read Place purposes'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000406', true);
insert into place_test_state (label, place_id)
values (
  'wedding-b',
  public.create_custom_wedding_place(
    '10000000-0000-0000-0000-000000000402',
    'Wedding B Place'
  )
);
select extensions.is(
  (select count(*) from public.wedding_places),
  1::bigint,
  'Wedding B Owner sees only Wedding B Places'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select extensions.is(
  (select count(*) from public.wedding_places where wedding_id = '10000000-0000-0000-0000-000000000402'),
  0::bigint,
  'Wedding A Owner cannot read Wedding B Places'
);

select extensions.throws_ok(
  $$
    delete from public.wedding_places
    where id = (select place_id from place_test_state where label = 'custom-two')
  $$,
  '42501',
  null,
  'Authenticated managers cannot physically delete a Wedding Place'
);

select public.archive_wedding_place(
  (select place_id from place_test_state where label = 'google-main')
);

select extensions.ok(
  (
    select place.archived_at is not null
    from public.wedding_places as place
    where place.id = (select place_id from place_test_state where label = 'google-main')
  ),
  'Archive workflow preserves the Place row and records archived_at'
);

select extensions.throws_ok(
  $$
    select public.set_wedding_place_purpose(
      (select place_id from place_test_state where label = 'google-main'),
      'AFTER_PARTY'
    )
  $$,
  '22023',
  null,
  'Archived Place cannot receive a new purpose'
);

insert into place_test_state (label, place_id)
values (
  'google-reused-after-archive',
  public.create_google_wedding_place(
    '10000000-0000-0000-0000-000000000401',
    'google-place-main'
  )
);

select extensions.is(
  (
    select count(*)
    from public.wedding_places
    where wedding_id = '10000000-0000-0000-0000-000000000401'
      and google_place_id = 'google-place-main'
  ),
  2::bigint,
  'An archived Google Place ID may be added again as one new active Place'
);

set local role postgres;

select extensions.throws_ok(
  $$
    insert into public.wedding_places (
      wedding_id,
      source,
      google_place_id,
      custom_name
    ) values (
      '10000000-0000-0000-0000-000000000401',
      'GOOGLE_PLACES',
      'invalid-google-with-custom-data',
      'Forbidden cached name'
    )
  $$,
  '23514',
  null,
  'GOOGLE_PLACES source rejects all CUSTOM fields'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_places (
      wedding_id,
      source,
      google_place_id,
      custom_name
    ) values (
      '10000000-0000-0000-0000-000000000401',
      'CUSTOM',
      'forbidden-google-id',
      'Custom Name'
    )
  $$,
  '23514',
  null,
  'CUSTOM source rejects Google Place ID'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_place_purposes (
      wedding_id,
      place_id,
      purpose
    ) values (
      '10000000-0000-0000-0000-000000000402',
      (select place_id from place_test_state where label = 'custom-one'),
      'OTHER'
    )
  $$,
  '23503',
  null,
  'Same-Wedding foreign key rejects a cross-Wedding Place purpose'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wedding_places'
      and column_name in (
        'google_display_name',
        'google_formatted_address',
        'google_location',
        'google_rating',
        'google_reviews',
        'google_photos'
      )
  ),
  'Schema has no columns for permanently caching Google response data'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.wedding_places', 'SELECT')
  and not has_table_privilege('anon', 'public.wedding_place_purposes', 'SELECT')
  and not has_function_privilege(
    'anon',
    'public.create_google_wedding_place(uuid,text,public.wedding_place_type,text,text,text)',
    'EXECUTE'
  ),
  'Anonymous role has no table or workflow access, regardless of guest_visible'
);

set local role anon;
select extensions.throws_ok(
  $$select count(*) from public.wedding_places$$,
  '42501',
  null,
  'Anonymous Place read is denied'
);

set local role postgres;
select extensions.ok(
  not has_table_privilege('authenticated', 'public.wedding_places', 'DELETE'),
  'Authenticated role is never granted physical Place deletion'
);

select * from extensions.finish();

rollback;
