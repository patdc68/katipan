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
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-a2@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'guest-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'coordinator@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'other-full@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (id, display_name, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', 'Owner A', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000002', 'Second Owner A', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000003', 'Full Coordinator A', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000004', 'Day-of Coordinator A', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000005', 'Guest Coordinator A', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000006', 'Unrelated User', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000007', 'Owner B', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000008', 'Coordinator Creator', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000000009', 'Other Full Coordinator', now() - interval '1 minute');

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name,
  updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000001', 'Wedding A', now() - interval '1 minute'),
  ('10000000-0000-0000-0000-000000000002', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000007', 'Wedding B', now() - interval '1 minute'),
  ('10000000-0000-0000-0000-000000000003', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000008', 'Coordinator Wedding', now() - interval '1 minute'),
  ('10000000-0000-0000-0000-000000000004', 'COORDINATOR_CREATED', 'DRAFT', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000008', 'Transition Wedding', now() - interval '1 minute'),
  ('10000000-0000-0000-0000-000000000005', 'COORDINATOR_CREATED', 'DRAFT', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000003', 'Full-Only Wedding', now() - interval '1 minute');

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'OWNER'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'OWNER'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 'OWNER'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000009', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'FULL_COORDINATOR');

insert into public.wedding_people (
  id,
  wedding_id,
  linked_user_id,
  display_name
)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Partner A1'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Partner A2'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', null, 'Additional Person A'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 'Partner B1');

insert into public.wedding_partners (
  wedding_id,
  person_id,
  partner_order
)
values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 2),
  ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 1);

set constraints all immediate;

select extensions.pass('Two active Owners satisfy the deferred Owner invariant');

select extensions.throws_ok(
  $$
    insert into public.wedding_partners (wedding_id, person_id, partner_order)
    values ('10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 1)
  $$,
  '23503',
  null,
  'A Person from Wedding A cannot be assigned as Partner of another Wedding'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_partners (wedding_id, person_id, partner_order)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 1)
  $$,
  '23505',
  null,
  'Partner positions are unique within a Wedding'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_memberships (wedding_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'OWNER')
  $$,
  '23505',
  null,
  'A User cannot have duplicate Membership rows in one Wedding'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_memberships (wedding_id, user_id, role, status)
    values ('10000000-0000-0000-0000-000000000001', null, 'GUEST_COORDINATOR', 'ACTIVE')
  $$,
  '23514',
  null,
  'An ACTIVE Membership requires a User'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_memberships (wedding_id, user_id, role, status, ended_at)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'GUEST_COORDINATOR', 'ACTIVE', now())
  $$,
  '23514',
  null,
  'An ACTIVE Membership cannot have ended_at'
);

select extensions.throws_ok(
  $$
    insert into public.wedding_memberships (wedding_id, user_id, role, status)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'GUEST_COORDINATOR', 'LEFT')
  $$,
  '23514',
  null,
  'A LEFT Membership requires ended_at'
);

