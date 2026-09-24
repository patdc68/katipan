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
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'alice@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'ben@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'maria@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'carlo@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated', 'bea@katipan.test', null, '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000106', 'authenticated', 'authenticated', 'unrelated@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000107', 'authenticated', 'authenticated', 'coordinator-two@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000108', 'authenticated', 'authenticated', 'candidate@katipan.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

create temporary table workflow_state (
  label text primary key,
  wedding_id uuid not null,
  person_1_id uuid,
  person_2_id uuid,
  membership_id uuid
);

create temporary table invitation_state (
  label text primary key,
  invitation_id uuid not null,
  raw_token text not null,
  expires_at timestamptz not null
);

create temporary table acceptance_state (
  label text primary key,
  invitation_id uuid not null,
  wedding_id uuid not null,
  person_id uuid not null,
  membership_id uuid,
  ownership_transitioned boolean not null,
  already_accepted boolean not null
);

grant all on table workflow_state, invitation_state, acceptance_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

insert into workflow_state (
  label,
  wedding_id,
  person_1_id,
  person_2_id,
  membership_id
)
select
  'couple',
  created.wedding_id,
  created.current_person_id,
  created.second_partner_person_id,
  created.membership_id
from public.create_couple_wedding(
  ' Alice and Ben ',
  ' Alice ',
  ' Ben ',
  '2027-06-12',
  ' Asia/Manila ',
  ' Manila ',
  120,
  'RELIGIOUS'
) as created;

set local role postgres;

select extensions.is(
  (
    select wedding.origin::text || ':' || wedding.ownership_mode::text || ':' || wedding.status::text
    from public.weddings as wedding
    where wedding.id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
  ),
  'COUPLE_CREATED:COUPLE_OWNED:DRAFT',
  'Couple creation fixes origin, ownership mode, and status'
);

select extensions.is(
  (
    select membership.role::text || ':' || membership.status::text
    from public.wedding_memberships as membership
    where membership.id = (select state.membership_id from workflow_state as state where state.label = 'couple')
  ),
  'OWNER:ACTIVE',
  'Couple creator receives one active Owner Membership'
);

select extensions.is(
  (
    select person.linked_user_id
    from public.wedding_people as person
    where person.id = (select state.person_1_id from workflow_state as state where state.label = 'couple')
  ),
  '00000000-0000-0000-0000-000000000101'::uuid,
  'Couple creator is linked to the existing Partner 1 Person'
);

select extensions.is(
  (
    select partner.partner_order::integer
    from public.wedding_partners as partner
    where partner.person_id = (select state.person_1_id from workflow_state as state where state.label = 'couple')
  ),
  1,
  'Couple creator is Partner 1'
);

select extensions.ok(
  (
    select partner.joined_workspace_at is not null
    from public.wedding_partners as partner
    where partner.person_id = (select state.person_1_id from workflow_state as state where state.label = 'couple')
  ),
  'Couple creator has a joined workspace timestamp'
);

select extensions.is(
  (
    select person.linked_user_id
    from public.wedding_people as person
    where person.id = (select state.person_2_id from workflow_state as state where state.label = 'couple')
  ),
  null::uuid,
  'Optional second Partner is created without an account link'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
  ),
  1::bigint,
  'Couple creation does not create a Membership for the unjoined second Partner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);

