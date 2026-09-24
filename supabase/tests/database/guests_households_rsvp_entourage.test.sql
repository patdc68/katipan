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
  ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'guest-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'guest-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000303', 'authenticated', 'authenticated', 'guest-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000304', 'authenticated', 'authenticated', 'guest-coordinator-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000305', 'authenticated', 'authenticated', 'guest-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000306', 'authenticated', 'authenticated', 'guest-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000307', 'authenticated', 'authenticated', 'guest-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name
)
values
  ('10000000-0000-0000-0000-000000000301', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000301', 'Guest Wedding A'),
  ('10000000-0000-0000-0000-000000000302', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000306', 'Guest Wedding B'),
  ('10000000-0000-0000-0000-000000000303', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000307', 'Guest Controller Wedding');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301', 'OWNER'),
  ('20000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000303', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000304', '10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000304', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000306', '10000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000306', 'OWNER'),
  ('20000000-0000-0000-0000-000000000307', '10000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000307', 'FULL_COORDINATOR');

insert into public.wedding_people (
  id,
  wedding_id,
  linked_user_id,
  display_name
)
values
  ('30000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301', 'Owner Partner A'),
  ('30000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000306', 'Owner Partner B');

insert into public.wedding_partners (
  wedding_id,
  person_id,
  partner_order,
  joined_workspace_at
)
values
  ('10000000-0000-0000-0000-000000000301', '30000000-0000-0000-0000-000000000301', 1, now()),
  ('10000000-0000-0000-0000-000000000302', '30000000-0000-0000-0000-000000000302', 1, now());

set constraints all immediate;

create temporary table guest_test_households (
  label text primary key,
  household_id uuid not null
);

create temporary table guest_test_people (
  label text primary key,
  person_id uuid not null,
  guest_id uuid not null
);

create temporary table guest_test_groups (
  label text primary key,
  group_id uuid not null
);

create temporary table guest_test_allowances (
  label text primary key,
  allowance_id uuid not null
);

create temporary table guest_test_roles (
  label text primary key,
  role_id uuid not null
);

grant all on table guest_test_households,
  guest_test_people,
  guest_test_groups,
  guest_test_allowances,
  guest_test_roles
to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

insert into guest_test_households (label, household_id)
values
  ('progress', public.create_guest_household('10000000-0000-0000-0000-000000000301', '  Progress Household  ', ' progress notes ')),
  ('plus-one', public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Plus-One Household', null)),
  ('child', public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Child Household', null));

select extensions.is(
  (
    select household.display_name
    from public.guest_households as household
    where household.id = (select household_id from guest_test_households where label = 'progress')
  ),
  'Progress Household',
  'Owner creates a Household and its display name is trimmed'
);

select extensions.ok(
  (
    select household.delivery_status = 'NOT_SENT'
      and household.sent_at is null
    from public.guest_households as household
    where household.id = (select household_id from guest_test_households where label = 'progress')
  ),
  'New Household starts NOT_SENT with null sent_at'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
insert into guest_test_households (label, household_id)
values (
  'full-created',
  public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Full Coordinator Household', null)
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
insert into guest_test_households (label, household_id)
values (
  'guest-coordinator-created',
  public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Guest Coordinator Household', null)
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000307', true);
insert into guest_test_households (label, household_id)
values (
  'controller-created',
  public.create_guest_household('10000000-0000-0000-0000-000000000303', 'Controller Household', null)
);

select extensions.ok(
  exists (
    select 1
    from public.guest_households
    where id = (select household_id from guest_test_households where label = 'controller-created')
  ),
  'Valid temporary coordinator-managed controller has Guest-domain write access'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select extensions.throws_ok(
  $$select public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Denied Day Of', null)$$,
  '42501',
  null,
  'Day-of Coordinator cannot create a Household'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', true);
select extensions.throws_ok(
  $$select public.create_guest_household('10000000-0000-0000-0000-000000000301', 'Denied Unrelated', null)$$,
  '42501',
  null,
  'Unrelated authenticated user cannot create a Household'
);

select extensions.is(
  (select count(*) from public.guest_households),
  0::bigint,
  'Unrelated authenticated user reads zero Household rows'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select extensions.ok(
  (select count(*) from public.guest_households) >= 5,
  'Day-of Coordinator has read-only access to Guest-domain Household rows'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000306', true);
insert into guest_test_households (label, household_id)
values (
  'wedding-b',
  public.create_guest_household('10000000-0000-0000-0000-000000000302', 'Wedding B Household', null)
);

insert into guest_test_people (label, person_id, guest_id)
select 'wedding-b-guest', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000302',
  (select household_id from guest_test_households where label = 'wedding-b'),
  'Wedding B Guest'
) as created;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

insert into guest_test_people (label, person_id, guest_id)
select 'progress-1', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'progress'),
  ' Guest One ',
  ' Guest ',
  ' One ',
  ' GUEST.ONE@EXAMPLE.TEST ',
  ' 09170000001 ',
  'Wheelchair assistance',
  'Private note one'
) as created;

insert into guest_test_people (label, person_id, guest_id)
select 'progress-2', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'progress'),
  'Guest Two'
) as created;

insert into guest_test_people (label, person_id, guest_id)
select 'progress-3', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'progress'),
  'Guest Three'
) as created;

select extensions.is(
  (
    select count(*)
    from public.wedding_people
    where id in (select person_id from guest_test_people where label like 'progress-%')
  ),
  3::bigint,
  'Three Guest creations produce exactly three canonical Wedding People'
);

select extensions.is(
  (
    select count(*)
    from public.guests
    where id in (select guest_id from guest_test_people where label like 'progress-%')
  ),
  3::bigint,
  'Three Guest creations produce exactly three Guest rows'
);

select extensions.is(
  (
    select count(*)
    from public.guest_rsvps
    where guest_id in (select guest_id from guest_test_people where label like 'progress-%')
      and status = 'NO_RESPONSE'
      and responded_at is null
  ),
  3::bigint,
  'Every created Guest receives exactly one NO_RESPONSE RSVP row'
);

select extensions.ok(
  (
    select person.email = 'guest.one@example.test'
      and person.phone = '09170000001'
      and person.linked_user_id is null
    from public.wedding_people as person
    where person.id = (select person_id from guest_test_people where label = 'progress-1')
  ),
  'Guest contact is normalized and no Auth account is created or spoofed'
);

insert into guest_test_people (label, person_id, guest_id)
select
  'partner',
  '30000000-0000-0000-0000-000000000301'::uuid,
  public.add_existing_person_as_guest(
    '10000000-0000-0000-0000-000000000301',
    '30000000-0000-0000-0000-000000000301',
    (select household_id from guest_test_households where label = 'plus-one')
  );

select extensions.is(
  (
    select count(*)
    from public.wedding_people
    where id = '30000000-0000-0000-0000-000000000301'
  ),
  1::bigint,
  'Partner is added as Guest without duplicating Wedding Person identity'
);

select extensions.throws_ok(
  $$
    select public.add_existing_person_as_guest(
      '10000000-0000-0000-0000-000000000301',
      '30000000-0000-0000-0000-000000000301',
      (select household_id from guest_test_households where label = 'plus-one')
    )
  $$,
  '23505',
  null,
  'Same Wedding Person cannot become a duplicate Guest'
);

select extensions.throws_ok(
  $$
    select public.add_existing_person_as_guest(
      '10000000-0000-0000-0000-000000000301',
      '30000000-0000-0000-0000-000000000302',
      (select household_id from guest_test_households where label = 'plus-one')
    )
  $$,
  '22023',
  null,
  'Person from Wedding B cannot become a Guest in Wedding A'
);

select extensions.throws_ok(
  $$
    select public.create_guest(
      '10000000-0000-0000-0000-000000000301',
      (select household_id from guest_test_households where label = 'wedding-b'),
      'Cross Wedding Guest'
    )
  $$,
  '22023',
  null,
  'Guest workflow rejects a Household from another Wedding'
);

select extensions.throws_ok(
  $$
    update public.wedding_people
    set linked_user_id = '00000000-0000-0000-0000-000000000305'
    where id = (select person_id from guest_test_people where label = 'progress-1')
  $$,
  '42501',
  null,
  'Guest manager cannot spoof linked_user_id through direct Wedding Person update'
);

select public.update_guest_person(
  '10000000-0000-0000-0000-000000000301',
  (select guest_id from guest_test_people where label = 'partner'),
  'Updated Owner Partner',
  'Owner',
  'Partner',
  ' OWNER@EXAMPLE.TEST ',
  ' 09170000002 '
);

select extensions.is(
  (
    select person.linked_user_id
    from public.wedding_people as person
    where person.id = '30000000-0000-0000-0000-000000000301'
  ),
  '00000000-0000-0000-0000-000000000301'::uuid,
  'Narrow Guest Person update preserves linked_user_id'
);

select extensions.is(
  (
    select progress.progress
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'NO_RESPONSE'::public.household_rsvp_progress,
  'Three initial NO_RESPONSE Guests derive Household NO_RESPONSE'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-1'),
  'ATTENDING',
  'Chicken',
  'No shellfish',
  'Confirmed by phone'
);

select extensions.is(
  (
    select progress.progress
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'PARTIALLY_RESPONDED'::public.household_rsvp_progress,
  'One attending Guest derives PARTIALLY_RESPONDED'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-2'),
  'DECLINED'
);

select extensions.is(
  (
    select progress.progress
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'PARTIALLY_RESPONDED'::public.household_rsvp_progress,
  'Attending plus declined plus unanswered remains PARTIALLY_RESPONDED'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-3'),
  'ATTENDING'
);

select extensions.ok(
  (
    select progress.progress = 'RESPONDED'
      and progress.total_guests = 3
      and progress.responded_guests = 3
      and progress.attending_guests = 2
      and progress.declined_guests = 1
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'All individual responses derive RESPONDED with accurate aggregates'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-2'),
  'ATTENDING',
  'Fish',
  'Nut allergy',
  'Changed response'
);

select extensions.ok(
  (
    select rsvp.status = 'ATTENDING'
      and rsvp.responded_at is not null
      and rsvp.meal_choice = 'Fish'
      and rsvp.dietary_notes = 'Nut allergy'
    from public.guest_rsvps as rsvp
    where rsvp.guest_id = (select guest_id from guest_test_people where label = 'progress-2')
  ),
  'DECLINED to ATTENDING transition works and meal/dietary data remains Guest-specific'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-2'),
  'DECLINED'
);

select extensions.is(
  (
    select rsvp.status
    from public.guest_rsvps as rsvp
    where rsvp.guest_id = (select guest_id from guest_test_people where label = 'progress-2')
  ),
  'DECLINED'::public.guest_rsvp_status,
  'ATTENDING to DECLINED transition works'
);

select * from public.set_guest_rsvp(
  (select guest_id from guest_test_people where label = 'progress-3'),
  'NO_RESPONSE'
);

select extensions.ok(
  (
    select rsvp.status = 'NO_RESPONSE'
      and rsvp.responded_at is null
    from public.guest_rsvps as rsvp
    where rsvp.guest_id = (select guest_id from guest_test_people where label = 'progress-3')
  ),
  'Authorized manager resets RSVP to NO_RESPONSE consistently'
);

select extensions.is(
  (
    select progress.progress
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'PARTIALLY_RESPONDED'::public.household_rsvp_progress,
  'Resetting one Guest derives PARTIALLY_RESPONDED without stored Household state'
);

select public.mark_household_invitation_sent(
  (select household_id from guest_test_households where label = 'progress')
);

select extensions.ok(
  (
    select household.delivery_status = 'SENT'
      and household.sent_at is not null
    from public.guest_households as household
    where household.id = (select household_id from guest_test_households where label = 'progress')
  ),
  'Invitation delivery workflow sets SENT and sent_at'
);

select extensions.is(
  (
    select progress.progress
    from public.guest_household_rsvp_progress as progress
    where progress.household_id = (select household_id from guest_test_households where label = 'progress')
  ),
  'PARTIALLY_RESPONDED'::public.household_rsvp_progress,
  'Sending invitation does not alter individual RSVP or Household progress'
);

select public.reset_household_invitation_delivery(
  (select household_id from guest_test_households where label = 'progress')
);

select extensions.ok(
  (
    select household.delivery_status = 'NOT_SENT'
      and household.sent_at is null
    from public.guest_households as household
    where household.id = (select household_id from guest_test_households where label = 'progress')
  ),
  'Deliberate invitation reset restores NOT_SENT with null sent_at'
);

select extensions.throws_ok(
  $$
    update public.guest_households
    set delivery_status = 'SENT'
    where id = (select household_id from guest_test_households where label = 'progress')
  $$,
  '42501',
  null,
  'Authenticated managers cannot bypass the delivery workflow'
);

with inserted as (
  insert into public.guest_groups (wedding_id, name, sort_order)
  values ('10000000-0000-0000-0000-000000000301', 'Family', 10)
  returning id
)
insert into guest_test_groups (label, group_id)
select 'family', id from inserted;

with inserted as (
  insert into public.guest_groups (wedding_id, name, sort_order)
  values ('10000000-0000-0000-0000-000000000301', 'Friends', 20)
  returning id
)
insert into guest_test_groups (label, group_id)
select 'friends', id from inserted;

insert into public.guest_group_memberships (wedding_id, guest_group_id, guest_id)
values
  ('10000000-0000-0000-0000-000000000301', (select group_id from guest_test_groups where label = 'family'), (select guest_id from guest_test_people where label = 'progress-1')),
  ('10000000-0000-0000-0000-000000000301', (select group_id from guest_test_groups where label = 'friends'), (select guest_id from guest_test_people where label = 'progress-1')),
  ('10000000-0000-0000-0000-000000000301', (select group_id from guest_test_groups where label = 'family'), (select guest_id from guest_test_people where label = 'progress-2'));

select extensions.is(
  (
    select count(*)
    from public.guest_group_memberships
    where guest_id = (select guest_id from guest_test_people where label = 'progress-1')
  ),
  2::bigint,
  'One Guest may belong to multiple Groups'
);

select extensions.is(
  (
    select count(*)
    from public.guest_group_memberships
    where guest_group_id = (select group_id from guest_test_groups where label = 'family')
  ),
  2::bigint,
  'One Group may contain multiple Guests'
);

select extensions.throws_ok(
  $$
    insert into public.guest_group_memberships (wedding_id, guest_group_id, guest_id)
    values (
      '10000000-0000-0000-0000-000000000301',
      (select group_id from guest_test_groups where label = 'family'),
      (select guest_id from guest_test_people where label = 'progress-1')
    )
  $$,
  '23505',
  null,
  'Duplicate Guest Group membership is rejected'
);

set local role postgres;
select extensions.throws_ok(
  $$
    insert into public.guest_group_memberships (wedding_id, guest_group_id, guest_id)
    values (
      '10000000-0000-0000-0000-000000000302',
      (select group_id from guest_test_groups where label = 'family'),
      (select guest_id from guest_test_people where label = 'progress-1')
    )
  $$,
  '23503',
  null,
  'Cross-Wedding Group and Guest relation is rejected by composite foreign keys'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

delete from public.guest_groups
where id = (select group_id from guest_test_groups where label = 'friends');

select extensions.ok(
  exists (
    select 1 from public.guests
    where id = (select guest_id from guest_test_people where label = 'progress-1')
  ),
  'Removing a Group does not remove its Guests'
);

with inserted as (
  insert into public.guest_allowances (
    wedding_id,
    household_id,
    sponsor_guest_id,
    allowance_type,
    max_count
  )
  values (
    '10000000-0000-0000-0000-000000000301',
    (select household_id from guest_test_households where label = 'plus-one'),
    (select guest_id from guest_test_people where label = 'partner'),
    'PLUS_ONE',
    1
  )
  returning id
)
insert into guest_test_allowances (label, allowance_id)
select 'plus-one', id from inserted;

select extensions.is(
  (
    select count(*)
    from public.guests
    where household_id = (select household_id from guest_test_households where label = 'plus-one')
  ),
  1::bigint,
  'Plus-One allowance exists without creating a synthetic Guest'
);

insert into guest_test_people (label, person_id, guest_id)
select 'maria', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'plus-one'),
  'Maria Santos',
  'Maria',
  'Santos'
) as created;

select * from public.claim_guest_allowance(
  (select allowance_id from guest_test_allowances where label = 'plus-one'),
  (select guest_id from guest_test_people where label = 'maria')
);

with inserted as (
  insert into public.guest_allowances (
    wedding_id,
    household_id,
    sponsor_guest_id,
    allowance_type,
    max_count
  )
  values (
    '10000000-0000-0000-0000-000000000301',
    (select household_id from guest_test_households where label = 'plus-one'),
    null,
    'CHILD',
    1
  )
  returning id
)
insert into guest_test_allowances (label, allowance_id)
select 'incompatible-second', id from inserted;

select extensions.ok(
  exists (
    select 1
    from public.guest_allowances as allowance
    where allowance.id = (select allowance_id from guest_test_allowances where label = 'plus-one')
  )
  and exists (
    select 1
    from public.guest_allowance_claims as claim
    where claim.allowance_id = (select allowance_id from guest_test_allowances where label = 'plus-one')
      and claim.guest_id = (select guest_id from guest_test_people where label = 'maria')
  ),
  'Plus-One allowance remains and its claim references named Guest Maria'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_people
    where wedding_id = '10000000-0000-0000-0000-000000000301'
      and display_name = 'Plus One'
  ),
  0::bigint,
  'No synthetic Plus One Wedding Person exists'
);

insert into guest_test_people (label, person_id, guest_id)
select 'plus-one-extra', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'plus-one'),
  'Second Named Guest'
) as created;

select extensions.throws_ok(
  $$
    select public.claim_guest_allowance(
      (select allowance_id from guest_test_allowances where label = 'plus-one'),
      (select guest_id from guest_test_people where label = 'plus-one-extra')
    )
  $$,
  '23514',
  null,
  'Plus-One allowance capacity cannot be exceeded'
);

select extensions.throws_ok(
  $$
    select public.claim_guest_allowance(
      (select allowance_id from guest_test_allowances where label = 'plus-one'),
      (select guest_id from guest_test_people where label = 'progress-1')
    )
  $$,
  '23514',
  null,
  'Guest from another Household cannot claim a Plus-One allowance'
);

set local role postgres;
select extensions.throws_ok(
  $$
    insert into public.guest_allowance_claims (allowance_id, wedding_id, guest_id)
    values (
      (select allowance_id from guest_test_allowances where label = 'plus-one'),
      '10000000-0000-0000-0000-000000000301',
      (select guest_id from guest_test_people where label = 'wedding-b-guest')
    )
  $$,
  '23514',
  null,
  'Actual Guest from another Wedding cannot claim an allowance'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

insert into guest_test_people (label, person_id, guest_id)
select 'child-parent', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'child'),
  'Child Parent'
) as created;

with inserted as (
  insert into public.guest_allowances (
    wedding_id,
    household_id,
    sponsor_guest_id,
    allowance_type,
    max_count
  )
  values (
    '10000000-0000-0000-0000-000000000301',
    (select household_id from guest_test_households where label = 'child'),
    null,
    'CHILD',
    1
  )
  returning id
)
insert into guest_test_allowances (label, allowance_id)
select 'child', id from inserted;

select extensions.is(
  (
    select count(*)
    from public.guests
    where household_id = (select household_id from guest_test_households where label = 'child')
  ),
  1::bigint,
  'CHILD allowance capacity does not create a fake child Guest'
);

insert into guest_test_people (label, person_id, guest_id)
select 'named-child', created.person_id, created.guest_id
from public.create_guest(
  '10000000-0000-0000-0000-000000000301',
  (select household_id from guest_test_households where label = 'child'),
  'Named Child',
  'Named',
  'Child'
) as created;

select * from public.claim_guest_allowance(
  (select allowance_id from guest_test_allowances where label = 'child'),
  (select guest_id from guest_test_people where label = 'named-child')
);

select extensions.ok(
  exists (
    select 1
    from public.wedding_people
    where id = (select person_id from guest_test_people where label = 'named-child')
  )
  and exists (
    select 1
    from public.guest_allowance_claims
    where allowance_id = (select allowance_id from guest_test_allowances where label = 'child')
      and guest_id = (select guest_id from guest_test_people where label = 'named-child')
  ),
  'Named child is an actual Wedding Person and Guest linked by a separate allowance claim'
);

select extensions.throws_ok(
  $$
    select public.claim_guest_allowance(
      (select allowance_id from guest_test_allowances where label = 'incompatible-second'),
      (select guest_id from guest_test_people where label = 'maria')
    )
  $$,
  '23505',
  null,
  'One Guest cannot consume multiple incompatible allowances'
);

select extensions.throws_ok(
  $$
    select public.claim_guest_allowance(
      (select allowance_id from guest_test_allowances where label = 'child'),
      (select guest_id from guest_test_people where label = 'child-parent')
    )
  $$,
  '23514',
  null,
  'CHILD allowance max_count is enforced'
);

with inserted as (
  insert into public.entourage_roles (wedding_id, name, sort_order)
  values ('10000000-0000-0000-0000-000000000301', 'Custom Lead', 10)
  returning id
)
insert into guest_test_roles (label, role_id)
select 'lead', id from inserted;

with inserted as (
  insert into public.entourage_roles (wedding_id, name, description, sort_order, preset_key)
  values ('10000000-0000-0000-0000-000000000301', 'Custom Support', 'Entirely customizable', 20, 'custom_support')
  returning id
)
insert into guest_test_roles (label, role_id)
select 'support', id from inserted;

select extensions.is(
  (
    select count(*)
    from public.entourage_assignments
    where role_id = (select role_id from guest_test_roles where label = 'lead')
  ),
  0::bigint,
  'Entourage Role may exist with zero Guests'
);

insert into public.entourage_assignments (wedding_id, role_id, guest_id)
values
  ('10000000-0000-0000-0000-000000000301', (select role_id from guest_test_roles where label = 'lead'), (select guest_id from guest_test_people where label = 'progress-1')),
  ('10000000-0000-0000-0000-000000000301', (select role_id from guest_test_roles where label = 'support'), (select guest_id from guest_test_people where label = 'progress-1')),
  ('10000000-0000-0000-0000-000000000301', (select role_id from guest_test_roles where label = 'lead'), (select guest_id from guest_test_people where label = 'progress-2'));

select extensions.is(
  (
    select count(*)
    from public.entourage_assignments
    where guest_id = (select guest_id from guest_test_people where label = 'progress-1')
  ),
  2::bigint,
  'One Guest may hold multiple Entourage Roles'
);

select extensions.is(
  (
    select count(*)
    from public.entourage_assignments
    where role_id = (select role_id from guest_test_roles where label = 'lead')
  ),
  2::bigint,
  'One Entourage Role may contain multiple Guests'
);

select extensions.throws_ok(
  $$
    insert into public.entourage_assignments (wedding_id, role_id, guest_id)
    values (
      '10000000-0000-0000-0000-000000000301',
      (select role_id from guest_test_roles where label = 'lead'),
      (select guest_id from guest_test_people where label = 'progress-1')
    )
  $$,
  '23505',
  null,
  'Duplicate Guest and Entourage Role assignment is rejected'
);

set local role postgres;
select extensions.throws_ok(
  $$
    insert into public.entourage_assignments (wedding_id, role_id, guest_id)
    values (
      '10000000-0000-0000-0000-000000000302',
      (select role_id from guest_test_roles where label = 'lead'),
      (select guest_id from guest_test_people where label = 'progress-1')
    )
  $$,
  '23503',
  null,
  'Cross-Wedding Entourage assignment is rejected by composite foreign keys'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

select extensions.is(
  (
    select rsvp.status
    from public.guest_rsvps as rsvp
    where rsvp.guest_id = (select guest_id from guest_test_people where label = 'progress-1')
  ),
  'ATTENDING'::public.guest_rsvp_status,
  'Entourage assignment does not change RSVP status'
);

delete from public.entourage_assignments
where role_id = (select role_id from guest_test_roles where label = 'support')
  and guest_id = (select guest_id from guest_test_people where label = 'progress-1');

select extensions.ok(
  exists (
    select 1 from public.guests
    where id = (select guest_id from guest_test_people where label = 'progress-1')
  ),
  'Removing an Entourage assignment does not remove Guest'
);

delete from public.entourage_roles
where id = (select role_id from guest_test_roles where label = 'lead');

select extensions.ok(
  exists (
    select 1 from public.guests
    where id = (select guest_id from guest_test_people where label = 'progress-2')
  ),
  'Removing an Entourage Role deletes assignments but never Guests'
);

select extensions.is(
  (
    select count(*)
    from public.entourage_roles
    where wedding_id = '10000000-0000-0000-0000-000000000301'
      and preset_key is not null
  ),
  1::bigint,
  'No religious preset is required; optional preset_key remains customizable metadata'
);

select extensions.throws_ok(
  $$
    delete from public.guest_households
    where id = (select household_id from guest_test_households where label = 'progress')
  $$,
  '23503',
  null,
  'Household deletion fails while it still contains Guests'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select extensions.throws_ok(
  $$
    insert into public.guest_groups (wedding_id, name)
    values ('10000000-0000-0000-0000-000000000301', 'Denied Day Group')
  $$,
  '42501',
  null,
  'Day-of Coordinator cannot mutate Guest Groups'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
insert into public.guest_groups (wedding_id, name)
values ('10000000-0000-0000-0000-000000000301', 'Full Coordinator Group');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
insert into public.guest_groups (wedding_id, name)
values ('10000000-0000-0000-0000-000000000301', 'Guest Coordinator Group');

select extensions.ok(
  (
    select count(*) = 2
    from public.guest_groups
    where name in ('Full Coordinator Group', 'Guest Coordinator Group')
  ),
  'Full Coordinator and Guest Coordinator both have Guest-domain write access'
);

set local role anon;
select extensions.throws_ok(
  $$select count(*) from public.guests$$,
  '42501',
  null,
  'anon has no Guest List access'
);

set local role postgres;

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guest_households'
      and column_name in ('rsvp_status', 'guest_count')
  ),
  'Household RSVP progress and Guest counts are not stored mutable columns'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('guests', 'guest_rsvps')
      and column_name in ('checked_in', 'checked_in_at', 'table_id', 'seat_id', 'guest_pass_token')
  ),
  'Guest foundation contains no Check-In, Seating, or Guest Pass fields'
);

select * from extensions.finish();

rollback;