select extensions.throws_ok(
  $$
    insert into public.weddings (origin, status, ownership_mode, created_by_user_id)
    values ('COUPLE_CREATED', 'DRAFT', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000001')
  $$,
  '23514',
  null,
  'COUPLE_CREATED cannot use COORDINATOR_MANAGED ownership'
);

select extensions.lives_ok(
  $$
    update public.weddings
    set ownership_mode = 'COUPLE_OWNED'
    where id = '10000000-0000-0000-0000-000000000004'
  $$,
  'COORDINATOR_MANAGED can transition to COUPLE_OWNED while structurally valid'
);

select extensions.throws_ok(
  $$
    update public.weddings
    set ownership_mode = 'COORDINATOR_MANAGED'
    where id = '10000000-0000-0000-0000-000000000004'
  $$,
  '23514',
  null,
  'COUPLE_OWNED cannot transition back to COORDINATOR_MANAGED'
);

select extensions.throws_ok(
  $$
    update public.weddings
    set origin = 'COUPLE_CREATED'
    where id = '10000000-0000-0000-0000-000000000004'
  $$,
  '23514',
  null,
  'Wedding origin is immutable'
);

select extensions.lives_ok(
  $$
    update public.wedding_memberships
    set status = 'LEFT', ended_at = now()
    where id = '20000000-0000-0000-0000-000000000002'
  $$,
  'One of two Owners may leave'
);

select extensions.throws_ok(
  $$
    update public.wedding_memberships
    set status = 'LEFT', ended_at = now()
    where id = '20000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'The final active Owner cannot leave an active couple-owned Wedding'
);

select extensions.throws_ok(
  $$
    update public.weddings
    set status = 'ACTIVE'
    where id = '10000000-0000-0000-0000-000000000005'
  $$,
  '23514',
  null,
  'A FULL_COORDINATOR does not satisfy the Owner invariant'
);

select extensions.ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated has only the private schema usage needed by RLS helpers'
);

select extensions.ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private schema'
);

select extensions.ok(
  has_function_privilege('authenticated', 'private.has_active_wedding_membership(uuid)', 'EXECUTE'),
  'authenticated can execute the current-user membership helper used by RLS'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.has_active_wedding_membership(uuid)', 'EXECUTE'),
  'anon cannot execute private membership helpers'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select extensions.is(
  (select count(*) from public.weddings),
  1::bigint,
  'OWNER sees only their active Wedding'
);

select extensions.is(
  (select count(*) from public.wedding_people),
  3::bigint,
  'OWNER sees only People in their Wedding'
);

select extensions.is(
  (select count(*) from public.wedding_partners),
  2::bigint,
  'OWNER sees only Partners in their Wedding'
);

select extensions.is(
  (select count(*) from public.wedding_memberships),
  5::bigint,
  'OWNER sees only Memberships in their Wedding'
);

select extensions.is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  1::bigint,
  'OWNER can see an active co-member Profile'
);

select extensions.is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000007'),
  0::bigint,
  'OWNER cannot enumerate a Profile from another Wedding'
);

select extensions.lives_ok(
  $$
    update public.profiles
    set display_name = 'Owner A Updated'
    where id = '00000000-0000-0000-0000-000000000001'
  $$,
  'A User can update their own Profile'
);

select extensions.is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'Owner A Updated',
  'The own-Profile update changes the intended row'
);

select extensions.ok(
  (
    select updated_at > now() - interval '1 minute'
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'
  ),
  'Profile updated_at is managed by the database trigger'
);

select extensions.lives_ok(
  $$
    update public.profiles
    set display_name = 'Forbidden Change'
    where id = '00000000-0000-0000-0000-000000000003'
  $$,
  'Updating another Profile is safely filtered by RLS'
);

select extensions.is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'Full Coordinator A',
  'A User cannot update another Profile'
);

select extensions.lives_ok(
  $$
    update public.weddings
    set display_name = 'Owner Updated Wedding'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  'OWNER can update allowed Wedding profile columns'
);

select extensions.is(
  (select display_name from public.weddings where id = '10000000-0000-0000-0000-000000000001'),
  'Owner Updated Wedding',
  'The OWNER Wedding update changes the intended row'
);

select extensions.throws_ok(
  $$
    update public.weddings
    set ownership_mode = 'COORDINATOR_MANAGED'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'OWNER cannot directly update ownership_mode'
);

select extensions.throws_ok(
  $$
    update public.wedding_memberships
    set role = 'OWNER'
    where id = '20000000-0000-0000-0000-000000000003'
  $$,
  '42501',
  null,
  'OWNER cannot directly change Membership roles'
);

