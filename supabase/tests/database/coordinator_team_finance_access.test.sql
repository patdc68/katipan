begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
select extensions.no_plan();

insert into auth.users
  (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000601','authenticated','authenticated','team-owner@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000602','authenticated','authenticated','team-controller@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000603','authenticated','authenticated','team-full@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000604','authenticated','authenticated','team-day@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000605','authenticated','authenticated','team-guest@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000606','authenticated','authenticated','team-existing-day@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000607','authenticated','authenticated','team-existing-guest@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000608','authenticated','authenticated','team-unrelated@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000609','authenticated','authenticated','team-controller-invite@katipan.test',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000610','authenticated','authenticated','team-unverified@katipan.test',null,'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000611','authenticated','authenticated','team-other-owner@katipan.test',now(),'{}','{}',now(),now());

insert into public.weddings
  (id, origin, status, ownership_mode, created_by_user_id, display_name)
values
  ('10000000-0000-0000-0000-000000000601','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000601','Team Wedding A'),
  ('10000000-0000-0000-0000-000000000602','COORDINATOR_CREATED','ACTIVE','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000000602','Team Wedding B'),
  ('10000000-0000-0000-0000-000000000603','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000611','Team Wedding C');

insert into public.wedding_memberships
  (id, wedding_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000601','10000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000601','OWNER'),
  ('20000000-0000-0000-0000-000000000602','10000000-0000-0000-0000-000000000602','00000000-0000-0000-0000-000000000602','FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000606','10000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000606','DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000607','10000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000607','GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000611','10000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000611','OWNER');
set constraints all immediate;

create temporary table team_tokens (
  label text primary key, invitation_id uuid not null, raw_token text not null
);
create temporary table team_membership_state (label text primary key, membership_id uuid not null);
grant all on table team_tokens, team_membership_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
insert into team_tokens select 'full', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR',' TEAM-FULL@KATIPAN.TEST ');
insert into team_tokens select 'day', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','DAY_OF_COORDINATOR');
insert into team_tokens select 'guest', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','GUEST_COORDINATOR','team-guest@katipan.test');

select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','OWNER')$$,
  '22023', null, 'Coordinator invitation cannot create an Owner');
select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000603','FULL_COORDINATOR')$$,
  '42501', null, 'Owner cannot invite into another Wedding');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000606',true);
select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR')$$,
  '42501', null, 'Day-of Coordinator cannot invite');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000607',true);
select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR')$$,
  '42501', null, 'Guest Coordinator cannot invite');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000608',true);
select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR')$$,
  '42501', null, 'Unrelated user cannot invite');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000602',true);
insert into team_tokens select 'controller', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000602','FULL_COORDINATOR','team-controller-invite@katipan.test');
select extensions.throws_ok(
  $$select * from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR')$$,
  '42501', null, 'Temporary controller cannot invite on another Wedding');

set local role postgres;
select extensions.ok(
  (select count(*) from team_tokens where length(raw_token) = 64) = 4
  and (select count(*) from public.wedding_invitations i join team_tokens t on t.invitation_id = i.id
    where i.target_person_id is null and i.status = 'PENDING') = 4
  and (select count(*) from private.wedding_invitation_secrets s join team_tokens t on t.invitation_id = s.invitation_id
    where s.token_hash = extensions.digest(t.raw_token,'sha256')) = 4,
  'Three Owner roles and controller role use opaque digest-backed invitations');
select extensions.is(
  (select invited_email from public.wedding_invitations where id = (select invitation_id from team_tokens where label = 'full')),
  'team-full@katipan.test', 'Bound email is normalized');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000603',true);
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'full'))),
  'FULL_COORDINATOR', 'Owner invitation accepts Full Coordinator');
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'full')),
  '22023', null, 'Accepted coordinator token cannot replay');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000604',true);
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'day'))),
  'DAY_OF_COORDINATOR', 'Owner invitation accepts Day-of Coordinator');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000605',true);
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'guest'))),
  'GUEST_COORDINATOR', 'Owner invitation accepts Guest Coordinator');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000609',true);
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'controller'))),
  'FULL_COORDINATOR', 'Temporary controller invitation accepts a second Coordinator');

set local role postgres;
insert into team_membership_state
  select 'guest', id from public.wedding_memberships
    where wedding_id = '10000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000605';
select extensions.ok(
  (select count(*) from public.wedding_memberships
    where wedding_id = '10000000-0000-0000-0000-000000000601' and status = 'ACTIVE') = 6
  and (select count(*) from public.wedding_memberships
    where wedding_id = '10000000-0000-0000-0000-000000000602' and status = 'ACTIVE') = 2,
  'Multiple Coordinators join without duplicate active memberships');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
insert into team_tokens select 'revoke', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR');
select extensions.is(
  (select invitation_status::text from public.revoke_wedding_invitation(
    (select invitation_id from team_tokens where label = 'revoke'))),
  'REVOKED', 'Existing invitation revocation handles team invitations');
insert into team_tokens select 'expired', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','FULL_COORDINATOR');

set local role postgres;
update public.wedding_invitations
  set created_at = now() - interval '8 days',
      expires_at = now() - interval '1 minute'
  where id = (select invitation_id from team_tokens where label = 'expired');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000608',true);
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'revoke')),
  '22023', null, 'Revoked coordinator invitation cannot replay');
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'expired')),
  '22023', null, 'Expired coordinator invitation cannot be accepted');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
insert into team_tokens select 'reissue_old', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601',
    'DAY_OF_COORDINATOR','team-unrelated@katipan.test');
insert into team_tokens select 'reissue_new', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601',
    'GUEST_COORDINATOR','team-unrelated@katipan.test');
