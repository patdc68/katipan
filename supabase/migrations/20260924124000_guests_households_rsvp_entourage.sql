begin;

create type public.household_invitation_delivery_status as enum (
  'NOT_SENT',
  'SENT'
);

create type public.guest_rsvp_status as enum (
  'NO_RESPONSE',
  'ATTENDING',
  'DECLINED'
);

create type public.household_rsvp_progress as enum (
  'NO_RESPONSE',
  'PARTIALLY_RESPONDED',
  'RESPONDED'
);

create type public.guest_allowance_type as enum (
  'PLUS_ONE',
  'CHILD'
);

alter table public.wedding_people
  add column email text,
  add column phone text,
  add constraint wedding_people_email_normalized_check
    check (
      email is null
      or (
        email = pg_catalog.lower(pg_catalog.btrim(email))
        and email <> ''
      )
    ),
  add constraint wedding_people_phone_normalized_check
    check (
      phone is null
      or (
        phone = pg_catalog.btrim(phone)
        and phone <> ''
      )
    );

create table public.guest_households (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  display_name text not null,
  delivery_status public.household_invitation_delivery_status not null default 'NOT_SENT',
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_households_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint guest_households_wedding_id_id_key
    unique (wedding_id, id),
  constraint guest_households_display_name_trimmed_check
    check (
      display_name = pg_catalog.btrim(display_name)
      and display_name <> ''
    ),
  constraint guest_households_delivery_status_check
    check (
      (delivery_status = 'NOT_SENT' and sent_at is null)
      or (delivery_status = 'SENT' and sent_at is not null)
    )
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  person_id uuid not null,
  household_id uuid not null,
  accessibility_assistance_note text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint guests_person_same_wedding_fkey
    foreign key (wedding_id, person_id)
    references public.wedding_people (wedding_id, id),
  constraint guests_household_same_wedding_fkey
    foreign key (wedding_id, household_id)
    references public.guest_households (wedding_id, id),
  constraint guests_wedding_id_id_key
    unique (wedding_id, id),
  constraint guests_wedding_id_person_id_key
    unique (wedding_id, person_id)
);

create table public.guest_rsvps (
  guest_id uuid primary key,
  wedding_id uuid not null,
  status public.guest_rsvp_status not null default 'NO_RESPONSE',
  meal_choice text,
  dietary_notes text,
  response_notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_rsvps_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade,
  constraint guest_rsvps_wedding_id_guest_id_key
    unique (wedding_id, guest_id),
  constraint guest_rsvps_response_status_check
    check (
      (status = 'NO_RESPONSE' and responded_at is null)
      or (status in ('ATTENDING', 'DECLINED') and responded_at is not null)
    )
);

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_groups_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint guest_groups_wedding_id_id_key
    unique (wedding_id, id),
  constraint guest_groups_name_trimmed_check
    check (
      name = pg_catalog.btrim(name)
      and name <> ''
    )
);

create table public.guest_group_memberships (
  wedding_id uuid not null,
  guest_group_id uuid not null,
  guest_id uuid not null,
  created_at timestamptz not null default now(),
  constraint guest_group_memberships_pkey
    primary key (wedding_id, guest_group_id, guest_id),
  constraint guest_group_memberships_group_same_wedding_fkey
    foreign key (wedding_id, guest_group_id)
    references public.guest_groups (wedding_id, id)
    on delete cascade,
  constraint guest_group_memberships_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade
);

create table public.guest_allowances (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  household_id uuid not null,
  sponsor_guest_id uuid,
  allowance_type public.guest_allowance_type not null,
  max_count smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_allowances_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint guest_allowances_household_same_wedding_fkey
    foreign key (wedding_id, household_id)
    references public.guest_households (wedding_id, id),
  constraint guest_allowances_sponsor_same_wedding_fkey
    foreign key (wedding_id, sponsor_guest_id)
    references public.guests (wedding_id, id),
  constraint guest_allowances_wedding_id_id_key
    unique (wedding_id, id),
  constraint guest_allowances_max_count_check
    check (max_count > 0),
  constraint guest_allowances_type_sponsor_check
    check (
      (allowance_type = 'PLUS_ONE' and sponsor_guest_id is not null)
      or (allowance_type = 'CHILD' and sponsor_guest_id is null)
    )
);

