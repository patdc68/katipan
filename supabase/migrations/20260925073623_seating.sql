begin;

create type public.seating_visibility as enum ('HIDDEN', 'TABLE_ONLY', 'TABLE_AND_SEAT');
create type public.seating_table_shape as enum ('ROUND', 'RECTANGULAR', 'SQUARE', 'OVAL', 'OTHER');

create table public.seating_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  event_kind text not null default 'RECEPTION',
  name text not null,
  visibility public.seating_visibility not null default 'HIDDEN',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seating_events_wedding_id_id_key unique (wedding_id, id),
  constraint seating_events_kind_check check (event_kind ~ '^[A-Z][A-Z0-9_]*$'),
  constraint seating_events_name_check check (name = btrim(name) and name <> ''),
  constraint seating_events_sort_order_check check (sort_order >= 0)
);
create unique index seating_events_one_reception_idx
  on public.seating_events(wedding_id) where event_kind = 'RECEPTION';
create index seating_events_wedding_sort_idx on public.seating_events(wedding_id, sort_order, id);

create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  event_id uuid not null,
  name text not null,
  table_number integer,
  capacity integer not null,
  shape public.seating_table_shape not null default 'ROUND',
  zone text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seating_tables_event_fkey foreign key (wedding_id, event_id)
    references public.seating_events(wedding_id, id) on delete cascade,
  constraint seating_tables_wedding_event_id_key unique (wedding_id, event_id, id),
  constraint seating_tables_name_check check (name = btrim(name) and name <> ''),
  constraint seating_tables_number_check check (table_number is null or table_number > 0),
  constraint seating_tables_capacity_check check (capacity > 0),
  constraint seating_tables_zone_check check (zone is null or (zone = btrim(zone) and zone <> '')),
  constraint seating_tables_sort_order_check check (sort_order >= 0)
);
create unique index seating_tables_number_event_idx
  on public.seating_tables(event_id, table_number) where table_number is not null;
create index seating_tables_event_sort_idx
  on public.seating_tables(wedding_id, event_id, sort_order, id);

create table public.seating_seats (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  event_id uuid not null,
  table_id uuid not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seating_seats_table_fkey foreign key (wedding_id, event_id, table_id)
    references public.seating_tables(wedding_id, event_id, id) on delete cascade,
  constraint seating_seats_wedding_event_table_id_key unique (wedding_id, event_id, table_id, id),
  constraint seating_seats_table_label_key unique (table_id, label),
  constraint seating_seats_label_check check (label = btrim(label) and label <> ''),
  constraint seating_seats_sort_order_check check (sort_order >= 0)
);
create index seating_seats_table_sort_idx
  on public.seating_seats(wedding_id, event_id, table_id, sort_order, id);

create table public.seating_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  event_id uuid not null,
  table_id uuid not null,
  seat_id uuid,
  guest_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seating_assignments_event_fkey foreign key (wedding_id, event_id)
    references public.seating_events(wedding_id, id) on delete cascade,
  constraint seating_assignments_table_fkey foreign key (wedding_id, event_id, table_id)
    references public.seating_tables(wedding_id, event_id, id) on delete cascade,
  constraint seating_assignments_seat_fkey foreign key (wedding_id, event_id, table_id, seat_id)
    references public.seating_seats(wedding_id, event_id, table_id, id)
    on delete set null (seat_id),
  constraint seating_assignments_guest_fkey foreign key (wedding_id, guest_id)
    references public.guests(wedding_id, id) on delete cascade,
  constraint seating_assignments_event_guest_key unique (event_id, guest_id)
);
create unique index seating_assignments_seat_key
  on public.seating_assignments(seat_id) where seat_id is not null;
create index seating_assignments_table_capacity_idx
  on public.seating_assignments(wedding_id, event_id, table_id);
create index seating_assignments_seat_fk_idx
  on public.seating_assignments(wedding_id, event_id, table_id, seat_id);
create index seating_assignments_guest_idx
  on public.seating_assignments(wedding_id, guest_id);

create trigger seating_events_set_updated_at before update on public.seating_events
  for each row execute function private.set_updated_at();
create trigger seating_tables_set_updated_at before update on public.seating_tables
  for each row execute function private.set_updated_at();
create trigger seating_seats_set_updated_at before update on public.seating_seats
  for each row execute function private.set_updated_at();
