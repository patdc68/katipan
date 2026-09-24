begin;

create type public.wedding_place_source as enum (
  'GOOGLE_PLACES',
  'CUSTOM'
);

create type public.wedding_place_type as enum (
  'CHURCH_RELIGIOUS',
  'GARDEN',
  'BEACH',
  'RESORT',
  'HOTEL',
  'EVENT_SPACE',
  'RESTAURANT',
  'PRIVATE_ESTATE',
  'HOME',
  'CIVIL_VENUE',
  'DESTINATION',
  'OTHER'
);

create type public.wedding_place_purpose as enum (
  'CEREMONY',
  'RECEPTION',
  'ACCOMMODATION',
  'PRENUP',
  'GETTING_READY',
  'REHEARSAL',
  'AFTER_PARTY',
  'TRANSPORT',
  'OTHER'
);

create table public.wedding_places (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  source public.wedding_place_source not null,
  place_type public.wedding_place_type not null default 'OTHER',
  google_place_id text,
  google_place_id_refreshed_at timestamptz,
  custom_name text,
  custom_address text,
  custom_latitude double precision,
  custom_longitude double precision,
  user_label text,
  private_notes text,
  guest_notes text,
  archived_at timestamptz,
  created_by_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_places_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_places_created_by_user_id_fkey
    foreign key (created_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint wedding_places_wedding_id_id_key
    unique (wedding_id, id),
  constraint wedding_places_source_fields_check
    check (
      (
        source = 'GOOGLE_PLACES'
        and google_place_id is not null
        and btrim(google_place_id) <> ''
        and custom_name is null
        and custom_address is null
        and custom_latitude is null
        and custom_longitude is null
      )
      or
      (
        source = 'CUSTOM'
        and google_place_id is null
        and google_place_id_refreshed_at is null
        and custom_name is not null
        and btrim(custom_name) <> ''
      )
    ),
  constraint wedding_places_custom_coordinates_pair_check
    check (
      (custom_latitude is null) = (custom_longitude is null)
      and (
        custom_latitude is null
        or (
          custom_latitude between -90 and 90
          and custom_longitude between -180 and 180
        )
      )
    ),
  constraint wedding_places_google_place_id_trimmed_check
    check (google_place_id is null or google_place_id = btrim(google_place_id)),
  constraint wedding_places_custom_name_trimmed_check
    check (custom_name is null or custom_name = btrim(custom_name)),
  constraint wedding_places_custom_address_not_blank
    check (custom_address is null or btrim(custom_address) <> ''),
  constraint wedding_places_user_label_not_blank
    check (user_label is null or btrim(user_label) <> ''),
  constraint wedding_places_archived_after_created_check
    check (archived_at is null or archived_at >= created_at)
);

create table public.wedding_place_purposes (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  place_id uuid not null,
  purpose public.wedding_place_purpose not null,
  sort_order integer not null default 0,
  guest_visible boolean not null default false,
  purpose_label text,
  private_notes text,
  guest_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_place_purposes_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_place_purposes_place_same_wedding_fkey
    foreign key (wedding_id, place_id)
    references public.wedding_places (wedding_id, id)
    on delete cascade,
  constraint wedding_place_purposes_place_purpose_key
    unique (wedding_id, place_id, purpose),
  constraint wedding_place_purposes_sort_order_nonnegative
    check (sort_order >= 0),
  constraint wedding_place_purposes_label_not_blank
    check (purpose_label is null or btrim(purpose_label) <> '')
);

create unique index wedding_places_active_google_place_id_key
  on public.wedding_places (wedding_id, google_place_id)
  where source = 'GOOGLE_PLACES' and archived_at is null;

create index wedding_places_active_wedding_created_idx
  on public.wedding_places (wedding_id, created_at, id)
  where archived_at is null;

create index wedding_places_created_by_user_id_idx
  on public.wedding_places (created_by_user_id)
  where created_by_user_id is not null;

create index wedding_place_purposes_wedding_purpose_sort_idx
  on public.wedding_place_purposes (wedding_id, purpose, sort_order, place_id);

create trigger wedding_places_set_updated_at
before update on public.wedding_places
for each row
execute function private.set_updated_at();

create trigger wedding_place_purposes_set_updated_at
before update on public.wedding_place_purposes
for each row
execute function private.set_updated_at();

create function private.can_manage_wedding_places(
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
          and membership.role in ('OWNER', 'FULL_COORDINATOR')
      )
      or private.controls_coordinator_managed_wedding(p_wedding_id)
    );