create table public.guest_allowance_claims (
  allowance_id uuid not null,
  wedding_id uuid not null,
  guest_id uuid not null,
  claimed_at timestamptz not null default now(),
  constraint guest_allowance_claims_pkey
    primary key (allowance_id, guest_id),
  constraint guest_allowance_claims_allowance_same_wedding_fkey
    foreign key (wedding_id, allowance_id)
    references public.guest_allowances (wedding_id, id)
    on delete cascade,
  constraint guest_allowance_claims_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade,
  constraint guest_allowance_claims_guest_id_key
    unique (guest_id)
);

create table public.entourage_roles (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  preset_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entourage_roles_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint entourage_roles_wedding_id_id_key
    unique (wedding_id, id),
  constraint entourage_roles_name_trimmed_check
    check (
      name = pg_catalog.btrim(name)
      and name <> ''
    ),
  constraint entourage_roles_preset_key_trimmed_check
    check (
      preset_key is null
      or (
        preset_key = pg_catalog.btrim(preset_key)
        and preset_key <> ''
      )
    )
);

create table public.entourage_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  role_id uuid not null,
  guest_id uuid not null,
  created_at timestamptz not null default now(),
  constraint entourage_assignments_role_same_wedding_fkey
    foreign key (wedding_id, role_id)
    references public.entourage_roles (wedding_id, id)
    on delete cascade,
  constraint entourage_assignments_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade,
  constraint entourage_assignments_wedding_role_guest_key
    unique (wedding_id, role_id, guest_id)
);

create index guest_households_wedding_id_idx
  on public.guest_households (wedding_id);

create index guests_household_id_wedding_id_idx
  on public.guests (household_id, wedding_id);

create index guests_wedding_id_household_id_idx
  on public.guests (wedding_id, household_id);

create index guest_rsvps_wedding_id_status_idx
  on public.guest_rsvps (wedding_id, status);

create unique index guest_groups_wedding_normalized_name_idx
  on public.guest_groups (wedding_id, pg_catalog.lower(name));

create index guest_group_memberships_wedding_guest_id_idx
  on public.guest_group_memberships (wedding_id, guest_id);

create index guest_group_memberships_guest_id_idx
  on public.guest_group_memberships (guest_id);

create index guest_allowances_wedding_household_id_idx
  on public.guest_allowances (wedding_id, household_id);

create index guest_allowances_wedding_sponsor_guest_id_idx
  on public.guest_allowances (wedding_id, sponsor_guest_id)
  where sponsor_guest_id is not null;

create index guest_allowance_claims_wedding_allowance_id_idx
  on public.guest_allowance_claims (wedding_id, allowance_id);

create index guest_allowance_claims_wedding_guest_id_idx
  on public.guest_allowance_claims (wedding_id, guest_id);

create unique index entourage_roles_wedding_normalized_name_idx
  on public.entourage_roles (wedding_id, pg_catalog.lower(name));

create index entourage_assignments_wedding_guest_id_idx
  on public.entourage_assignments (wedding_id, guest_id);

create index entourage_assignments_role_id_idx
  on public.entourage_assignments (role_id);

create index entourage_assignments_guest_id_idx
  on public.entourage_assignments (guest_id);

create function private.normalize_wedding_person_contact()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.email := nullif(
    pg_catalog.lower(pg_catalog.btrim(new.email)),
    ''
  );
  new.phone := nullif(pg_catalog.btrim(new.phone), '');
  return new;
end;
$function$;

create trigger wedding_people_normalize_contact
before insert or update of email, phone
on public.wedding_people
for each row
execute function private.normalize_wedding_person_contact();

