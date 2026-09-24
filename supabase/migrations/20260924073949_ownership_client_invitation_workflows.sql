begin;

create type public.wedding_invitation_status as enum (
  'PENDING',
  'ACCEPTED',
  'REVOKED'
);

create table public.wedding_invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  target_person_id uuid,
  intended_role public.wedding_membership_role not null,
  invited_email text,
  status public.wedding_invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  created_by_user_id uuid not null,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_invitations_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_invitations_target_person_same_wedding_fkey
    foreign key (wedding_id, target_person_id)
    references public.wedding_people (wedding_id, id),
  constraint wedding_invitations_created_by_user_id_fkey
    foreign key (created_by_user_id)
    references auth.users (id),
  constraint wedding_invitations_accepted_by_user_id_fkey
    foreign key (accepted_by_user_id)
    references auth.users (id),
  constraint wedding_invitations_expires_after_created_check
    check (expires_at > created_at),
  constraint wedding_invitations_email_normalized_check
    check (
      invited_email is null
      or (
        invited_email = lower(btrim(invited_email))
        and invited_email <> ''
      )
    ),
  constraint wedding_invitations_status_consistency_check
    check (
      (
        status = 'PENDING'
        and accepted_by_user_id is null
        and accepted_at is null
        and revoked_at is null
      )
      or
      (
        status = 'ACCEPTED'
        and accepted_by_user_id is not null
        and accepted_at is not null
        and revoked_at is null
      )
      or
      (
        status = 'REVOKED'
        and accepted_by_user_id is null
        and accepted_at is null
        and revoked_at is not null
      )
    )
);

create table private.wedding_invitation_secrets (
  invitation_id uuid primary key,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  constraint wedding_invitation_secrets_invitation_id_fkey
    foreign key (invitation_id)
    references public.wedding_invitations (id)
    on delete cascade
);

create unique index wedding_invitations_one_pending_per_target_idx
  on public.wedding_invitations (wedding_id, target_person_id)
  where status = 'PENDING' and target_person_id is not null;

create index wedding_invitations_pending_expiration_idx
  on public.wedding_invitations (expires_at)
  where status = 'PENDING';

create index wedding_invitations_created_by_user_id_idx
  on public.wedding_invitations (created_by_user_id);

create index wedding_invitations_accepted_by_user_id_idx
  on public.wedding_invitations (accepted_by_user_id)
  where accepted_by_user_id is not null;

create function private.normalize_wedding_invitation_email()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.invited_email is not null then
    new.invited_email := nullif(
      pg_catalog.lower(pg_catalog.btrim(new.invited_email)),
      ''
    );
  end if;

  return new;
end;
$function$;

create trigger wedding_invitations_normalize_email
before insert or update of invited_email
on public.wedding_invitations
for each row
execute function private.normalize_wedding_invitation_email();

create trigger wedding_invitations_set_updated_at
before update on public.wedding_invitations
for each row
execute function private.set_updated_at();