select extensions.is(
  (
    select count(*)
    from public.weddings as wedding
    where wedding.id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
  ),
  0::bigint,
  'An unrelated User cannot read the new couple-owned Wedding'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

insert into workflow_state (
  label,
  wedding_id,
  person_1_id,
  person_2_id
)
select
  'coordinator',
  created.wedding_id,
  created.partner_1_person_id,
  created.partner_2_person_id
from public.create_coordinator_managed_wedding(
  ' Carlo and Bea ',
  ' Carlo ',
  ' Bea ',
  '2027-11-20',
  'Asia/Manila',
  'Cebu City',
  180,
  'CIVIL'
) as created;

set local role postgres;

select extensions.is(
  (
    select wedding.origin::text || ':' || wedding.ownership_mode::text || ':' || wedding.status::text
    from public.weddings as wedding
    where wedding.id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'COORDINATOR_CREATED:COORDINATOR_MANAGED:DRAFT',
  'Coordinator creation fixes origin, ownership mode, and status'
);

select extensions.is(
  (
    select membership.role::text || ':' || membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000103'
  ),
  'FULL_COORDINATOR:ACTIVE',
  'Coordinator creator receives an active Full Coordinator Membership'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_people as person
    where person.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and person.linked_user_id is null
  ),
  2::bigint,
  'Coordinator creation creates two unlinked client People'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.role = 'OWNER'
      and membership.status = 'ACTIVE'
  ),
  0::bigint,
  'Coordinator-managed Wedding initially has zero Owners'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

select extensions.ok(
  private.controls_coordinator_managed_wedding(
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'Coordinator creator controls the coordinator-managed workspace through the derived rule'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.leave_wedding(%L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  '23514',
  null,
  'Temporary coordinator-managed controller cannot leave'
);

set local role postgres;
set constraints all immediate;

select extensions.throws_ok(
  pg_catalog.format(
    'update public.wedding_memberships set role = ''DAY_OF_COORDINATOR'' where wedding_id = %L::uuid and user_id = %L::uuid',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    '00000000-0000-0000-0000-000000000103'
  ),
  '23514',
  null,
  'Controller invariant prevents the creator losing Full Coordinator role while coordinator-managed'
);

set constraints all deferred;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);

select extensions.ok(
  not private.controls_coordinator_managed_wedding(
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'An unrelated coordinator does not control the workspace'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.issue_partner_owner_invitation(%L::uuid, %L::uuid, null)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (select state.person_1_id from workflow_state as state where state.label = 'coordinator')
  ),
  '42501',
  null,
  'Unrelated User cannot issue a Partner Owner invitation'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

insert into invitation_state
select
  'carlo_expired',
  issued.invitation_id,
  issued.raw_token,
  issued.invitation_expires_at
from public.issue_partner_owner_invitation(
  (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
  (select state.person_1_id from workflow_state as state where state.label = 'coordinator'),
  '  CARLO@KATIPAN.TEST  '
) as issued;

set local role postgres;

select extensions.is(
  (
    select invitation.invited_email
    from public.wedding_invitations as invitation
    where invitation.id = (select state.invitation_id from invitation_state as state where state.label = 'carlo_expired')
  ),
  'carlo@katipan.test',
  'Invited email is trimmed and normalized to lowercase'
);

select extensions.matches(
  (select state.raw_token from invitation_state as state where state.label = 'carlo_expired'),
  '^[0-9a-f]{64}$',
  'Issued token is a 256-bit lowercase hexadecimal secret'
);

select extensions.is(
  (
    select pg_catalog.octet_length(secret.token_hash)
    from private.wedding_invitation_secrets as secret
    where secret.invitation_id = (select state.invitation_id from invitation_state as state where state.label = 'carlo_expired')
  ),
  32,
  'Only a 32-byte SHA-256 digest is stored'
);

select extensions.ok(
  (
    select secret.token_hash = extensions.digest(state.raw_token, 'sha256')
    from private.wedding_invitation_secrets as secret
    join invitation_state as state
      on state.invitation_id = secret.invitation_id
    where state.label = 'carlo_expired'
  ),
  'Persisted digest matches the one-time raw token'
);

select extensions.is(
  (
    select count(*)
    from information_schema.columns as column_info
    where column_info.table_schema in ('public', 'private')
      and column_info.table_name in ('wedding_invitations', 'wedding_invitation_secrets')
      and column_info.column_name in ('raw_token', 'token')
  ),
  0::bigint,
  'No invitation table has a raw token column'
);

update public.wedding_invitations as invitation
set
  created_at = pg_catalog.now() - interval '8 days',
  expires_at = pg_catalog.now() - interval '1 day'
where invitation.id = (select state.invitation_id from invitation_state as state where state.label = 'carlo_expired');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (select state.raw_token from invitation_state as state where state.label = 'carlo_expired')
  ),
  '22023',
  'Invitation cannot be accepted.',
  'Expired pending token is rejected without persisting EXPIRED status'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

insert into invitation_state
select
  'carlo_revoked',
  issued.invitation_id,
  issued.raw_token,
  issued.invitation_expires_at
from public.issue_partner_owner_invitation(
  (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
  (select state.person_1_id from workflow_state as state where state.label = 'coordinator'),
  'carlo@katipan.test'
) as issued;

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.revoke_wedding_invitation(%L::uuid)',
    (select state.invitation_id from invitation_state as state where state.label = 'carlo_revoked')
  ),
  'Temporary controller can revoke a pending invitation'
);

set local role postgres;

select extensions.is(
  (
    select invitation.status::text
    from public.wedding_invitations as invitation
    where invitation.id = (select state.invitation_id from invitation_state as state where state.label = 'carlo_expired')
  ),
  'REVOKED',
  'Reissue revokes the previous pending invitation even when its expiration is derived'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (select state.raw_token from invitation_state as state where state.label = 'carlo_revoked')
  ),
  '22023',
  'Invitation cannot be accepted.',
  'Revoked raw token cannot be used'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

insert into invitation_state
select
  'carlo_valid',
  issued.invitation_id,
  issued.raw_token,
  issued.invitation_expires_at
from public.issue_partner_owner_invitation(
  (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
  (select state.person_1_id from workflow_state as state where state.label = 'coordinator'),
  'carlo@katipan.test'
) as issued;

insert into invitation_state
select
  'bea_valid',
  issued.invitation_id,
  issued.raw_token,
  issued.invitation_expires_at
from public.issue_partner_owner_invitation(
  (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
  (select state.person_2_id from workflow_state as state where state.label = 'coordinator'),
  'bea@katipan.test'
) as issued;

set local role postgres;

select extensions.is(
  (
    select count(*)
    from public.wedding_invitations as invitation
    where invitation.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and invitation.target_person_id = (select state.person_1_id from workflow_state as state where state.label = 'coordinator')
      and invitation.status = 'PENDING'
  ),
  1::bigint,
  'Reissue leaves exactly one pending invitation for a target Partner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.throws_ok(
  $$select * from public.accept_wedding_invitation('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')$$,
  '22023',
  'Invitation cannot be accepted.',
  'Random well-formed token is rejected generically'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (
      select pg_catalog.left(state.raw_token, 63)
        || case pg_catalog.right(state.raw_token, 1) when '0' then '1' else '0' end
      from invitation_state as state
      where state.label = 'carlo_valid'
    )
  ),
  '22023',
  'Invitation cannot be accepted.',
  'One-character token modification is rejected generically'
);

insert into acceptance_state
select
  'carlo_first',
  accepted.invitation_id,
  accepted.wedding_id,
  accepted.person_id,
  accepted.membership_id,
  accepted.ownership_transitioned,
  accepted.already_accepted
from public.accept_wedding_invitation(
  (select state.raw_token from invitation_state as state where state.label = 'carlo_valid')
) as accepted;

select extensions.ok(
  (
    select accepted.ownership_transitioned and not accepted.already_accepted
    from acceptance_state as accepted
    where accepted.label = 'carlo_first'
  ),
  'First Partner acceptance reports the coordinator-managed ownership transition'
);

insert into acceptance_state
select
  'carlo_retry',
  accepted.invitation_id,
  accepted.wedding_id,
  accepted.person_id,
  accepted.membership_id,
  accepted.ownership_transitioned,
  accepted.already_accepted
from public.accept_wedding_invitation(
  (select state.raw_token from invitation_state as state where state.label = 'carlo_valid')
) as accepted;

select extensions.ok(
  (
    select accepted.already_accepted and not accepted.ownership_transitioned
    from acceptance_state as accepted
    where accepted.label = 'carlo_retry'
  ),
  'Same User retry is an idempotent stable success'
);

set local role postgres;

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000104'
  ),
  1::bigint,
  'Acceptance retry does not duplicate the Owner Membership'
);

select extensions.is(
  (
    select wedding.ownership_mode::text
    from public.weddings as wedding
    where wedding.id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'COUPLE_OWNED',
  'First Partner acceptance transitions the existing Wedding to couple-owned'
);

select extensions.is(
  (
    select membership.role::text || ':' || membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000103'
  ),
  'FULL_COORDINATOR:ACTIVE',
  'Coordinator remains an active Full Coordinator after ownership transition'
);

select extensions.is(
  (
    select person.linked_user_id
    from public.wedding_people as person
    where person.id = (select state.person_1_id from workflow_state as state where state.label = 'coordinator')
  ),
  '00000000-0000-0000-0000-000000000104'::uuid,
  'Acceptance links the existing Carlo Person to Carlo account'
);

select extensions.is(
  (
    select person.linked_user_id
    from public.wedding_people as person
    where person.id = (select state.person_2_id from workflow_state as state where state.label = 'coordinator')
  ),
  null::uuid,
  'Carlo acceptance does not link Bea Person'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000105'
  ),
  0::bigint,
  'Carlo acceptance does not create Bea Membership'
);

select extensions.is(
  (
    select count(*)
    from public.weddings as wedding
    where wedding.id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  1::bigint,
  'Ownership transition preserves the existing Wedding ID without cloning'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

select extensions.ok(
  not private.controls_coordinator_managed_wedding(
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'Temporary controller authority disappears after transition'
);

select extensions.is(
  (select count(*) from public.wedding_invitations),
  0::bigint,
  'Normal Full Coordinator cannot read Owner invitations after couple ownership begins'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.issue_partner_owner_invitation(%L::uuid, %L::uuid, null)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (select state.person_2_id from workflow_state as state where state.label = 'coordinator')
  ),
  '42501',
  null,
  'Normal Full Coordinator cannot manage Owner invitations on couple-owned Wedding'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (select state.raw_token from invitation_state as state where state.label = 'carlo_valid')
  ),
  '22023',
  'Invitation cannot be accepted.',
  'Accepted token replay by another User is denied'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (select state.raw_token from invitation_state as state where state.label = 'bea_valid')
  ),
  '22023',
  'Invitation cannot be accepted.',
  'Optional invited-email mismatch is denied'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.accept_wedding_invitation(%L)',
    (select state.raw_token from invitation_state as state where state.label = 'bea_valid')
  ),
  '22023',
  'Invitation cannot be accepted.',
  'Matching but unverified Auth email is denied'
);