create trigger guest_households_set_updated_at
before update on public.guest_households
for each row
execute function private.set_updated_at();

create trigger guests_set_updated_at
before update on public.guests
for each row
execute function private.set_updated_at();

create trigger guest_rsvps_set_updated_at
before update on public.guest_rsvps
for each row
execute function private.set_updated_at();

create trigger guest_groups_set_updated_at
before update on public.guest_groups
for each row
execute function private.set_updated_at();

create trigger guest_allowances_set_updated_at
before update on public.guest_allowances
for each row
execute function private.set_updated_at();

create trigger entourage_roles_set_updated_at
before update on public.entourage_roles
for each row
execute function private.set_updated_at();

create function private.create_initial_guest_rsvp()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  insert into public.guest_rsvps (guest_id, wedding_id)
  values (new.id, new.wedding_id);
  return new;
end;
$function$;

create trigger guests_create_initial_rsvp
after insert on public.guests
for each row
execute function private.create_initial_guest_rsvp();

create function private.enforce_guest_allowance_configuration()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_sponsor_household_id uuid;
begin
  if new.allowance_type = 'PLUS_ONE' then
    select guest.household_id
    into v_sponsor_household_id
    from public.guests as guest
    where guest.wedding_id = new.wedding_id
      and guest.id = new.sponsor_guest_id;

    if not found or v_sponsor_household_id <> new.household_id then
      raise exception using
        errcode = '23514',
        constraint = 'guest_allowances_sponsor_same_household_check',
        message = 'A Plus-One sponsor must be a Guest in the same Wedding and Household.';
    end if;
  end if;

  return new;
end;
$function$;

create trigger guest_allowances_validate_configuration
before insert or update of wedding_id, household_id, sponsor_guest_id, allowance_type
on public.guest_allowances
for each row
execute function private.enforce_guest_allowance_configuration();

create function private.prevent_claimed_allowance_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.guest_allowance_claims as claim
    where claim.allowance_id = old.id
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'guest_allowances_claimed_immutable',
      message = 'A claimed allowance must be released before it can be changed or removed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create trigger guest_allowances_protect_claimed
before update or delete on public.guest_allowances
for each row
execute function private.prevent_claimed_allowance_mutation();

create function private.enforce_guest_allowance_claim()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_allowance_household_id uuid;
  v_guest_household_id uuid;
  v_max_count smallint;
  v_claim_count bigint;
begin
  select allowance.household_id, allowance.max_count
  into v_allowance_household_id, v_max_count
  from public.guest_allowances as allowance
  where allowance.id = new.allowance_id
    and allowance.wedding_id = new.wedding_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'Allowance does not belong to the specified Wedding.';
  end if;

  select guest.household_id
  into v_guest_household_id
  from public.guests as guest
  where guest.id = new.guest_id
    and guest.wedding_id = new.wedding_id;

  if not found or v_guest_household_id <> v_allowance_household_id then
    raise exception using
      errcode = '23514',
      constraint = 'guest_allowance_claims_same_household_check',
      message = 'The claimed Guest must belong to the allowance Household.';
  end if;

  select pg_catalog.count(*)
  into v_claim_count
  from public.guest_allowance_claims as claim
  where claim.allowance_id = new.allowance_id
    and (tg_op <> 'UPDATE' or claim.guest_id <> old.guest_id);

  if v_claim_count >= v_max_count then
    raise exception using
      errcode = '23514',
      constraint = 'guest_allowance_claims_capacity_check',
      message = 'The allowance has no remaining capacity.';
  end if;

  return new;
end;
$function$;

create trigger guest_allowance_claims_validate
before insert or update on public.guest_allowance_claims
for each row
execute function private.enforce_guest_allowance_claim();

create function private.can_manage_guest_domain(
  p_wedding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.wedding_memberships as membership
        where membership.wedding_id = p_wedding_id
          and membership.user_id = (select auth.uid())
          and membership.status = 'ACTIVE'
          and membership.role in (
            'OWNER',
            'FULL_COORDINATOR',
            'GUEST_COORDINATOR'
          )
      )
      or private.controls_coordinator_managed_wedding(p_wedding_id)
    );