select extensions.is(
  (select status::text from public.wedding_invitations
    where id = (select invitation_id from team_tokens where label = 'reissue_old')),
  'REVOKED', 'Reissuing to a bound email revokes the earlier token');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000608',true);
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'reissue_old')),
  '22023', null, 'Reissued old token cannot be accepted');
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'reissue_new'))),
  'GUEST_COORDINATOR', 'Newest bound token retains its intended role');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
insert into team_tokens select 'bound', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','DAY_OF_COORDINATOR','team-unverified@katipan.test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000608',true);
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'bound')),
  '22023', null, 'Bound email mismatch is denied');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000610',true);
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'bound')),
  '22023', null, 'Unverified bound email is denied');
set local role postgres;
update auth.users set email_confirmed_at = now()
  where id = '00000000-0000-0000-0000-000000000610';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000610',true);
select extensions.is(
  (select membership_role::text from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'bound'))),
  'DAY_OF_COORDINATOR', 'Verified bound email can accept');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
select extensions.is(
  (public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    (select id from public.wedding_memberships where user_id = '00000000-0000-0000-0000-000000000603'
      and wedding_id = '10000000-0000-0000-0000-000000000601'),'DAY_OF_COORDINATOR')).role::text,
  'DAY_OF_COORDINATOR', 'Owner changes Full to Day-of');
select extensions.is(
  (public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    (select id from public.wedding_memberships where user_id = '00000000-0000-0000-0000-000000000603'
      and wedding_id = '10000000-0000-0000-0000-000000000601'),'GUEST_COORDINATOR')).role::text,
  'GUEST_COORDINATOR', 'Owner changes Day-of to Guest');
select extensions.is(
  (public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    (select id from public.wedding_memberships where user_id = '00000000-0000-0000-0000-000000000603'
      and wedding_id = '10000000-0000-0000-0000-000000000601'),'FULL_COORDINATOR')).role::text,
  'FULL_COORDINATOR', 'Owner changes Guest to Full');
select extensions.throws_ok(
  $$select public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    '20000000-0000-0000-0000-000000000601','DAY_OF_COORDINATOR')$$,
  '22023', null, 'Owner cannot be demoted through coordinator workflow');
select extensions.throws_ok(
  $$select public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    '20000000-0000-0000-0000-000000000606','OWNER')$$,
  '22023', null, 'Coordinator role workflow cannot promote an Owner');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000603',true);
select extensions.throws_ok(
  $$select public.change_coordinator_role('10000000-0000-0000-0000-000000000601',
    '20000000-0000-0000-0000-000000000606','FULL_COORDINATOR')$$,
  '42501', null, 'Full Coordinator cannot change team roles on couple-owned Wedding');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000602',true);
select extensions.throws_ok(
  $$select public.change_coordinator_role('10000000-0000-0000-0000-000000000602',
    '20000000-0000-0000-0000-000000000602','GUEST_COORDINATOR')$$,
  '22023', null, 'Temporary controller cannot change their own role');
select extensions.is(
  (public.change_coordinator_role('10000000-0000-0000-0000-000000000602',
    (select id from public.wedding_memberships where wedding_id = '10000000-0000-0000-0000-000000000602'
      and user_id = '00000000-0000-0000-0000-000000000609'),'DAY_OF_COORDINATOR')).role::text,
  'DAY_OF_COORDINATOR', 'Temporary controller can change another Coordinator role');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
select extensions.is(
  (select membership_status::text from public.remove_wedding_member(
    '10000000-0000-0000-0000-000000000601',
    (select id from public.wedding_memberships where wedding_id = '10000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000605'))),
  'REMOVED', 'Removal remains the separate member workflow');
insert into team_tokens select 'reactivate', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601',
    'FULL_COORDINATOR','team-guest@katipan.test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000605',true);
select extensions.is(
  (select membership_id from public.accept_coordinator_invitation(
    (select raw_token from team_tokens where label = 'reactivate'))),
  (select membership_id from team_membership_state where label = 'guest'),
  'Reactivation preserves the existing membership ID');
select extensions.is(
  (select role::text || ':' || status::text from public.wedding_memberships
    where wedding_id = '10000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000605'),
  'FULL_COORDINATOR:ACTIVE', 'Reactivation sets the invited Coordinator role');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000601',true);
insert into team_tokens select 'active_duplicate', invitation_id, raw_token
  from public.issue_coordinator_invitation('10000000-0000-0000-0000-000000000601','GUEST_COORDINATOR');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000603',true);
select extensions.throws_ok(
  format('select * from public.accept_coordinator_invitation(%L)',
    (select raw_token from team_tokens where label = 'active_duplicate')),
  '22023', null, 'Invitation cannot duplicate or silently change an active membership');

set local role postgres;
select extensions.ok(
  not has_function_privilege('anon','public.issue_coordinator_invitation(uuid,public.wedding_membership_role,text)','EXECUTE')
  and not has_function_privilege('anon','public.accept_coordinator_invitation(text)','EXECUTE')
  and not has_function_privilege('anon','public.change_coordinator_role(uuid,uuid,public.wedding_membership_role)','EXECUTE')
  and has_function_privilege('authenticated','public.accept_coordinator_invitation(text)','EXECUTE'),
  'Only authenticated callers can execute team workflows');
select extensions.ok(
  (select count(*) from public.wedding_memberships where wedding_id = '10000000-0000-0000-0000-000000000601'
    and user_id = '00000000-0000-0000-0000-000000000603') = 1,
  'Role transitions preserve one membership identity');
select extensions.ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('issue_coordinator_invitation','accept_coordinator_invitation','change_coordinator_role')
      and p.prosecdef and 'search_path=""' = any(p.proconfig)) = 3,
  'New definer RPCs use a locked empty search path');

select * from extensions.finish();
rollback;
