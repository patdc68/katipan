begin;

create type public.wedding_origin as enum (
  'COUPLE_CREATED',
  'COORDINATOR_CREATED'
);

create type public.wedding_status as enum (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

create type public.wedding_ownership_mode as enum (
  'COORDINATOR_MANAGED',
  'COUPLE_OWNED'
);

create type public.wedding_membership_role as enum (
  'OWNER',
  'FULL_COORDINATOR',
  'DAY_OF_COORDINATOR',
  'GUEST_COORDINATOR'
);

create type public.wedding_membership_status as enum (
  'ACTIVE',
  'LEFT',
  'REMOVED'
);

create type public.ceremony_style as enum (
  'RELIGIOUS',
  'CIVIL',
  'SYMBOLIC',
  'SECULAR',
  'DESTINATION',
  'OTHER',
  'UNDECIDED'
);

create table public.profiles (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_fkey
    foreign key (id)
    references auth.users (id)
    on delete cascade,
  constraint profiles_display_name_not_blank
    check (display_name is null or btrim(display_name) <> '')
);

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  origin public.wedding_origin not null,
  status public.wedding_status not null default 'DRAFT',
  ownership_mode public.wedding_ownership_mode not null,
  created_by_user_id uuid,
  display_name text,
  wedding_date date,
  timezone text,
  general_location text,
  estimated_guest_count integer,
  ceremony_style public.ceremony_style not null default 'UNDECIDED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weddings_created_by_user_id_fkey
    foreign key (created_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint weddings_estimated_guest_count_nonnegative
    check (estimated_guest_count is null or estimated_guest_count >= 0),
  constraint weddings_couple_created_is_couple_owned
    check (
      origin <> 'COUPLE_CREATED'
      or ownership_mode = 'COUPLE_OWNED'
    ),
  constraint weddings_coordinator_managed_creator_required
    check (
      ownership_mode <> 'COORDINATOR_MANAGED'
      or created_by_user_id is not null
    ),
  constraint weddings_display_name_not_blank
    check (display_name is null or btrim(display_name) <> ''),
  constraint weddings_timezone_not_blank
    check (timezone is null or btrim(timezone) <> ''),
  constraint weddings_general_location_not_blank
    check (general_location is null or btrim(general_location) <> '')
);

create table public.wedding_people (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  linked_user_id uuid,
  first_name text,
  last_name text,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_people_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_people_linked_user_id_fkey
    foreign key (linked_user_id)
    references auth.users (id)
    on delete set null,
  constraint wedding_people_wedding_id_id_key
    unique (wedding_id, id),
  constraint wedding_people_display_name_not_blank
    check (btrim(display_name) <> ''),
  constraint wedding_people_first_name_not_blank
    check (first_name is null or btrim(first_name) <> ''),
  constraint wedding_people_last_name_not_blank
    check (last_name is null or btrim(last_name) <> '')
);

create table public.wedding_partners (
  wedding_id uuid not null,
  person_id uuid not null,
  partner_order smallint not null,
  joined_workspace_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wedding_partners_pkey
    primary key (wedding_id, person_id),
  constraint wedding_partners_wedding_partner_order_key
    unique (wedding_id, partner_order),
  constraint wedding_partners_partner_order_check
    check (partner_order in (1, 2)),
  constraint wedding_partners_person_same_wedding_fkey
    foreign key (wedding_id, person_id)
    references public.wedding_people (wedding_id, id)
    on delete cascade
);

create table public.wedding_memberships (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  user_id uuid,
  role public.wedding_membership_role not null,
  status public.wedding_membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_memberships_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_memberships_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete set null,
  constraint wedding_memberships_wedding_id_user_id_key
    unique (wedding_id, user_id),
  constraint wedding_memberships_status_lifecycle_check
    check (
      (
        status = 'ACTIVE'
        and user_id is not null
        and ended_at is null
      )
      or
      (
        status in ('LEFT', 'REMOVED')
        and ended_at is not null
      )
    ),
  constraint wedding_memberships_ended_after_joined_check
    check (ended_at is null or ended_at >= joined_at)
);

create index weddings_created_by_user_id_idx
  on public.weddings (created_by_user_id)
  where created_by_user_id is not null;

create index wedding_people_wedding_id_idx
  on public.wedding_people (wedding_id);

create unique index wedding_people_wedding_linked_user_key
  on public.wedding_people (wedding_id, linked_user_id)
  where linked_user_id is not null;

create index wedding_people_linked_user_id_idx
  on public.wedding_people (linked_user_id)
  where linked_user_id is not null;

create index wedding_memberships_user_status_wedding_idx
  on public.wedding_memberships (user_id, status, wedding_id)
  include (role)
  where user_id is not null;

create index wedding_memberships_active_wedding_role_idx
  on public.wedding_memberships (wedding_id, role)
  where status = 'ACTIVE';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create trigger weddings_set_updated_at
before update on public.weddings
for each row
execute function private.set_updated_at();

create trigger wedding_people_set_updated_at
before update on public.wedding_people
for each row
execute function private.set_updated_at();

create trigger wedding_memberships_set_updated_at
before update on public.wedding_memberships
for each row
execute function private.set_updated_at();

create function private.enforce_wedding_governance()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.origin is distinct from old.origin then
    raise exception using
      errcode = '23514',
      constraint = 'weddings_origin_immutable',
      message = 'Wedding origin cannot be changed after creation.';
  end if;

  if old.ownership_mode = 'COUPLE_OWNED'
     and new.ownership_mode = 'COORDINATOR_MANAGED' then
    raise exception using
      errcode = '23514',
      constraint = 'weddings_ownership_mode_monotonic',
      message = 'Wedding ownership mode cannot transition back to COORDINATOR_MANAGED.';
  end if;

  return new;
end;
$function$;

create trigger weddings_enforce_governance
before update on public.weddings
for each row
execute function private.enforce_wedding_governance();

create function private.assert_active_wedding_has_owner(
  p_wedding_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform 1
  from public.weddings as wedding
  where wedding.id = p_wedding_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.weddings as wedding
    where wedding.id = p_wedding_id
      and wedding.status = 'ACTIVE'
      and wedding.ownership_mode = 'COUPLE_OWNED'
      and not exists (
        select 1
        from public.wedding_memberships as membership
        where membership.wedding_id = wedding.id
          and membership.status = 'ACTIVE'
          and membership.role = 'OWNER'
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'weddings_active_couple_owned_owner_required',
      message = 'An active couple-owned Wedding requires at least one active Owner membership.';
  end if;
end;
$function$;

create function private.enforce_active_wedding_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'weddings' then
    if tg_op = 'DELETE' then
      perform private.assert_active_wedding_has_owner(old.id);
    else
      perform private.assert_active_wedding_has_owner(new.id);
    end if;
  elsif tg_table_name = 'wedding_memberships' then
    if tg_op = 'DELETE' then
      perform private.assert_active_wedding_has_owner(old.wedding_id);
    elsif tg_op = 'INSERT' then
      perform private.assert_active_wedding_has_owner(new.wedding_id);
    else
      perform private.assert_active_wedding_has_owner(new.wedding_id);

      if old.wedding_id is distinct from new.wedding_id then
        perform private.assert_active_wedding_has_owner(old.wedding_id);
      end if;
    end if;
  end if;

  return null;
end;
$function$;

create constraint trigger weddings_active_owner_invariant
after insert or update or delete on public.weddings
deferrable initially deferred
for each row
execute function private.enforce_active_wedding_owner();

create constraint trigger wedding_memberships_active_owner_invariant
after insert or update or delete on public.wedding_memberships
deferrable initially deferred
for each row
execute function private.enforce_active_wedding_owner();

create function private.has_active_wedding_membership(
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
      from public.wedding_memberships as membership
      where membership.wedding_id = p_wedding_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'ACTIVE'
    );
$function$;

create function private.has_active_wedding_role(
  p_wedding_id uuid,
  p_roles public.wedding_membership_role[]
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
      from public.wedding_memberships as membership
      where membership.wedding_id = p_wedding_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'ACTIVE'
        and membership.role = any (p_roles)
    );
$function$;

create function private.controls_coordinator_managed_wedding(
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
      join public.wedding_memberships as membership
        on membership.wedding_id = wedding.id
      where wedding.id = p_wedding_id
        and wedding.origin = 'COORDINATOR_CREATED'
        and wedding.ownership_mode = 'COORDINATOR_MANAGED'
        and wedding.created_by_user_id = (select auth.uid())
        and membership.user_id = (select auth.uid())
        and membership.status = 'ACTIVE'
        and membership.role = 'FULL_COORDINATOR'
    );
$function$;

create function private.shares_active_wedding_with_profile(
  p_profile_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_profile_user_id is not null
    and exists (
      select 1
      from public.wedding_memberships as current_membership
      join public.wedding_memberships as profile_membership
        on profile_membership.wedding_id = current_membership.wedding_id
      where current_membership.user_id = (select auth.uid())
        and current_membership.status = 'ACTIVE'
        and profile_membership.user_id = p_profile_user_id
        and profile_membership.status = 'ACTIVE'
    );
$function$;

alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.wedding_people enable row level security;
alter table public.wedding_partners enable row level security;
alter table public.wedding_memberships enable row level security;

create policy profiles_select_visible
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_active_wedding_with_profile(id))
);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy weddings_select_active_member
on public.weddings
for select
to authenticated
using ((select private.has_active_wedding_membership(id)));

create policy weddings_update_owner_or_full_coordinator
on public.weddings
for update
to authenticated
using (
  (select private.has_active_wedding_role(
    id,
    array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[]
  ))
)
with check (
  (select private.has_active_wedding_role(
    id,
    array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[]
  ))
);

create policy wedding_people_select_active_member
on public.wedding_people
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy wedding_partners_select_active_member
on public.wedding_partners
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy wedding_memberships_select_active_member
on public.wedding_memberships
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

revoke all on table public.profiles
from public, anon, authenticated, service_role;

revoke all on table public.weddings
from public, anon, authenticated, service_role;

revoke all on table public.wedding_people
from public, anon, authenticated, service_role;

revoke all on table public.wedding_partners
from public, anon, authenticated, service_role;

revoke all on table public.wedding_memberships
from public, anon, authenticated, service_role;

grant select on table public.profiles to authenticated;
grant insert (id, display_name) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on table public.weddings to authenticated;
grant update (
  display_name,
  wedding_date,
  timezone,
  general_location,
  estimated_guest_count,
  ceremony_style
) on table public.weddings to authenticated;

grant select on table public.wedding_people to authenticated;
grant select on table public.wedding_partners to authenticated;
grant select on table public.wedding_memberships to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.weddings to service_role;
grant select, insert, update, delete on table public.wedding_people to service_role;
grant select, insert, update, delete on table public.wedding_partners to service_role;
grant select, insert, update, delete on table public.wedding_memberships to service_role;

revoke all on type public.wedding_origin
from public, anon, authenticated, service_role;

revoke all on type public.wedding_status
from public, anon, authenticated, service_role;

revoke all on type public.wedding_ownership_mode
from public, anon, authenticated, service_role;

revoke all on type public.wedding_membership_role
from public, anon, authenticated, service_role;

revoke all on type public.wedding_membership_status
from public, anon, authenticated, service_role;

revoke all on type public.ceremony_style
from public, anon, authenticated, service_role;

grant usage on type public.wedding_origin,
  public.wedding_status,
  public.wedding_ownership_mode,
  public.wedding_membership_role,
  public.wedding_membership_status,
  public.ceremony_style
to authenticated, service_role;

revoke execute on function private.set_updated_at()
from public, anon, authenticated, service_role;

revoke execute on function private.enforce_wedding_governance()
from public, anon, authenticated, service_role;

revoke execute on function private.assert_active_wedding_has_owner(uuid)
from public, anon, authenticated, service_role;

revoke execute on function private.enforce_active_wedding_owner()
from public, anon, authenticated, service_role;

revoke execute on function private.has_active_wedding_membership(uuid)
from public, anon, authenticated, service_role;

revoke execute on function private.has_active_wedding_role(
  uuid,
  public.wedding_membership_role[]
)
from public, anon, authenticated, service_role;

revoke execute on function private.controls_coordinator_managed_wedding(uuid)
from public, anon, authenticated, service_role;

revoke execute on function private.shares_active_wedding_with_profile(uuid)
from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;

grant execute on function private.has_active_wedding_membership(uuid)
to authenticated;

grant execute on function private.has_active_wedding_role(
  uuid,
  public.wedding_membership_role[]
)
to authenticated;

grant execute on function private.controls_coordinator_managed_wedding(uuid)
to authenticated;

grant execute on function private.shares_active_wedding_with_profile(uuid)
to authenticated;

comment on table public.profiles is
  'Optional application profile keyed by the authoritative Supabase Auth user ID.';

comment on table public.wedding_people is
  'A real person in a Wedding context, independent of whether the person has a Katipan account.';

comment on table public.wedding_partners is
  'Identifies the two V1 couple/client partner positions without encoding gender or ceremony tradition.';

comment on table public.wedding_memberships is
  'Authenticated User to Wedding authorization relationship. Invitation targets are not Membership rows.';

commit;