set local role postgres;

update auth.users as auth_user
set email_confirmed_at = pg_catalog.now()
where auth_user.id = '00000000-0000-0000-0000-000000000105';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);

insert into acceptance_state
select
  'bea_first',
  accepted.invitation_id,
  accepted.wedding_id,
  accepted.person_id,
  accepted.membership_id,
  accepted.ownership_transitioned,
  accepted.already_accepted
from public.accept_wedding_invitation(
  (select state.raw_token from invitation_state as state where state.label = 'bea_valid')
) as accepted;

select extensions.ok(
  (
    select not accepted.ownership_transitioned and not accepted.already_accepted
    from acceptance_state as accepted
    where accepted.label = 'bea_first'
  ),
  'Second Partner accepts independently without another ownership transition'
);

set local role postgres;

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.status = 'ACTIVE'
      and membership.role = 'OWNER'
  ),
  2::bigint,
  'Partner-by-partner acceptance creates two equal active Owners'
);

select extensions.ok(
  not exists (
    select 1
    from pg_type as type_info
    join pg_enum as enum_info
      on enum_info.enumtypid = type_info.oid
    where type_info.typname = 'wedding_membership_role'
      and enum_info.enumlabel = 'PRIMARY_OWNER'
  ),
  'There is still no Primary Owner role'
);