select extensions.throws_ok(
  $$
    delete from public.weddings
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'OWNER cannot directly delete a Wedding'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select extensions.is((select count(*) from public.weddings), 2::bigint, 'FULL_COORDINATOR can read Weddings where they have active Memberships');

select extensions.lives_ok(
  $$
    update public.weddings
    set general_location = 'Updated by Full Coordinator'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  'FULL_COORDINATOR can update allowed Wedding profile fields'
);

select extensions.is(
  (select general_location from public.weddings where id = '10000000-0000-0000-0000-000000000001'),
  'Updated by Full Coordinator',
  'The FULL_COORDINATOR update changes the intended field'
);

select extensions.throws_ok(
  $$
    update public.weddings
    set origin = 'COORDINATOR_CREATED'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  'FULL_COORDINATOR cannot directly update origin'
);

select extensions.throws_ok(
  $$
    update public.wedding_memberships
    set status = 'REMOVED', ended_at = now()
    where id = '20000000-0000-0000-0000-000000000004'
  $$,
  '42501',
  null,
  'FULL_COORDINATOR cannot directly update Membership status'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);

select extensions.is((select count(*) from public.weddings), 1::bigint, 'DAY_OF_COORDINATOR can read their Wedding');

select extensions.lives_ok(
  $$
    update public.weddings
    set display_name = 'Forbidden Day-of Update'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  'DAY_OF_COORDINATOR update is safely filtered by RLS'
);

select extensions.is(
  (select display_name from public.weddings where id = '10000000-0000-0000-0000-000000000001'),
  'Owner Updated Wedding',
  'DAY_OF_COORDINATOR cannot update general Wedding profile fields'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

select extensions.is((select count(*) from public.weddings), 1::bigint, 'GUEST_COORDINATOR can read their Wedding');

select extensions.lives_ok(
  $$
    update public.weddings
    set display_name = 'Forbidden Guest Coordinator Update'
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  'GUEST_COORDINATOR update is safely filtered by RLS'
);

select extensions.is(
  (select display_name from public.weddings where id = '10000000-0000-0000-0000-000000000001'),
  'Owner Updated Wedding',
  'GUEST_COORDINATOR cannot update general Wedding profile fields'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);

select extensions.is((select count(*) from public.weddings), 0::bigint, 'Unrelated User sees no Weddings');
select extensions.is((select count(*) from public.wedding_people), 0::bigint, 'Unrelated User sees no Wedding People');
select extensions.is((select count(*) from public.wedding_partners), 0::bigint, 'Unrelated User sees no Wedding Partners');
select extensions.is((select count(*) from public.wedding_memberships), 0::bigint, 'Unrelated User sees no Wedding Memberships');
select extensions.is((select count(*) from public.profiles), 1::bigint, 'Unrelated User sees only their own Profile');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);

select extensions.is(
  (select array_agg(id order by id) from public.weddings),
  array['10000000-0000-0000-0000-000000000002'::uuid],
  'Wedding B Owner cannot read Wedding A'
);

select extensions.is((select count(*) from public.wedding_people), 1::bigint, 'Wedding B Owner sees only Wedding B People');
select extensions.is((select count(*) from public.wedding_partners), 1::bigint, 'Wedding B Owner sees only Wedding B Partners');
select extensions.is((select count(*) from public.wedding_memberships), 1::bigint, 'Wedding B Owner sees only Wedding B Memberships');

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', true);

select extensions.ok(
  (select private.controls_coordinator_managed_wedding('10000000-0000-0000-0000-000000000003')),
  'Creating active FULL_COORDINATOR controls their COORDINATOR_MANAGED Wedding'
);

select extensions.ok(
  not (select private.controls_coordinator_managed_wedding('10000000-0000-0000-0000-000000000004')),
  'Temporary coordinator control disappears after transition to COUPLE_OWNED'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', true);

select extensions.ok(
  not (select private.controls_coordinator_managed_wedding('10000000-0000-0000-0000-000000000003')),
  'An active FULL_COORDINATOR who is not the creator has no temporary workspace control'
);

set local role postgres;

select * from extensions.finish();

rollback;