$function$;

create function public.create_guest_household(
  p_wedding_id uuid,
  p_display_name text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_household_id uuid;
begin
  if (select auth.uid()) is null
     or not private.can_manage_guest_domain(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  if p_display_name is null or pg_catalog.btrim(p_display_name) = '' then
    raise exception using errcode = '22023', message = 'Household display name is required.';
  end if;

  insert into public.guest_households (
    wedding_id,
    display_name,
    delivery_status,
    sent_at,
    notes
  )
  values (
    p_wedding_id,
    pg_catalog.btrim(p_display_name),
    'NOT_SENT',
    null,
    nullif(pg_catalog.btrim(p_notes), '')
  )
  returning id into v_household_id;

  return v_household_id;
end;
$function$;

create function public.create_guest(
  p_wedding_id uuid,
  p_household_id uuid,
  p_display_name text,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null,
  p_phone text default null,
  p_accessibility_assistance_note text default null,
  p_internal_notes text default null
)
returns table (
  person_id uuid,
  guest_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_person_id uuid;
  v_guest_id uuid;
begin
  if (select auth.uid()) is null
     or not private.can_manage_guest_domain(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  if p_display_name is null or pg_catalog.btrim(p_display_name) = '' then
    raise exception using errcode = '22023', message = 'Guest display name is required.';
  end if;

  perform 1
  from public.guest_households as household
  where household.id = p_household_id
    and household.wedding_id = p_wedding_id;

  if not found then
    raise exception using errcode = '22023', message = 'Household does not belong to the Wedding.';
  end if;

  insert into public.wedding_people (
    wedding_id,
    linked_user_id,
    display_name,
    first_name,
    last_name,
    email,
    phone
  )
  values (
    p_wedding_id,
    null,
    pg_catalog.btrim(p_display_name),
    nullif(pg_catalog.btrim(p_first_name), ''),
    nullif(pg_catalog.btrim(p_last_name), ''),
    nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
    nullif(pg_catalog.btrim(p_phone), '')
  )
  returning id into v_person_id;

  insert into public.guests (
    wedding_id,
    person_id,
    household_id,
    accessibility_assistance_note,
    internal_notes
  )
  values (
    p_wedding_id,
    v_person_id,
    p_household_id,
    nullif(pg_catalog.btrim(p_accessibility_assistance_note), ''),
    nullif(pg_catalog.btrim(p_internal_notes), '')
  )
  returning id into v_guest_id;

  return query select v_person_id, v_guest_id;
end;
$function$;

create function public.add_existing_person_as_guest(
  p_wedding_id uuid,
  p_person_id uuid,
  p_household_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_guest_id uuid;
begin
  if (select auth.uid()) is null
     or not private.can_manage_guest_domain(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  perform 1
  from public.wedding_people as person
  where person.id = p_person_id
    and person.wedding_id = p_wedding_id;

  if not found then
    raise exception using errcode = '22023', message = 'Person does not belong to the Wedding.';
  end if;

  perform 1
  from public.guest_households as household
  where household.id = p_household_id
    and household.wedding_id = p_wedding_id;

  if not found then
    raise exception using errcode = '22023', message = 'Household does not belong to the Wedding.';
  end if;

  insert into public.guests (wedding_id, person_id, household_id)
  values (p_wedding_id, p_person_id, p_household_id)
  returning id into v_guest_id;

  return v_guest_id;
end;
$function$;

create function public.update_guest_person(
  p_wedding_id uuid,
  p_guest_id uuid,
  p_display_name text,
  p_first_name text default null,
  p_last_name text default null,
  p_email text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_person_id uuid;
begin
  if (select auth.uid()) is null
     or not private.can_manage_guest_domain(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  if p_display_name is null or pg_catalog.btrim(p_display_name) = '' then
    raise exception using errcode = '22023', message = 'Guest display name is required.';
  end if;

  select guest.person_id
  into v_person_id
  from public.guests as guest
  where guest.id = p_guest_id
    and guest.wedding_id = p_wedding_id;

  if not found then
    raise exception using errcode = '22023', message = 'Guest does not belong to the Wedding.';
  end if;

  update public.wedding_people as person
  set
    display_name = pg_catalog.btrim(p_display_name),
    first_name = nullif(pg_catalog.btrim(p_first_name), ''),
    last_name = nullif(pg_catalog.btrim(p_last_name), ''),
    email = nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
    phone = nullif(pg_catalog.btrim(p_phone), '')
  where person.id = v_person_id
    and person.wedding_id = p_wedding_id;

  return v_person_id;
end;
$function$;

create function public.mark_household_invitation_sent(
  p_household_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_sent_at timestamptz;
begin
  select household.wedding_id
  into v_wedding_id
  from public.guest_households as household
  where household.id = p_household_id;

  if not found
     or (select auth.uid()) is null
     or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  update public.guest_households as household
  set
    delivery_status = 'SENT',
    sent_at = coalesce(household.sent_at, pg_catalog.now())
  where household.id = p_household_id
    and household.wedding_id = v_wedding_id
  returning household.sent_at into v_sent_at;

  return v_sent_at;
end;
$function$;

create function public.reset_household_invitation_delivery(
  p_household_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select household.wedding_id
  into v_wedding_id
  from public.guest_households as household
  where household.id = p_household_id;

  if not found
     or (select auth.uid()) is null
     or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Guest-domain management is not permitted.';
  end if;

  update public.guest_households
  set delivery_status = 'NOT_SENT', sent_at = null
  where id = p_household_id
    and wedding_id = v_wedding_id;
end;
$function$;

create function public.set_guest_rsvp(
  p_guest_id uuid,
  p_status public.guest_rsvp_status,
  p_meal_choice text default null,
  p_dietary_notes text default null,
  p_response_notes text default null
)
returns table (
  guest_id uuid,
  wedding_id uuid,
  status public.guest_rsvp_status,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_previous_status public.guest_rsvp_status;
  v_responded_at timestamptz;
begin
  select rsvp.wedding_id, rsvp.status
  into v_wedding_id, v_previous_status
  from public.guest_rsvps as rsvp
  where rsvp.guest_id = p_guest_id
  for update;

  if not found
     or (select auth.uid()) is null
     or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception using errcode = '42501', message = 'RSVP management is not permitted.';
  end if;

  v_responded_at := case
    when p_status = 'NO_RESPONSE' then null
    when v_previous_status = 'NO_RESPONSE' or v_previous_status <> p_status
      then pg_catalog.now()
    else (
      select rsvp.responded_at
      from public.guest_rsvps as rsvp
      where rsvp.guest_id = p_guest_id
    )
  end;

  update public.guest_rsvps as rsvp
  set
    status = p_status,
    meal_choice = nullif(pg_catalog.btrim(p_meal_choice), ''),
    dietary_notes = nullif(pg_catalog.btrim(p_dietary_notes), ''),
    response_notes = nullif(pg_catalog.btrim(p_response_notes), ''),
    responded_at = v_responded_at
  where rsvp.guest_id = p_guest_id
    and rsvp.wedding_id = v_wedding_id;

  return query
  select p_guest_id, v_wedding_id, p_status, v_responded_at;
end;
$function$;

create function public.claim_guest_allowance(
  p_allowance_id uuid,
  p_guest_id uuid
)
returns table (
  allowance_id uuid,
  wedding_id uuid,
  guest_id uuid,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_claimed_at timestamptz := pg_catalog.now();
begin
  select allowance.wedding_id
  into v_wedding_id
  from public.guest_allowances as allowance
  where allowance.id = p_allowance_id
  for update;

  if not found
     or (select auth.uid()) is null
     or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Allowance management is not permitted.';
  end if;

  insert into public.guest_allowance_claims (
    allowance_id,
    wedding_id,
    guest_id,
    claimed_at
  )
  values (
    p_allowance_id,
    v_wedding_id,
    p_guest_id,
    v_claimed_at
  );

  return query
  select p_allowance_id, v_wedding_id, p_guest_id, v_claimed_at;
end;
$function$;

create function public.release_guest_allowance_claim(
  p_allowance_id uuid,
  p_guest_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select allowance.wedding_id
  into v_wedding_id
  from public.guest_allowances as allowance
  where allowance.id = p_allowance_id
  for update;

  if not found
     or (select auth.uid()) is null
     or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Allowance management is not permitted.';
  end if;

  delete from public.guest_allowance_claims as claim
  where claim.allowance_id = p_allowance_id
    and claim.wedding_id = v_wedding_id
    and claim.guest_id = p_guest_id;
end;
$function$;

create view public.guest_household_rsvp_progress
with (security_invoker = true)
as
select
  household.id as household_id,
  household.wedding_id,
  pg_catalog.count(guest.id)::integer as total_guests,
  pg_catalog.count(guest.id) filter (
    where rsvp.status <> 'NO_RESPONSE'
  )::integer as responded_guests,
  pg_catalog.count(guest.id) filter (
    where rsvp.status = 'ATTENDING'
  )::integer as attending_guests,
  pg_catalog.count(guest.id) filter (
    where rsvp.status = 'DECLINED'
  )::integer as declined_guests,
  case
    when pg_catalog.count(guest.id) filter (
      where rsvp.status <> 'NO_RESPONSE'
    ) = 0
      then 'NO_RESPONSE'::public.household_rsvp_progress
    when pg_catalog.count(guest.id) filter (
      where rsvp.status <> 'NO_RESPONSE'
    ) < pg_catalog.count(guest.id)
      then 'PARTIALLY_RESPONDED'::public.household_rsvp_progress
    else 'RESPONDED'::public.household_rsvp_progress
  end as progress
from public.guest_households as household
left join public.guests as guest
  on guest.wedding_id = household.wedding_id
 and guest.household_id = household.id
left join public.guest_rsvps as rsvp
  on rsvp.wedding_id = guest.wedding_id
 and rsvp.guest_id = guest.id
group by household.id, household.wedding_id;

alter table public.guest_households enable row level security;
alter table public.guests enable row level security;
alter table public.guest_rsvps enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guest_group_memberships enable row level security;
alter table public.guest_allowances enable row level security;
alter table public.guest_allowance_claims enable row level security;
alter table public.entourage_roles enable row level security;
alter table public.entourage_assignments enable row level security;

create policy guest_households_select_member
on public.guest_households for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_households_insert_manager
on public.guest_households for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_households_update_manager
on public.guest_households for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_households_delete_manager
on public.guest_households for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guests_select_member
on public.guests for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guests_insert_manager
on public.guests for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guests_update_manager
on public.guests for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guests_delete_manager
on public.guests for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_rsvps_select_member
on public.guest_rsvps for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_rsvps_insert_manager
on public.guest_rsvps for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_rsvps_update_manager
on public.guest_rsvps for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_rsvps_delete_manager
on public.guest_rsvps for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_groups_select_member
on public.guest_groups for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_groups_insert_manager
on public.guest_groups for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_groups_update_manager
on public.guest_groups for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_groups_delete_manager
on public.guest_groups for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_group_memberships_select_member
on public.guest_group_memberships for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_group_memberships_insert_manager
on public.guest_group_memberships for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_group_memberships_update_manager
on public.guest_group_memberships for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_group_memberships_delete_manager
on public.guest_group_memberships for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowances_select_member
on public.guest_allowances for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_allowances_insert_manager
on public.guest_allowances for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowances_update_manager
on public.guest_allowances for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowances_delete_manager
on public.guest_allowances for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowance_claims_select_member
on public.guest_allowance_claims for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy guest_allowance_claims_insert_manager
on public.guest_allowance_claims for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowance_claims_update_manager
on public.guest_allowance_claims for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy guest_allowance_claims_delete_manager
on public.guest_allowance_claims for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_roles_select_member
on public.entourage_roles for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy entourage_roles_insert_manager
on public.entourage_roles for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_roles_update_manager
on public.entourage_roles for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_roles_delete_manager
on public.entourage_roles for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_assignments_select_member
on public.entourage_assignments for select to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy entourage_assignments_insert_manager
on public.entourage_assignments for insert to authenticated
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_assignments_update_manager
on public.entourage_assignments for update to authenticated
using ((select private.can_manage_guest_domain(wedding_id)))
with check ((select private.can_manage_guest_domain(wedding_id)));

create policy entourage_assignments_delete_manager
on public.entourage_assignments for delete to authenticated
using ((select private.can_manage_guest_domain(wedding_id)));

revoke all on table public.guest_households,
  public.guests,
  public.guest_rsvps,
  public.guest_groups,
  public.guest_group_memberships,
  public.guest_allowances,
  public.guest_allowance_claims,
  public.entourage_roles,
  public.entourage_assignments,
  public.guest_household_rsvp_progress
from public, anon, authenticated, service_role;

grant select on table public.guest_households,
  public.guests,
  public.guest_rsvps,
  public.guest_groups,
  public.guest_group_memberships,
  public.guest_allowances,
  public.guest_allowance_claims,
  public.entourage_roles,
  public.entourage_assignments,
  public.guest_household_rsvp_progress
to authenticated;

grant update (display_name, notes), delete
on table public.guest_households
to authenticated;

grant update (accessibility_assistance_note, internal_notes)
on table public.guests
to authenticated;

grant insert (wedding_id, name, sort_order),
  update (name, sort_order),
  delete
on table public.guest_groups
to authenticated;

grant insert (wedding_id, guest_group_id, guest_id), delete
on table public.guest_group_memberships
to authenticated;

grant insert (
  wedding_id,
  household_id,
  sponsor_guest_id,
  allowance_type,
  max_count
),
update (
  household_id,
  sponsor_guest_id,
  allowance_type,
  max_count
),
delete
on table public.guest_allowances
to authenticated;

grant insert (wedding_id, name, description, sort_order, preset_key),
  update (name, description, sort_order, preset_key),
  delete
on table public.entourage_roles
to authenticated;

grant insert (wedding_id, role_id, guest_id), delete
on table public.entourage_assignments
to authenticated;

grant select, insert, update, delete
on table public.guest_households,
  public.guests,
  public.guest_rsvps,
  public.guest_groups,
  public.guest_group_memberships,
  public.guest_allowances,
  public.guest_allowance_claims,
  public.entourage_roles,
  public.entourage_assignments
to service_role;

grant select on table public.guest_household_rsvp_progress
to service_role;

revoke all on type public.household_invitation_delivery_status,
  public.guest_rsvp_status,
  public.household_rsvp_progress,
  public.guest_allowance_type
from public, anon, authenticated, service_role;

grant usage on type public.household_invitation_delivery_status,
  public.guest_rsvp_status,
  public.household_rsvp_progress,
  public.guest_allowance_type
to authenticated, service_role;

revoke execute on function private.normalize_wedding_person_contact(),
  private.create_initial_guest_rsvp(),
  private.enforce_guest_allowance_configuration(),
  private.prevent_claimed_allowance_mutation(),
  private.enforce_guest_allowance_claim(),
  private.can_manage_guest_domain(uuid)
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_guest_domain(uuid)
to authenticated;

revoke execute on function public.create_guest_household(uuid, text, text),
  public.create_guest(uuid, uuid, text, text, text, text, text, text, text),
  public.add_existing_person_as_guest(uuid, uuid, uuid),
  public.update_guest_person(uuid, uuid, text, text, text, text, text),
  public.mark_household_invitation_sent(uuid),
  public.reset_household_invitation_delivery(uuid),
  public.set_guest_rsvp(uuid, public.guest_rsvp_status, text, text, text),
  public.claim_guest_allowance(uuid, uuid),
  public.release_guest_allowance_claim(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_guest_household(uuid, text, text),
  public.create_guest(uuid, uuid, text, text, text, text, text, text, text),
  public.add_existing_person_as_guest(uuid, uuid, uuid),
  public.update_guest_person(uuid, uuid, text, text, text, text, text),
  public.mark_household_invitation_sent(uuid),
  public.reset_household_invitation_delivery(uuid),
  public.set_guest_rsvp(uuid, public.guest_rsvp_status, text, text, text),
  public.claim_guest_allowance(uuid, uuid),
  public.release_guest_allowance_claim(uuid, uuid)
to authenticated;

comment on table public.guest_households is
  'Wedding invitation units. Delivery state is independent of individual RSVP state; guest counts and household RSVP progress are derived.';

comment on table public.guests is
  'Guest-system participation for one canonical Wedding Person. Names and contact details remain on wedding_people.';

comment on table public.guest_rsvps is
  'Exactly one current individual RSVP state per Guest. Seating, Guest Pass, and Check-In are separate future domains.';

comment on view public.guest_household_rsvp_progress is
  'RLS-respecting derived Household RSVP aggregates with no guest-sensitive notes.';

comment on table public.guest_allowances is
  'Household-scoped Plus-One or child capacity. An allowance is not a Person or Guest.';

comment on table public.guest_allowance_claims is
  'Transaction-safe links from named Guests to allowances. The claim trigger serializes capacity enforcement on the allowance row.';

comment on table public.entourage_roles is
  'Customizable Wedding-specific entourage role definitions; preset_key never makes a role immutable.';

comment on table public.entourage_assignments is
  'Many-to-many entourage assignments to existing Guests. Assignments do not imply RSVP, seating, visibility, or attire.';

comment on function private.can_manage_guest_domain(uuid) is
  'Returns true only for an active Owner, Full Coordinator, Guest Coordinator, or the valid temporary coordinator-managed controller of the Wedding.';

comment on function public.create_guest_household(uuid, text, text) is
  'SECURITY DEFINER is required because direct Household INSERT is closed. It derives auth.uid(), enforces Guest-domain authority, and fixes delivery state to NOT_SENT.';

comment on function public.create_guest(uuid, uuid, text, text, text, text, text, text, text) is
  'SECURITY DEFINER atomically creates a canonical unlinked Wedding Person, Guest participation row, and trigger-created NO_RESPONSE RSVP after validating auth.uid(), authority, and Household boundary.';

comment on function public.add_existing_person_as_guest(uuid, uuid, uuid) is
  'SECURITY DEFINER adds an existing same-Wedding Person as a Guest without duplicating identity and creates the initial RSVP via trigger.';

comment on function public.update_guest_person(uuid, uuid, text, text, text, text, text) is
  'SECURITY DEFINER narrowly updates name/contact fields for an existing same-Wedding Guest Person and never mutates linked_user_id.';

comment on function public.mark_household_invitation_sent(uuid) is
  'SECURITY DEFINER idempotently records invitation delivery without changing any RSVP.';

comment on function public.reset_household_invitation_delivery(uuid) is
  'SECURITY DEFINER deliberately resets invitation delivery to NOT_SENT without changing any RSVP.';

comment on function public.set_guest_rsvp(uuid, public.guest_rsvp_status, text, text, text) is
  'SECURITY DEFINER updates one Guest RSVP for an authorized Wedding Team manager; it does not change delivery, entourage, seating, or check-in state.';

comment on function public.claim_guest_allowance(uuid, uuid) is
  'SECURITY DEFINER locks the allowance and creates a claim only for an actual named Guest in the same Wedding and Household; the trigger enforces capacity transaction-safely.';

comment on function public.release_guest_allowance_claim(uuid, uuid) is
  'SECURITY DEFINER deliberately releases an allowance claim after authorizing the Wedding manager and locking the allowance.';

commit;