select extensions.is(
  (
    select count(*)
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
  ),
  1::bigint,
  'A token for the coordinator Wedding never mutates the separate couple Wedding'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

insert into invitation_state
select
  'ben_no_email',
  issued.invitation_id,
  issued.raw_token,
  issued.invitation_expires_at
from public.issue_partner_owner_invitation(
  (select state.wedding_id from workflow_state as state where state.label = 'couple'),
  (select state.person_2_id from workflow_state as state where state.label = 'couple'),
  null
) as issued;

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);

insert into acceptance_state
select
  'ben_no_email',
  accepted.invitation_id,
  accepted.wedding_id,
  accepted.person_id,
  accepted.membership_id,
  accepted.ownership_transitioned,
  accepted.already_accepted
from public.accept_wedding_invitation(
  (select state.raw_token from invitation_state as state where state.label = 'ben_no_email')
) as accepted;

select extensions.pass('An authenticated account possessing an unbound valid token may accept it');

set local role postgres;

insert into public.wedding_memberships (
  wedding_id,
  user_id,
  role,
  status
)
values
  ((select state.wedding_id from workflow_state as state where state.label = 'coordinator'), '00000000-0000-0000-0000-000000000107', 'FULL_COORDINATOR', 'ACTIVE'),
  ((select state.wedding_id from workflow_state as state where state.label = 'coordinator'), '00000000-0000-0000-0000-000000000108', 'DAY_OF_COORDINATOR', 'ACTIVE');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.promote_wedding_member_to_owner(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000103'
    )
  ),
  '42501',
  null,
  'Full Coordinator cannot promote themselves'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.remove_wedding_member(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000104'
    )
  ),
  '42501',
  null,
  'Coordinator cannot remove an Owner'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.promote_wedding_member_to_owner(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000108'
    )
  ),
  'Active Owner can call the dedicated owner-promotion workflow'
);