$function$;

create function private.enforce_active_wedding_place_purpose()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_place_wedding_id uuid;
  v_archived_at timestamptz;
begin
  select place.wedding_id, place.archived_at
  into v_place_wedding_id, v_archived_at
  from public.wedding_places as place
  where place.id = new.place_id;

  if not found or v_place_wedding_id is distinct from new.wedding_id then
    return new;
  end if;

  if v_archived_at is not null then
    raise exception using
      errcode = '23514',
      constraint = 'wedding_place_purposes_active_place_check',
      message = 'A purpose can only be assigned to an active Wedding Place.';
  end if;

  return new;
end;
$function$;

create trigger wedding_place_purposes_require_active_place
before insert or update on public.wedding_place_purposes
for each row
execute function private.enforce_active_wedding_place_purpose();

create function public.create_google_wedding_place(
  p_wedding_id uuid,
  p_google_place_id text,
  p_place_type public.wedding_place_type default 'OTHER',
  p_user_label text default null,
  p_private_notes text default null,
  p_guest_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_place_id uuid;
begin
  if not private.can_manage_wedding_places(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  if p_google_place_id is null or pg_catalog.btrim(p_google_place_id) = '' then
    raise exception using errcode = '22023', message = 'Google Place ID is required.';
  end if;

  insert into public.wedding_places (
    wedding_id,
    source,
    place_type,
    google_place_id,
    user_label,
    private_notes,
    guest_notes
  )
  values (
    p_wedding_id,
    'GOOGLE_PLACES',
    p_place_type,
    pg_catalog.btrim(p_google_place_id),
    nullif(pg_catalog.btrim(p_user_label), ''),
    p_private_notes,
    p_guest_notes
  )
  returning id into v_place_id;

  return v_place_id;
end;
$function$;

create function public.create_custom_wedding_place(
  p_wedding_id uuid,
  p_custom_name text,
  p_place_type public.wedding_place_type default 'OTHER',
  p_custom_address text default null,
  p_custom_latitude double precision default null,
  p_custom_longitude double precision default null,
  p_user_label text default null,
  p_private_notes text default null,
  p_guest_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_place_id uuid;
begin
  if not private.can_manage_wedding_places(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  if p_custom_name is null or pg_catalog.btrim(p_custom_name) = '' then
    raise exception using errcode = '22023', message = 'Custom Place name is required.';
  end if;

  insert into public.wedding_places (
    wedding_id,
    source,
    place_type,
    custom_name,
    custom_address,
    custom_latitude,
    custom_longitude,
    user_label,
    private_notes,
    guest_notes
  )
  values (
    p_wedding_id,
    'CUSTOM',
    p_place_type,
    pg_catalog.btrim(p_custom_name),
    nullif(pg_catalog.btrim(p_custom_address), ''),
    p_custom_latitude,
    p_custom_longitude,
    nullif(pg_catalog.btrim(p_user_label), ''),
    p_private_notes,
    p_guest_notes
  )
  returning id into v_place_id;

  return v_place_id;
end;
$function$;

create function public.update_wedding_place_context(
  p_place_id uuid,
  p_place_type public.wedding_place_type,
  p_custom_name text,
  p_custom_address text,
  p_custom_latitude double precision,
  p_custom_longitude double precision,
  p_user_label text,
  p_private_notes text,
  p_guest_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_source public.wedding_place_source;
begin
  select place.wedding_id, place.source
  into v_wedding_id, v_source
  from public.wedding_places as place
  where place.id = p_place_id
    and place.archived_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'Active Wedding Place not found.';
  end if;

  if not private.can_manage_wedding_places(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  if v_source = 'GOOGLE_PLACES'
     and (
       p_custom_name is not null
       or p_custom_address is not null
       or p_custom_latitude is not null
       or p_custom_longitude is not null
     ) then
    raise exception using errcode = '22023', message = 'Google Places cannot store custom Place fields.';
  end if;

  if v_source = 'CUSTOM'
     and (p_custom_name is null or pg_catalog.btrim(p_custom_name) = '') then
    raise exception using errcode = '22023', message = 'Custom Place name is required.';
  end if;

  update public.wedding_places as place
  set
    place_type = p_place_type,
    custom_name = case
      when v_source = 'CUSTOM' then pg_catalog.btrim(p_custom_name)
      else null
    end,
    custom_address = case
      when v_source = 'CUSTOM' then nullif(pg_catalog.btrim(p_custom_address), '')
      else null
    end,
    custom_latitude = case when v_source = 'CUSTOM' then p_custom_latitude else null end,
    custom_longitude = case when v_source = 'CUSTOM' then p_custom_longitude else null end,
    user_label = nullif(pg_catalog.btrim(p_user_label), ''),
    private_notes = p_private_notes,
    guest_notes = p_guest_notes
  where place.id = p_place_id;

  return p_place_id;
end;
$function$;

create function public.set_wedding_place_purpose(
  p_place_id uuid,
  p_purpose public.wedding_place_purpose,
  p_sort_order integer default 0,
  p_guest_visible boolean default false,
  p_purpose_label text default null,
  p_private_notes text default null,
  p_guest_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_purpose_id uuid;
begin
  select place.wedding_id
  into v_wedding_id
  from public.wedding_places as place
  where place.id = p_place_id
    and place.archived_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'Active Wedding Place not found.';
  end if;

  if not private.can_manage_wedding_places(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  insert into public.wedding_place_purposes (
    wedding_id,
    place_id,
    purpose,
    sort_order,
    guest_visible,
    purpose_label,
    private_notes,
    guest_notes
  )
  values (
    v_wedding_id,
    p_place_id,
    p_purpose,
    p_sort_order,
    p_guest_visible,
    nullif(pg_catalog.btrim(p_purpose_label), ''),
    p_private_notes,
    p_guest_notes
  )
  on conflict on constraint wedding_place_purposes_place_purpose_key
  do update set
    sort_order = excluded.sort_order,
    guest_visible = excluded.guest_visible,
    purpose_label = excluded.purpose_label,
    private_notes = excluded.private_notes,
    guest_notes = excluded.guest_notes
  returning id into v_purpose_id;

  return v_purpose_id;
end;
$function$;

create function public.remove_wedding_place_purpose(
  p_place_id uuid,
  p_purpose public.wedding_place_purpose
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select place.wedding_id
  into v_wedding_id
  from public.wedding_places as place
  where place.id = p_place_id;

  if not found then
    raise exception using errcode = '22023', message = 'Wedding Place not found.';
  end if;

  if not private.can_manage_wedding_places(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  delete from public.wedding_place_purposes as assignment
  where assignment.wedding_id = v_wedding_id
    and assignment.place_id = p_place_id
    and assignment.purpose = p_purpose;

  return found;
end;
$function$;

create function public.archive_wedding_place(
  p_place_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_archived_at timestamptz;
begin
  select place.wedding_id, place.archived_at
  into v_wedding_id, v_archived_at
  from public.wedding_places as place
  where place.id = p_place_id;

  if not found then
    raise exception using errcode = '22023', message = 'Wedding Place not found.';
  end if;

  if not private.can_manage_wedding_places(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  if v_archived_at is null then
    v_archived_at := pg_catalog.now();

    update public.wedding_places as place
    set archived_at = v_archived_at
    where place.id = p_place_id;
  end if;

  return v_archived_at;
end;
$function$;

create function public.mark_google_wedding_place_refreshed(
  p_place_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_source public.wedding_place_source;
  v_refreshed_at timestamptz;
begin
  select place.wedding_id, place.source
  into v_wedding_id, v_source
  from public.wedding_places as place
  where place.id = p_place_id
    and place.archived_at is null;

  if not found then
    raise exception using errcode = '22023', message = 'Active Wedding Place not found.';
  end if;

  if not private.can_manage_wedding_places(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Wedding Place management is not permitted.';
  end if;

  if v_source <> 'GOOGLE_PLACES' then
    raise exception using errcode = '22023', message = 'Only a Google Place ID can be marked refreshed.';
  end if;

  v_refreshed_at := pg_catalog.now();

  update public.wedding_places as place
  set google_place_id_refreshed_at = v_refreshed_at
  where place.id = p_place_id;

  return v_refreshed_at;
end;
$function$;

alter table public.wedding_places enable row level security;
alter table public.wedding_place_purposes enable row level security;

create policy wedding_places_select_member
on public.wedding_places
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy wedding_places_insert_manager
on public.wedding_places
for insert
to authenticated
with check ((select private.can_manage_wedding_places(wedding_id)));

create policy wedding_places_update_manager
on public.wedding_places
for update
to authenticated
using ((select private.can_manage_wedding_places(wedding_id)))
with check ((select private.can_manage_wedding_places(wedding_id)));

create policy wedding_place_purposes_select_member
on public.wedding_place_purposes
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy wedding_place_purposes_insert_manager
on public.wedding_place_purposes
for insert
to authenticated
with check ((select private.can_manage_wedding_places(wedding_id)));

create policy wedding_place_purposes_update_manager
on public.wedding_place_purposes
for update
to authenticated
using ((select private.can_manage_wedding_places(wedding_id)))
with check ((select private.can_manage_wedding_places(wedding_id)));

create policy wedding_place_purposes_delete_manager
on public.wedding_place_purposes
for delete
to authenticated
using ((select private.can_manage_wedding_places(wedding_id)));

revoke all on table public.wedding_places,
  public.wedding_place_purposes
from public, anon, authenticated, service_role;

grant select on table public.wedding_places,
  public.wedding_place_purposes
to authenticated;

grant insert (
  wedding_id,
  source,
  place_type,
  google_place_id,
  custom_name,
  custom_address,
  custom_latitude,
  custom_longitude,
  user_label,
  private_notes,
  guest_notes
),
update (
  place_type,
  google_place_id_refreshed_at,
  custom_name,
  custom_address,
  custom_latitude,
  custom_longitude,
  user_label,
  private_notes,
  guest_notes,
  archived_at
)
on table public.wedding_places
to authenticated;

grant insert (
  wedding_id,
  place_id,
  purpose,
  sort_order,
  guest_visible,
  purpose_label,
  private_notes,
  guest_notes
),
update (
  sort_order,
  guest_visible,
  purpose_label,
  private_notes,
  guest_notes
),
delete
on table public.wedding_place_purposes
to authenticated;

grant select, insert, update, delete
on table public.wedding_places,
  public.wedding_place_purposes
to service_role;

revoke all on type public.wedding_place_source,
  public.wedding_place_type,
  public.wedding_place_purpose
from public, anon, authenticated, service_role;

grant usage on type public.wedding_place_source,
  public.wedding_place_type,
  public.wedding_place_purpose
to authenticated, service_role;

revoke execute on function private.can_manage_wedding_places(uuid),
  private.enforce_active_wedding_place_purpose()
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_wedding_places(uuid)
to authenticated;

revoke execute on function public.create_google_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  text,
  text
),
public.create_custom_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  double precision,
  double precision,
  text,
  text,
  text
),
public.update_wedding_place_context(
  uuid,
  public.wedding_place_type,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text
),
public.set_wedding_place_purpose(
  uuid,
  public.wedding_place_purpose,
  integer,
  boolean,
  text,
  text,
  text
),
public.remove_wedding_place_purpose(uuid, public.wedding_place_purpose),
public.archive_wedding_place(uuid),
public.mark_google_wedding_place_refreshed(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_google_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  text,
  text
),
public.create_custom_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  double precision,
  double precision,
  text,
  text,
  text
),
public.update_wedding_place_context(
  uuid,
  public.wedding_place_type,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text
),
public.set_wedding_place_purpose(
  uuid,
  public.wedding_place_purpose,
  integer,
  boolean,
  text,
  text,
  text
),
public.remove_wedding_place_purpose(uuid, public.wedding_place_purpose),
public.archive_wedding_place(uuid),
public.mark_google_wedding_place_refreshed(uuid)
to authenticated, service_role;

comment on type public.wedding_place_type is
  'Physical Place classification. It is deliberately independent from weddings.ceremony_style.';

comment on table public.wedding_places is
  'Wedding-owned Places. GOOGLE_PLACES rows persist only a Place ID plus KATIPAN-owned context; Google response data remains transient.';

comment on table public.wedding_place_purposes is
  'Many-to-many Place purpose assignments. guest_visible is future publication eligibility and grants no anonymous access.';

comment on function private.can_manage_wedding_places(uuid) is
  'Returns true for an active Owner, active Full Coordinator, or the valid temporary coordinator-managed controller.';

comment on function public.create_google_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  text,
  text
) is
  'Creates a Google-backed Place while persisting only its Place ID and KATIPAN-owned context.';

comment on function public.create_custom_wedding_place(
  uuid,
  text,
  public.wedding_place_type,
  text,
  double precision,
  double precision,
  text,
  text,
  text
) is
  'Creates a KATIPAN-owned custom Place with an optional valid coordinate pair.';

commit;