create function private.assert_coordinator_managed_controller(
  p_wedding_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requires_controller boolean;
begin
  select (
    wedding.origin = 'COORDINATOR_CREATED'
    and wedding.ownership_mode = 'COORDINATOR_MANAGED'
  )
  into v_requires_controller
  from public.weddings as wedding
  where wedding.id = p_wedding_id
  for update;

  if not found or not v_requires_controller then
    return;
  end if;

  if not exists (
    select 1
    from public.weddings as wedding
    join public.wedding_memberships as membership
      on membership.wedding_id = wedding.id
    where wedding.id = p_wedding_id
      and wedding.created_by_user_id is not null
      and membership.user_id = wedding.created_by_user_id
      and membership.status = 'ACTIVE'
      and membership.role = 'FULL_COORDINATOR'
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'weddings_coordinator_managed_controller_required',
      message = 'A coordinator-managed Wedding requires its creator to remain an active Full Coordinator.';
  end if;
end;
$function$;

create function private.enforce_coordinator_managed_controller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'weddings' then
    if tg_op = 'DELETE' then
      perform private.assert_coordinator_managed_controller(old.id);
    else
      perform private.assert_coordinator_managed_controller(new.id);
    end if;
  elsif tg_table_name = 'wedding_memberships' then
    if tg_op = 'DELETE' then
      perform private.assert_coordinator_managed_controller(old.wedding_id);
    elsif tg_op = 'INSERT' then
      perform private.assert_coordinator_managed_controller(new.wedding_id);
    else
      perform private.assert_coordinator_managed_controller(new.wedding_id);

      if old.wedding_id is distinct from new.wedding_id then
        perform private.assert_coordinator_managed_controller(old.wedding_id);
      end if;
    end if;
  end if;

  return null;
end;
$function$;

create constraint trigger weddings_coordinator_managed_controller_invariant
after insert or update or delete on public.weddings
deferrable initially deferred
for each row
execute function private.enforce_coordinator_managed_controller();

create constraint trigger wedding_memberships_coordinator_managed_controller_invariant
after insert or update or delete on public.wedding_memberships
deferrable initially deferred
for each row
execute function private.enforce_coordinator_managed_controller();

create function private.can_manage_owner_invitations(
  p_wedding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.weddings as wedding
      where wedding.id = p_wedding_id
        and (
          (
            wedding.ownership_mode = 'COUPLE_OWNED'
            and exists (
              select 1
              from public.wedding_memberships as membership
              where membership.wedding_id = wedding.id
                and membership.user_id = (select auth.uid())
                and membership.status = 'ACTIVE'
                and membership.role = 'OWNER'
            )
          )
          or
          (
            wedding.origin = 'COORDINATOR_CREATED'
            and wedding.ownership_mode = 'COORDINATOR_MANAGED'
            and wedding.created_by_user_id = (select auth.uid())
            and exists (
              select 1
              from public.wedding_memberships as membership
              where membership.wedding_id = wedding.id
                and membership.user_id = (select auth.uid())
                and membership.status = 'ACTIVE'
                and membership.role = 'FULL_COORDINATOR'
            )
          )
        )
    );
$function$;

create function public.create_couple_wedding(
  p_wedding_display_name text,
  p_current_partner_display_name text,
  p_second_partner_display_name text default null,
  p_wedding_date date default null,
  p_timezone text default null,
  p_general_location text default null,
  p_estimated_guest_count integer default null,
  p_ceremony_style public.ceremony_style default 'UNDECIDED'
)
returns table (
  wedding_id uuid,
  current_person_id uuid,
  second_partner_person_id uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_wedding_id uuid;
  v_current_person_id uuid;
  v_second_person_id uuid;
  v_membership_id uuid;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not exists (
    select 1 from auth.users as auth_user where auth_user.id = v_caller_user_id
  ) then
    raise exception using errcode = '42501', message = 'Authenticated User is unavailable.';
  end if;

  if p_wedding_display_name is null
     or pg_catalog.btrim(p_wedding_display_name) = ''
     or p_current_partner_display_name is null
     or pg_catalog.btrim(p_current_partner_display_name) = '' then
    raise exception using errcode = '22023', message = 'Wedding and current partner display names are required.';
  end if;

  if p_second_partner_display_name is not null
     and pg_catalog.btrim(p_second_partner_display_name) = '' then
    raise exception using errcode = '22023', message = 'Second partner display name cannot be blank.';
  end if;

  if p_estimated_guest_count is not null and p_estimated_guest_count < 0 then
    raise exception using errcode = '22023', message = 'Estimated guest count cannot be negative.';
  end if;

  insert into public.weddings (
    origin,
    status,
    ownership_mode,
    created_by_user_id,
    display_name,
    wedding_date,
    timezone,
    general_location,
    estimated_guest_count,
    ceremony_style
  )
  values (
    'COUPLE_CREATED',
    'DRAFT',
    'COUPLE_OWNED',
    v_caller_user_id,
    pg_catalog.btrim(p_wedding_display_name),
    p_wedding_date,
    nullif(pg_catalog.btrim(p_timezone), ''),
    nullif(pg_catalog.btrim(p_general_location), ''),
    p_estimated_guest_count,
    p_ceremony_style
  )
  returning id into v_wedding_id;

  insert into public.wedding_people (
    wedding_id,
    linked_user_id,
    display_name
  )
  values (
    v_wedding_id,
    v_caller_user_id,
    pg_catalog.btrim(p_current_partner_display_name)
  )
  returning id into v_current_person_id;

  insert into public.wedding_partners (
    wedding_id,
    person_id,
    partner_order,
    joined_workspace_at
  )
  values (
    v_wedding_id,
    v_current_person_id,
    1,
    pg_catalog.now()
  );

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    role,
    status
  )
  values (
    v_wedding_id,
    v_caller_user_id,
    'OWNER',
    'ACTIVE'
  )
  returning id into v_membership_id;

  if p_second_partner_display_name is not null then
    insert into public.wedding_people (
      wedding_id,
      linked_user_id,
      display_name
    )
    values (
      v_wedding_id,
      null,
      pg_catalog.btrim(p_second_partner_display_name)
    )
    returning id into v_second_person_id;

    insert into public.wedding_partners (
      wedding_id,
      person_id,
      partner_order,
      joined_workspace_at
    )
    values (
      v_wedding_id,
      v_second_person_id,
      2,
      null
    );
  end if;

  return query
  select
    v_wedding_id,
    v_current_person_id,
    v_second_person_id,
    v_membership_id;
end;
$function$;

create function public.create_coordinator_managed_wedding(
  p_wedding_display_name text,
  p_partner_1_display_name text,
  p_partner_2_display_name text,
  p_wedding_date date default null,
  p_timezone text default null,
  p_general_location text default null,
  p_estimated_guest_count integer default null,
  p_ceremony_style public.ceremony_style default 'UNDECIDED'
)
returns table (
  wedding_id uuid,
  partner_1_person_id uuid,
  partner_2_person_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_wedding_id uuid;
  v_partner_1_person_id uuid;
  v_partner_2_person_id uuid;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not exists (
    select 1 from auth.users as auth_user where auth_user.id = v_caller_user_id
  ) then
    raise exception using errcode = '42501', message = 'Authenticated User is unavailable.';
  end if;

  if p_wedding_display_name is null
     or pg_catalog.btrim(p_wedding_display_name) = ''
     or p_partner_1_display_name is null
     or pg_catalog.btrim(p_partner_1_display_name) = ''
     or p_partner_2_display_name is null
     or pg_catalog.btrim(p_partner_2_display_name) = '' then
    raise exception using errcode = '22023', message = 'Wedding and both partner display names are required.';
  end if;

  if p_estimated_guest_count is not null and p_estimated_guest_count < 0 then
    raise exception using errcode = '22023', message = 'Estimated guest count cannot be negative.';
  end if;

  insert into public.weddings (
    origin,
    status,
    ownership_mode,
    created_by_user_id,
    display_name,
    wedding_date,
    timezone,
    general_location,
    estimated_guest_count,
    ceremony_style
  )
  values (
    'COORDINATOR_CREATED',
    'DRAFT',
    'COORDINATOR_MANAGED',
    v_caller_user_id,
    pg_catalog.btrim(p_wedding_display_name),
    p_wedding_date,
    nullif(pg_catalog.btrim(p_timezone), ''),
    nullif(pg_catalog.btrim(p_general_location), ''),
    p_estimated_guest_count,
    p_ceremony_style
  )
  returning id into v_wedding_id;

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    role,
    status
  )
  values (
    v_wedding_id,
    v_caller_user_id,
    'FULL_COORDINATOR',
    'ACTIVE'
  );

  insert into public.wedding_people (
    wedding_id,
    linked_user_id,
    display_name
  )
  values (
    v_wedding_id,
    null,
    pg_catalog.btrim(p_partner_1_display_name)
  )
  returning id into v_partner_1_person_id;

  insert into public.wedding_partners (
    wedding_id,
    person_id,
    partner_order,
    joined_workspace_at
  )
  values (
    v_wedding_id,
    v_partner_1_person_id,
    1,
    null
  );

  insert into public.wedding_people (
    wedding_id,
    linked_user_id,
    display_name
  )
  values (
    v_wedding_id,
    null,
    pg_catalog.btrim(p_partner_2_display_name)
  )
  returning id into v_partner_2_person_id;

  insert into public.wedding_partners (
    wedding_id,
    person_id,
    partner_order,
    joined_workspace_at
  )
  values (
    v_wedding_id,
    v_partner_2_person_id,
    2,
    null
  );

  return query
  select
    v_wedding_id,
    v_partner_1_person_id,
    v_partner_2_person_id;
end;
$function$;

create function public.issue_partner_owner_invitation(
  p_wedding_id uuid,
  p_target_person_id uuid,
  p_invited_email text default null
)
returns table (
  invitation_id uuid,
  raw_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_wedding public.weddings%rowtype;
  v_target_linked_user_id uuid;
  v_invitation_id uuid;
  v_raw_token text;
  v_expires_at timestamptz := pg_catalog.now() + interval '7 days';
  v_normalized_email text := nullif(
    pg_catalog.lower(pg_catalog.btrim(p_invited_email)),
    ''
  );
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select wedding.*
  into v_wedding
  from public.weddings as wedding
  where wedding.id = p_wedding_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Wedding invitation operation is not permitted.';
  end if;

  if not (
    (
      v_wedding.ownership_mode = 'COUPLE_OWNED'
      and exists (
        select 1
        from public.wedding_memberships as membership
        where membership.wedding_id = v_wedding.id
          and membership.user_id = v_caller_user_id
          and membership.status = 'ACTIVE'
          and membership.role = 'OWNER'
      )
    )
    or
    (
      v_wedding.origin = 'COORDINATOR_CREATED'
      and v_wedding.ownership_mode = 'COORDINATOR_MANAGED'
      and v_wedding.created_by_user_id = v_caller_user_id
      and exists (
        select 1
        from public.wedding_memberships as membership
        where membership.wedding_id = v_wedding.id
          and membership.user_id = v_caller_user_id
          and membership.status = 'ACTIVE'
          and membership.role = 'FULL_COORDINATOR'
      )
    )
  ) then
    raise exception using errcode = '42501', message = 'Wedding invitation operation is not permitted.';
  end if;

  select person.linked_user_id
  into v_target_linked_user_id
  from public.wedding_people as person
  join public.wedding_partners as partner
    on partner.wedding_id = person.wedding_id
   and partner.person_id = person.id
  where person.wedding_id = v_wedding.id
    and person.id = p_target_person_id
  for update of person, partner;

  if not found then
    raise exception using errcode = '22023', message = 'Invitation target must be an existing Partner in this Wedding.';
  end if;

  if v_target_linked_user_id is not null then
    raise exception using errcode = '22023', message = 'Invitation target is already linked to an account.';
  end if;

  if exists (
    select 1
    from public.wedding_memberships as membership
    where membership.wedding_id = v_wedding.id
      and membership.user_id = v_target_linked_user_id
      and membership.status = 'ACTIVE'
      and membership.role = 'OWNER'
  ) then
    raise exception using errcode = '22023', message = 'Invitation target already has an active Owner membership.';
  end if;

  update public.wedding_invitations as invitation
  set
    status = 'REVOKED',
    revoked_at = pg_catalog.now()
  where invitation.wedding_id = v_wedding.id
    and invitation.target_person_id = p_target_person_id
    and invitation.status = 'PENDING';

  v_raw_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.wedding_invitations (
    wedding_id,
    target_person_id,
    intended_role,
    invited_email,
    status,
    expires_at,
    created_by_user_id
  )
  values (
    v_wedding.id,
    p_target_person_id,
    'OWNER',
    v_normalized_email,
    'PENDING',
    v_expires_at,
    v_caller_user_id
  )
  returning id into v_invitation_id;

  insert into private.wedding_invitation_secrets (
    invitation_id,
    token_hash
  )
  values (
    v_invitation_id,
    extensions.digest(v_raw_token, 'sha256')
  );

  return query
  select v_invitation_id, v_raw_token, v_expires_at;
end;
$function$;

create function public.accept_wedding_invitation(
  p_raw_token text
)
returns table (
  invitation_id uuid,
  wedding_id uuid,
  person_id uuid,
  membership_id uuid,
  ownership_transitioned boolean,
  already_accepted boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_invitation_id uuid;
  v_wedding_id uuid;
  v_target_person_id uuid;
  v_invitation_status public.wedding_invitation_status;
  v_invited_email text;
  v_expires_at timestamptz;
  v_accepted_by_user_id uuid;
  v_linked_user_id uuid;
  v_membership_id uuid;
  v_ownership_mode public.wedding_ownership_mode;
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_transitioned boolean := false;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_raw_token is null
     or pg_catalog.length(p_raw_token) <> 64
     or p_raw_token !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  select invitation.id, invitation.wedding_id
  into v_invitation_id, v_wedding_id
  from private.wedding_invitation_secrets as secret
  join public.wedding_invitations as invitation
    on invitation.id = secret.invitation_id
  where secret.token_hash = extensions.digest(p_raw_token, 'sha256');

  if not found then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  select wedding.ownership_mode
  into v_ownership_mode
  from public.weddings as wedding
  where wedding.id = v_wedding_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  select
    invitation.target_person_id,
    invitation.status,
    invitation.invited_email,
    invitation.expires_at,
    invitation.accepted_by_user_id
  into
    v_target_person_id,
    v_invitation_status,
    v_invited_email,
    v_expires_at,
    v_accepted_by_user_id
  from public.wedding_invitations as invitation
  join private.wedding_invitation_secrets as secret
    on secret.invitation_id = invitation.id
  where invitation.id = v_invitation_id
    and invitation.wedding_id = v_wedding_id
    and secret.token_hash = extensions.digest(p_raw_token, 'sha256')
  for update of invitation, secret;

  if not found then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  if v_invitation_status = 'ACCEPTED' then
    if v_accepted_by_user_id is distinct from v_caller_user_id then
      raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
    end if;

    select membership.id
    into v_membership_id
    from public.wedding_memberships as membership
    where membership.wedding_id = v_wedding_id
      and membership.user_id = v_caller_user_id;

    return query
    select
      v_invitation_id,
      v_wedding_id,
      v_target_person_id,
      v_membership_id,
      false,
      true;
    return;
  end if;

  if v_invitation_status <> 'PENDING'
     or v_expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  if v_invited_email is not null then
    select
      pg_catalog.lower(auth_user.email),
      auth_user.email_confirmed_at
    into
      v_auth_email,
      v_email_confirmed_at
    from auth.users as auth_user
    where auth_user.id = v_caller_user_id;

    if v_auth_email is distinct from v_invited_email
       or v_email_confirmed_at is null then
      raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
    end if;
  end if;

  select person.linked_user_id
  into v_linked_user_id
  from public.wedding_people as person
  join public.wedding_partners as partner
    on partner.wedding_id = person.wedding_id
   and partner.person_id = person.id
  where person.wedding_id = v_wedding_id
    and person.id = v_target_person_id
  for update of person, partner;

  if not found
     or (
       v_linked_user_id is not null
       and v_linked_user_id is distinct from v_caller_user_id
     ) then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  if exists (
    select 1
    from public.wedding_people as person
    where person.wedding_id = v_wedding_id
      and person.linked_user_id = v_caller_user_id
      and person.id <> v_target_person_id
  ) then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  update public.wedding_people as person
  set linked_user_id = v_caller_user_id
  where person.wedding_id = v_wedding_id
    and person.id = v_target_person_id
    and (
      person.linked_user_id is null
      or person.linked_user_id = v_caller_user_id
    );

  if not found then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  update public.wedding_partners as partner
  set joined_workspace_at = coalesce(
    partner.joined_workspace_at,
    pg_catalog.now()
  )
  where partner.wedding_id = v_wedding_id
    and partner.person_id = v_target_person_id;

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    role,
    status,
    joined_at,
    ended_at
  )
  values (
    v_wedding_id,
    v_caller_user_id,
    'OWNER',
    'ACTIVE',
    pg_catalog.now(),
    null
  )
  on conflict on constraint wedding_memberships_wedding_id_user_id_key
  do update
  set
    role = 'OWNER',
    status = 'ACTIVE',
    joined_at = case
      when public.wedding_memberships.status = 'ACTIVE'
        then public.wedding_memberships.joined_at
      else pg_catalog.now()
    end,
    ended_at = null,
    updated_at = pg_catalog.now()
  returning id into v_membership_id;

  if v_ownership_mode = 'COORDINATOR_MANAGED' then
    update public.weddings as wedding
    set ownership_mode = 'COUPLE_OWNED'
    where wedding.id = v_wedding_id
      and wedding.ownership_mode = 'COORDINATOR_MANAGED';

    v_transitioned := found;
  end if;

  update public.wedding_invitations as invitation
  set
    status = 'ACCEPTED',
    accepted_by_user_id = v_caller_user_id,
    accepted_at = pg_catalog.now()
  where invitation.id = v_invitation_id
    and invitation.status = 'PENDING';

  if not found then
    raise exception using errcode = '22023', message = 'Invitation cannot be accepted.';
  end if;

  return query
  select
    v_invitation_id,
    v_wedding_id,
    v_target_person_id,
    v_membership_id,
    v_transitioned,
    false;
end;
$function$;

create function public.revoke_wedding_invitation(
  p_invitation_id uuid
)
returns table (
  invitation_id uuid,
  wedding_id uuid,
  invitation_status public.wedding_invitation_status
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_wedding_id uuid;
  v_status public.wedding_invitation_status;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select invitation.wedding_id
  into v_wedding_id
  from public.wedding_invitations as invitation
  where invitation.id = p_invitation_id;

  if not found then
    raise exception using errcode = '42501', message = 'Wedding invitation operation is not permitted.';
  end if;

  perform 1
  from public.weddings as wedding
  where wedding.id = v_wedding_id
  for update;

  if not found or not private.can_manage_owner_invitations(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding invitation operation is not permitted.';
  end if;

  select invitation.status
  into v_status
  from public.wedding_invitations as invitation
  where invitation.id = p_invitation_id
    and invitation.wedding_id = v_wedding_id
  for update;

  if v_status is distinct from 'PENDING'::public.wedding_invitation_status then
    raise exception using errcode = '22023', message = 'Only a pending invitation can be revoked.';
  end if;

  update public.wedding_invitations as invitation
  set
    status = 'REVOKED',
    revoked_at = pg_catalog.now()
  where invitation.id = p_invitation_id;

  return query
  select
    p_invitation_id,
    v_wedding_id,
    'REVOKED'::public.wedding_invitation_status;
end;
$function$;

create function public.promote_wedding_member_to_owner(
  p_wedding_id uuid,
  p_target_membership_id uuid
)
returns table (
  membership_id uuid,
  wedding_id uuid,
  membership_role public.wedding_membership_role
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_target_user_id uuid;
  v_target_status public.wedding_membership_status;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  perform 1
  from public.weddings as wedding
  where wedding.id = p_wedding_id
    and wedding.ownership_mode = 'COUPLE_OWNED'
  for update;

  if not found or not exists (
    select 1
    from public.wedding_memberships as membership
    where membership.wedding_id = p_wedding_id
      and membership.user_id = v_caller_user_id
      and membership.status = 'ACTIVE'
      and membership.role = 'OWNER'
  ) then
    raise exception using errcode = '42501', message = 'Owner promotion is not permitted.';
  end if;

  select membership.user_id, membership.status
  into v_target_user_id, v_target_status
  from public.wedding_memberships as membership
  where membership.id = p_target_membership_id
    and membership.wedding_id = p_wedding_id
  for update;

  if not found
     or v_target_status <> 'ACTIVE'
     or v_target_user_id is null then
    raise exception using errcode = '22023', message = 'Target must be an active authenticated Wedding member.';
  end if;

  update public.wedding_memberships as membership
  set role = 'OWNER'
  where membership.id = p_target_membership_id;

  return query
  select
    p_target_membership_id,
    p_wedding_id,
    'OWNER'::public.wedding_membership_role;
end;
$function$;

create function public.leave_wedding(
  p_wedding_id uuid
)
returns table (
  membership_id uuid,
  wedding_id uuid,
  membership_status public.wedding_membership_status,
  ended_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_membership_id uuid;
  v_role public.wedding_membership_role;
  v_ended_at timestamptz := pg_catalog.now();
  v_wedding public.weddings%rowtype;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select wedding.*
  into v_wedding
  from public.weddings as wedding
  where wedding.id = p_wedding_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Leaving this Wedding is not permitted.';
  end if;

  select membership.id, membership.role
  into v_membership_id, v_role
  from public.wedding_memberships as membership
  where membership.wedding_id = p_wedding_id
    and membership.user_id = v_caller_user_id
    and membership.status = 'ACTIVE'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Leaving this Wedding is not permitted.';
  end if;

  if v_wedding.origin = 'COORDINATOR_CREATED'
     and v_wedding.ownership_mode = 'COORDINATOR_MANAGED'
     and v_wedding.created_by_user_id = v_caller_user_id then
    raise exception using errcode = '23514', message = 'The coordinator-managed controller cannot leave before ownership transition.';
  end if;

  if v_role = 'OWNER'
     and not exists (
       select 1
       from public.wedding_memberships as membership
       where membership.wedding_id = p_wedding_id
         and membership.status = 'ACTIVE'
         and membership.role = 'OWNER'
         and membership.id <> v_membership_id
     ) then
    raise exception using errcode = '23514', message = 'The final active Owner cannot leave the Wedding.';
  end if;

  update public.wedding_memberships as membership
  set
    status = 'LEFT',
    ended_at = v_ended_at
  where membership.id = v_membership_id;

  return query
  select
    v_membership_id,
    p_wedding_id,
    'LEFT'::public.wedding_membership_status,
    v_ended_at;
end;
$function$;

create function public.remove_wedding_member(
  p_wedding_id uuid,
  p_target_membership_id uuid
)
returns table (
  membership_id uuid,
  wedding_id uuid,
  membership_status public.wedding_membership_status,
  ended_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_target_user_id uuid;
  v_target_role public.wedding_membership_role;
  v_target_status public.wedding_membership_status;
  v_ended_at timestamptz := pg_catalog.now();
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  perform 1
  from public.weddings as wedding
  where wedding.id = p_wedding_id
    and wedding.ownership_mode = 'COUPLE_OWNED'
  for update;

  if not found or not exists (
    select 1
    from public.wedding_memberships as membership
    where membership.wedding_id = p_wedding_id
      and membership.user_id = v_caller_user_id
      and membership.status = 'ACTIVE'
      and membership.role = 'OWNER'
  ) then
    raise exception using errcode = '42501', message = 'Member removal is not permitted.';
  end if;

  select membership.user_id, membership.role, membership.status
  into v_target_user_id, v_target_role, v_target_status
  from public.wedding_memberships as membership
  where membership.id = p_target_membership_id
    and membership.wedding_id = p_wedding_id
  for update;

  if not found or v_target_status <> 'ACTIVE' then
    raise exception using errcode = '22023', message = 'Target must be an active member of this Wedding.';
  end if;

  if v_target_user_id = v_caller_user_id then
    raise exception using errcode = '22023', message = 'Use leave_wedding() to leave your own Wedding.';
  end if;

  if v_target_role = 'OWNER'
     and not exists (
       select 1
       from public.wedding_memberships as membership
       where membership.wedding_id = p_wedding_id
         and membership.status = 'ACTIVE'
         and membership.role = 'OWNER'
         and membership.id <> p_target_membership_id
     ) then
    raise exception using errcode = '23514', message = 'The final active Owner cannot be removed from the Wedding.';
  end if;

  update public.wedding_memberships as membership
  set
    status = 'REMOVED',
    ended_at = v_ended_at
  where membership.id = p_target_membership_id;

  return query
  select
    p_target_membership_id,
    p_wedding_id,
    'REMOVED'::public.wedding_membership_status,
    v_ended_at;
end;
$function$;

alter table public.wedding_invitations enable row level security;

create policy wedding_invitations_select_manager
on public.wedding_invitations
for select
to authenticated
using ((select private.can_manage_owner_invitations(wedding_id)));

revoke all on table public.wedding_invitations
from public, anon, authenticated, service_role;

revoke all on table private.wedding_invitation_secrets
from public, anon, authenticated, service_role;

grant select on table public.wedding_invitations to authenticated;

grant select, insert, update, delete
on table public.wedding_invitations
to service_role;

revoke all on type public.wedding_invitation_status
from public, anon, authenticated, service_role;

grant usage on type public.wedding_invitation_status
to authenticated, service_role;

revoke execute on function private.normalize_wedding_invitation_email()
from public, anon, authenticated, service_role;

revoke execute on function private.assert_coordinator_managed_controller(uuid)
from public, anon, authenticated, service_role;

revoke execute on function private.enforce_coordinator_managed_controller()
from public, anon, authenticated, service_role;

revoke execute on function private.can_manage_owner_invitations(uuid)
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_owner_invitations(uuid)
to authenticated;

revoke execute on function public.create_couple_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
)
from public, anon, authenticated, service_role;

revoke execute on function public.create_coordinator_managed_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
)
from public, anon, authenticated, service_role;

revoke execute on function public.issue_partner_owner_invitation(uuid, uuid, text)
from public, anon, authenticated, service_role;

revoke execute on function public.accept_wedding_invitation(text)
from public, anon, authenticated, service_role;

revoke execute on function public.revoke_wedding_invitation(uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.promote_wedding_member_to_owner(uuid, uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.leave_wedding(uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.remove_wedding_member(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_couple_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
)
to authenticated;

grant execute on function public.create_coordinator_managed_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
)
to authenticated;

grant execute on function public.issue_partner_owner_invitation(uuid, uuid, text)
to authenticated;

grant execute on function public.accept_wedding_invitation(text)
to authenticated;

grant execute on function public.revoke_wedding_invitation(uuid)
to authenticated;

grant execute on function public.promote_wedding_member_to_owner(uuid, uuid)
to authenticated;

grant execute on function public.leave_wedding(uuid)
to authenticated;

grant execute on function public.remove_wedding_member(uuid, uuid)
to authenticated;

comment on table public.wedding_invitations is
  'Owner invitation metadata. Expiration is derived from PENDING plus expires_at; raw invitation tokens are never stored.';

comment on table private.wedding_invitation_secrets is
  'Non-exposed SHA-256 invitation token digests. Raw invitation tokens are returned only by the issuance workflow.';

comment on function public.create_couple_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
) is
  'SECURITY DEFINER is required because authenticated clients have no direct creation grants. The function derives auth.uid(), fixes governance fields, validates all inputs, and creates the Wedding, Person, Partner, and Owner Membership atomically.';

comment on function public.create_coordinator_managed_wedding(
  text,
  text,
  text,
  date,
  text,
  text,
  integer,
  public.ceremony_style
) is
  'SECURITY DEFINER is required because authenticated clients have no direct creation grants. The function derives auth.uid(), fixes governance fields, and creates both unlinked client Partners plus the creator Full Coordinator atomically.';

comment on function public.issue_partner_owner_invitation(uuid, uuid, text) is
  'SECURITY DEFINER is required to write closed invitation and secret tables. Caller authority, Wedding boundary, Partner identity, account-link state, and fixed OWNER role are validated before a one-time raw token is returned.';

comment on function public.accept_wedding_invitation(text) is
  'SECURITY DEFINER is required to read the private token digest and atomically link Person, activate Owner Membership, transition ownership mode, and consume the invitation. Caller identity comes only from auth.uid(); all target rows are locked and revalidated.';

comment on function public.revoke_wedding_invitation(uuid) is
  'SECURITY DEFINER is required to mutate invitation metadata while direct writes remain closed. The function derives auth.uid(), locks the Wedding then invitation, and validates Owner or temporary controller authority.';

comment on function public.promote_wedding_member_to_owner(uuid, uuid) is
  'SECURITY DEFINER is required to update closed Membership governance fields. Only an active Owner of the same couple-owned Wedding may promote an active target Membership.';

comment on function public.leave_wedding(uuid) is
  'SECURITY DEFINER is required to update the caller Membership while direct writes remain closed. It derives auth.uid(), serializes on the Wedding row, and protects the final Owner and temporary controller.';

comment on function public.remove_wedding_member(uuid, uuid) is
  'SECURITY DEFINER is required to update a target Membership while direct writes remain closed. It validates same-Wedding active Owner authority, serializes on the Wedding row, rejects self-removal, and protects the final Owner.';

commit;