create trigger seating_assignments_set_updated_at before update on public.seating_assignments
  for each row execute function private.set_updated_at();

-- RSVP is the first lock in seating writes. Both RSVP workflows lock that row.
create function private.validate_seating_assignment()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_status public.guest_rsvp_status; v_capacity integer; v_count integer;
begin
  if tg_op = 'UPDATE' and new.wedding_id = old.wedding_id
    and new.event_id = old.event_id and new.table_id = old.table_id
    and new.guest_id = old.guest_id and new.seat_id is null then
    return new;
  end if;
  select r.status into v_status from public.guest_rsvps r
    where r.wedding_id = new.wedding_id and r.guest_id = new.guest_id for update;
  if v_status is distinct from 'ATTENDING' then
    raise exception 'Only an ATTENDING Guest may be seated' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.table_id is distinct from old.table_id
    and new.seat_id is not distinct from old.seat_id then
    new.seat_id := null;
  end if;
  select t.capacity into v_capacity from public.seating_tables t
    where t.wedding_id = new.wedding_id and t.event_id = new.event_id and t.id = new.table_id
    for update;
  if v_capacity is null then
    raise exception 'Seating Table is unavailable' using errcode = '23503';
  end if;
  select count(*) into v_count from public.seating_assignments a
    where a.wedding_id = new.wedding_id and a.event_id = new.event_id
      and a.table_id = new.table_id and a.id <> new.id;
  if v_count >= v_capacity then
    raise exception 'Seating Table is at capacity' using errcode = '23514';
  end if;
  return new;
end;
$function$;
create trigger seating_assignments_validate
  before insert or update of wedding_id, event_id, table_id, seat_id, guest_id
  on public.seating_assignments for each row
  execute function private.validate_seating_assignment();

create function private.validate_seating_table_capacity()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.capacity < (select count(*) from public.seating_assignments a
    where a.wedding_id = new.wedding_id and a.event_id = new.event_id and a.table_id = new.id) then
    raise exception 'Capacity is below the number of seated Guests' using errcode = '23514';
  end if;
  return new;
end;
$function$;
create trigger seating_tables_validate_capacity before update of capacity
  on public.seating_tables for each row execute function private.validate_seating_table_capacity();

-- A decline or RSVP reset removes only that Guest's assignments in every event.
create function private.unseat_non_attending_guest()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  delete from public.seating_assignments a
    where a.wedding_id = new.wedding_id and a.guest_id = new.guest_id;
  return new;
end;
$function$;
create trigger guest_rsvps_unseat_non_attending
  after update of status on public.guest_rsvps for each row
  when (new.status <> 'ATTENDING')
  execute function private.unseat_non_attending_guest();

alter table public.seating_events enable row level security;
alter table public.seating_tables enable row level security;
alter table public.seating_seats enable row level security;
alter table public.seating_assignments enable row level security;
create policy seating_events_member_read on public.seating_events for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
create policy seating_tables_member_read on public.seating_tables for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
create policy seating_seats_member_read on public.seating_seats for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
create policy seating_assignments_member_read on public.seating_assignments for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
revoke all on public.seating_events, public.seating_tables, public.seating_seats,
  public.seating_assignments from public, anon, authenticated;
grant select on public.seating_events, public.seating_tables, public.seating_seats,
  public.seating_assignments to authenticated;
revoke all on type public.seating_visibility, public.seating_table_shape
  from public, anon, authenticated;
grant usage on type public.seating_visibility, public.seating_table_shape to authenticated, service_role;