select extensions.is(
  (
    select membership.role::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000108'
  ),
  'OWNER',
  'Active Owner can promote an active same-Wedding member to Owner'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.promote_wedding_member_to_owner(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (select state.membership_id from workflow_state as state where state.label = 'couple')
  ),
  '22023',
  null,
  'Owner promotion cannot cross Wedding boundaries'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000107', true);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.leave_wedding(%L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'Non-owner coordinator can call leave_wedding after transition'
);

set local role postgres;

select extensions.is(
  (
    select membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000107'
  ),
  'LEFT',
  'Non-owner coordinator can leave after ownership transition'
);

select extensions.ok(
  (
    select membership.ended_at is not null
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000107'
  ),
  'Leaving preserves Membership row and records ended_at'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.remove_wedding_member(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000103'
    )
  ),
  'Owner can remove a Full Coordinator'
);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.remove_wedding_member(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000108'
    )
  ),
  'Owner can remove another Owner while other Owners remain'
);

set local role postgres;

select extensions.is(
  (
    select membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000103'
  ),
  'REMOVED',
  'Owner may remove a Full Coordinator and history remains'
);

select extensions.is(
  (
    select membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000108'
  ),
  'REMOVED',
  'Owner may remove another Owner while other active Owners remain'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.leave_wedding(%L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  'One of two remaining Owners can leave'
);

set local role postgres;

select extensions.is(
  (
    select membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
      and membership.user_id = '00000000-0000-0000-0000-000000000105'
  ),
  'LEFT',
  'One of two remaining Owners can leave'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.leave_wedding(%L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
  ),
  '23514',
  null,
  'Final active Owner cannot leave'
);

select extensions.throws_ok(
  pg_catalog.format(
    'select * from public.remove_wedding_member(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'coordinator'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'coordinator')
        and membership.user_id = '00000000-0000-0000-0000-000000000104'
    )
  ),
  '22023',
  null,
  'Self-removal is rejected in favor of leave_wedding()'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select extensions.lives_ok(
  pg_catalog.format(
    'select * from public.remove_wedding_member(%L::uuid, %L::uuid)',
    (select state.wedding_id from workflow_state as state where state.label = 'couple'),
    (
      select membership.id
      from public.wedding_memberships as membership
      where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
        and membership.user_id = '00000000-0000-0000-0000-000000000102'
    )
  ),
  'Owner can remove the other Owner while remaining active'
);

set local role postgres;

select extensions.is(
  (
    select membership.status::text
    from public.wedding_memberships as membership
    where membership.wedding_id = (select state.wedding_id from workflow_state as state where state.label = 'couple')
      and membership.user_id = '00000000-0000-0000-0000-000000000102'
  ),
  'REMOVED',
  'Owner removal preserves the removed Owner Membership row'
);

select extensions.is(
  (
    select count(*)
    from auth.users as auth_user
    where auth_user.id in (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000104',
      '00000000-0000-0000-0000-000000000105',
      '00000000-0000-0000-0000-000000000106',
      '00000000-0000-0000-0000-000000000107',
      '00000000-0000-0000-0000-000000000108'
    )
  ),
  8::bigint,
  'No workflow deletes Auth Users'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.wedding_invitations', 'SELECT'),
  'authenticated may SELECT only authorized invitation metadata through RLS'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.wedding_invitations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.wedding_invitations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.wedding_invitations', 'DELETE'),
  'authenticated has no direct invitation mutation privileges'
);

select extensions.ok(
  not has_schema_privilege('authenticated', 'private', 'CREATE')
  and not has_table_privilege('authenticated', 'private.wedding_invitation_secrets', 'SELECT'),
  'authenticated cannot access private invitation secret storage'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.accept_wedding_invitation(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.accept_wedding_invitation(text)', 'EXECUTE'),
  'Acceptance workflow is executable only by authenticated clients'
);

select extensions.ok(
  (
    select pg_catalog.bool_and('search_path=""' = any(coalesce(routine.proconfig, '{}'::text[])))
    from pg_proc as routine
    join pg_namespace as routine_schema
      on routine_schema.oid = routine.pronamespace
    where routine_schema.nspname = 'public'
      and routine.proname in (
        'create_couple_wedding',
        'create_coordinator_managed_wedding',
        'issue_partner_owner_invitation',
        'accept_wedding_invitation',
        'revoke_wedding_invitation',
        'promote_wedding_member_to_owner',
        'leave_wedding',
        'remove_wedding_member'
      )
  ),
  'Every public SECURITY DEFINER workflow has an empty search_path'
);

select extensions.ok(
  (
    select pg_catalog.bool_and(routine.prosecdef)
    from pg_proc as routine
    join pg_namespace as routine_schema
      on routine_schema.oid = routine.pronamespace
    where routine_schema.nspname = 'public'
      and routine.proname in (
        'create_couple_wedding',
        'create_coordinator_managed_wedding',
        'issue_partner_owner_invitation',
        'accept_wedding_invitation',
        'revoke_wedding_invitation',
        'promote_wedding_member_to_owner',
        'leave_wedding',
        'remove_wedding_member'
      )
  ),
  'Controlled workflow functions use SECURITY DEFINER intentionally'
);

select extensions.ok(
  (
    select pg_catalog.strpos(
      pg_catalog.upper(pg_catalog.pg_get_functiondef(routine.oid)),
      'FOR UPDATE'
    ) > 0
    from pg_proc as routine
    join pg_namespace as routine_schema
      on routine_schema.oid = routine.pronamespace
    where routine_schema.nspname = 'public'
      and routine.proname = 'accept_wedding_invitation'
  )
  and (
    select pg_catalog.strpos(
      pg_catalog.upper(pg_catalog.pg_get_functiondef(routine.oid)),
      'FOR UPDATE'
    ) > 0
    from pg_proc as routine
    join pg_namespace as routine_schema
      on routine_schema.oid = routine.pronamespace
    where routine_schema.nspname = 'public'
      and routine.proname = 'leave_wedding'
  ),
  'Acceptance and owner lifecycle workflows explicitly lock rows for race safety'
);

select * from extensions.finish();

rollback;