create function public.create_seating_event(p_wedding_id uuid, p_name text,
  p_event_kind text default 'RECEPTION', p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not private.can_manage_guest_domain(p_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  insert into public.seating_events(wedding_id, name, event_kind, sort_order)
    values (p_wedding_id, btrim(p_name), p_event_kind, p_sort_order) returning id into v_id;
  return v_id;
end;
$function$;

create function public.update_seating_event(p_event_id uuid, p_name text,
  p_event_kind text, p_sort_order integer)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_events where id = p_event_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  update public.seating_events set name = btrim(p_name), event_kind = p_event_kind,
    sort_order = p_sort_order where id = p_event_id;
end;
$function$;

create function public.set_seating_visibility(p_event_id uuid, p_visibility public.seating_visibility)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_events where id = p_event_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  update public.seating_events set visibility = p_visibility where id = p_event_id;
end;
$function$;

create function public.create_seating_table(p_event_id uuid, p_name text, p_capacity integer,
  p_shape public.seating_table_shape default 'ROUND', p_table_number integer default null,
  p_zone text default null, p_notes text default null, p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_events where id = p_event_id;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  insert into public.seating_tables(wedding_id, event_id, name, capacity, shape, table_number, zone, notes, sort_order)
    values (v_wedding_id, p_event_id, btrim(p_name), p_capacity, p_shape, p_table_number,
      nullif(btrim(p_zone), ''), p_notes, p_sort_order) returning id into v_id;
  return v_id;
end;
$function$;

create function public.update_seating_table(p_table_id uuid, p_name text, p_capacity integer,
  p_shape public.seating_table_shape, p_table_number integer, p_zone text,
  p_notes text, p_sort_order integer)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_tables where id = p_table_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  update public.seating_tables set name = btrim(p_name), capacity = p_capacity, shape = p_shape,
    table_number = p_table_number, zone = nullif(btrim(p_zone), ''), notes = p_notes,
    sort_order = p_sort_order where id = p_table_id;
end;
$function$;

create function public.delete_seating_table(p_table_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_tables where id = p_table_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  delete from public.seating_tables where id = p_table_id;
end;
$function$;

create function public.create_seating_seat(p_table_id uuid, p_label text, p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_table public.seating_tables; v_id uuid;
begin
  select * into v_table from public.seating_tables where id = p_table_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_table.wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  insert into public.seating_seats(wedding_id, event_id, table_id, label, sort_order)
    values (v_table.wedding_id, v_table.event_id, p_table_id, btrim(p_label), p_sort_order)
    returning id into v_id;
  return v_id;
end;
$function$;

create function public.update_seating_seat(p_seat_id uuid, p_label text, p_sort_order integer)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_seats where id = p_seat_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  update public.seating_seats set label = btrim(p_label), sort_order = p_sort_order where id = p_seat_id;
end;
$function$;

create function public.delete_seating_seat(p_seat_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_table_id uuid;
begin
  select wedding_id, table_id into v_wedding_id, v_table_id
    from public.seating_seats where id = p_seat_id;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  perform 1 from public.seating_tables where id = v_table_id for update;
  delete from public.seating_seats where id = p_seat_id;
end;
$function$;

-- Assign and move share one atomic workflow. RSVP and Table locks serialize
-- changes with decline, capacity edits, and Table deletion.
create function public.seat_guest(p_event_id uuid, p_guest_id uuid, p_table_id uuid,
  p_seat_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_status public.guest_rsvp_status; v_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_events where id = p_event_id;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  select status into v_status from public.guest_rsvps
    where wedding_id = v_wedding_id and guest_id = p_guest_id for update;
  if v_status is distinct from 'ATTENDING' then
    raise exception 'Only an ATTENDING Guest may be seated' using errcode = '23514';
  end if;
  perform 1 from public.seating_tables
    where wedding_id = v_wedding_id and event_id = p_event_id and id = p_table_id for update;
  if not found then raise exception 'Seating Table is unavailable' using errcode = '23503'; end if;
  select id into v_id from public.seating_assignments
    where event_id = p_event_id and guest_id = p_guest_id for update;
  if found then
    update public.seating_assignments set table_id = p_table_id, seat_id = p_seat_id
      where id = v_id;
  else
    insert into public.seating_assignments(wedding_id, event_id, guest_id, table_id, seat_id)
      values (v_wedding_id, p_event_id, p_guest_id, p_table_id, p_seat_id)
      returning id into v_id;
  end if;
  return v_id;
end;
$function$;

create function public.unseat_guest(p_event_id uuid, p_guest_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.seating_events where id = p_event_id;
  if not found or (select auth.uid()) is null or not private.can_manage_guest_domain(v_wedding_id) then
    raise exception 'Seating management is not permitted' using errcode = '42501';
  end if;
  perform 1 from public.guest_rsvps where wedding_id = v_wedding_id and guest_id = p_guest_id for update;
  delete from public.seating_assignments
    where wedding_id = v_wedding_id and event_id = p_event_id and guest_id = p_guest_id;
end;
$function$;

-- Keep the existing sanitized guide intact and add only the token holder's
-- visible Guest seating. The base implementation moves to an unexposed schema.
alter function public.guest_wedding_guide(text, text) set schema private;
alter function private.guest_wedding_guide(text, text) rename to guest_wedding_guide_base;
revoke execute on function private.guest_wedding_guide_base(text, text)
  from public, anon, authenticated, service_role;
create function public.guest_wedding_guide(p_slug text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_guide jsonb; v_wedding_id uuid; v_household_id uuid; v_seating jsonb;
begin
  v_guide := private.guest_wedding_guide_base(p_slug, p_token);
  if p_token is null then return v_guide; end if;
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
  if v_household_id is null then
    raise exception 'Invalid invitation access' using errcode = '42501';
  end if;
  select jsonb_agg(
    jsonb_build_object('guestId', g.id, 'eventId', e.id, 'eventName', e.name,
      'eventKind', e.event_kind, 'tableName', t.name, 'tableNumber', t.table_number)
    || case when e.visibility = 'TABLE_AND_SEAT' and s.id is not null
      then jsonb_build_object('seatLabel', s.label) else '{}'::jsonb end
    order by e.sort_order, e.id, g.id)
    into v_seating
  from public.guests g
  join public.seating_assignments a on a.wedding_id = g.wedding_id and a.guest_id = g.id
  join public.seating_events e on e.wedding_id = a.wedding_id and e.id = a.event_id
  join public.seating_tables t on t.wedding_id = a.wedding_id and t.event_id = a.event_id and t.id = a.table_id
  left join public.seating_seats s on s.wedding_id = a.wedding_id and s.event_id = a.event_id
    and s.table_id = a.table_id and s.id = a.seat_id
  where g.wedding_id = v_wedding_id and g.household_id = v_household_id
    and e.visibility <> 'HIDDEN';
  if v_seating is null then return v_guide; end if;
  return v_guide || jsonb_build_object('seating', v_seating);
end;
$function$;

revoke execute on function private.validate_seating_assignment(),
  private.validate_seating_table_capacity(), private.unseat_non_attending_guest()
  from public, anon, authenticated, service_role;
revoke execute on function public.create_seating_event(uuid,text,text,integer),
  public.update_seating_event(uuid,text,text,integer),
  public.set_seating_visibility(uuid,public.seating_visibility),
  public.create_seating_table(uuid,text,integer,public.seating_table_shape,integer,text,text,integer),
  public.update_seating_table(uuid,text,integer,public.seating_table_shape,integer,text,text,integer),
  public.delete_seating_table(uuid), public.create_seating_seat(uuid,text,integer),
  public.update_seating_seat(uuid,text,integer), public.delete_seating_seat(uuid),
  public.seat_guest(uuid,uuid,uuid,uuid), public.unseat_guest(uuid,uuid),
  public.guest_wedding_guide(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_seating_event(uuid,text,text,integer),
  public.update_seating_event(uuid,text,text,integer),
  public.set_seating_visibility(uuid,public.seating_visibility),
  public.create_seating_table(uuid,text,integer,public.seating_table_shape,integer,text,text,integer),
  public.update_seating_table(uuid,text,integer,public.seating_table_shape,integer,text,text,integer),
  public.delete_seating_table(uuid), public.create_seating_seat(uuid,text,integer),
  public.update_seating_seat(uuid,text,integer), public.delete_seating_seat(uuid),
  public.seat_guest(uuid,uuid,uuid,uuid), public.unseat_guest(uuid,uuid)
  to authenticated;
grant execute on function public.guest_wedding_guide(text,text) to service_role;

comment on table public.seating_events is
  'Wedding seating contexts; V1 creates a Reception event. Visibility controls only the sanitized Guest Guide.';
comment on table public.seating_tables is
  'Capacity counts all Guest assignments, including assignments without an exact Seat.';
comment on table public.seating_seats is
  'Optional exact Seat labels within a Table; Table-only seating needs no Seat rows.';
comment on table public.seating_assignments is
  'One active assignment per Guest per Seating Event. RSVP changes away from ATTENDING remove assignments.';
comment on function public.seat_guest(uuid,uuid,uuid,uuid) is
  'Atomically assign or move one ATTENDING Guest. An omitted Seat clears the previous exact Seat.';
comment on function public.guest_wedding_guide(text,text) is
  'Sanitized Guest Guide with seating only for Guests in the validated Household and visible Seating Events.';

commit;
