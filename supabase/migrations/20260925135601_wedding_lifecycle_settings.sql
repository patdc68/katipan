begin;

-- Status is the Wedding-level V1 settings contract. Website access, seating
-- visibility, and per-member notification preferences keep their own owners.
alter table public.weddings
  add column archived_from_status public.wedding_status,
  add column deletion_requested_at timestamptz,
  add column deletion_nonce uuid;

-- Existing DEV data has no archived Weddings, but retain a reproducible path
-- for deployments with rows created through privileged administration.
update public.weddings set archived_from_status = 'DRAFT'
  where status = 'ARCHIVED' and archived_from_status is null;

alter table public.weddings
  add constraint weddings_archive_state_check check (
    (status = 'ARCHIVED' and archived_from_status in ('DRAFT','ACTIVE','COMPLETED'))
    or (status <> 'ARCHIVED' and archived_from_status is null)
  ),
  add constraint weddings_deletion_state_check check (
    (deletion_requested_at is null and deletion_nonce is null)
    or (deletion_requested_at is not null and deletion_nonce is not null and status = 'ARCHIVED')
  );

alter table private.wedding_invitation_secrets enable row level security;

create function private.can_manage_wedding_lifecycle(p_wedding_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select (select auth.uid()) is not null and exists (
    select 1 from public.weddings w
    join public.wedding_memberships m on m.wedding_id = w.id
    where w.id = p_wedding_id and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and ((w.ownership_mode = 'COUPLE_OWNED' and m.role = 'OWNER')
        or (w.ownership_mode = 'COORDINATOR_MANAGED'
          and w.origin = 'COORDINATOR_CREATED'
          and w.created_by_user_id = (select auth.uid())
          and m.role = 'FULL_COORDINATOR'))
  );
$function$;

create function private.wedding_allows_guest_access(p_wedding_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w
    where w.id = p_wedding_id and w.status = 'ACTIVE'
      and w.deletion_requested_at is null);
$function$;

create function private.lock_wedding_lifecycle(p_wedding_id uuid)
returns public.weddings language plpgsql volatile security definer set search_path = '' as $function$
declare v_wedding public.weddings;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  select * into v_wedding from public.weddings where id = p_wedding_id for update;
  if not found or not private.can_manage_wedding_lifecycle(p_wedding_id) then
    raise exception 'Wedding lifecycle management is not permitted' using errcode = '42501';
  end if;
  perform 1 from public.wedding_memberships m
    where m.wedding_id = p_wedding_id and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE' for update;
  return v_wedding;
end;
$function$;

create function public.activate_wedding(p_wedding_id uuid)
returns public.weddings language plpgsql security definer set search_path = '' as $function$
declare v_wedding public.weddings;
begin
  v_wedding := private.lock_wedding_lifecycle(p_wedding_id);
  if v_wedding.deletion_requested_at is not null or v_wedding.status not in ('DRAFT','COMPLETED') then
    raise exception 'Wedding cannot be activated from this state' using errcode = '23514';
  end if;
  if v_wedding.ownership_mode = 'COUPLE_OWNED' and not exists (
    select 1 from public.wedding_memberships m where m.wedding_id = p_wedding_id
      and m.role = 'OWNER' and m.status = 'ACTIVE') then
    raise exception 'An active couple-owned Wedding requires an Owner' using errcode = '23514';
  end if;
  update public.weddings set status = 'ACTIVE' where id = p_wedding_id returning * into v_wedding;
  return v_wedding;
end;
$function$;

create function public.complete_wedding(p_wedding_id uuid)
returns public.weddings language plpgsql security definer set search_path = '' as $function$
declare v_wedding public.weddings;
begin
  v_wedding := private.lock_wedding_lifecycle(p_wedding_id);
  if v_wedding.status <> 'ACTIVE' or v_wedding.deletion_requested_at is not null then
    raise exception 'Only an active Wedding can be completed' using errcode = '23514';
  end if;
  update public.weddings set status = 'COMPLETED' where id = p_wedding_id returning * into v_wedding;
  return v_wedding;
end;
$function$;

create function public.archive_wedding(p_wedding_id uuid)
returns public.weddings language plpgsql security definer set search_path = '' as $function$
declare v_wedding public.weddings;
begin
  v_wedding := private.lock_wedding_lifecycle(p_wedding_id);
  if v_wedding.status = 'ARCHIVED' or v_wedding.deletion_requested_at is not null then
    raise exception 'Wedding is already archived or pending deletion' using errcode = '23514';
  end if;
  update public.weddings set archived_from_status = v_wedding.status, status = 'ARCHIVED'
    where id = p_wedding_id returning * into v_wedding;
  return v_wedding;
end;
$function$;

create function public.restore_wedding(p_wedding_id uuid)
returns public.weddings language plpgsql security definer set search_path = '' as $function$
declare v_wedding public.weddings;
begin
  v_wedding := private.lock_wedding_lifecycle(p_wedding_id);
  if v_wedding.status <> 'ARCHIVED' or v_wedding.deletion_requested_at is not null
    or v_wedding.archived_from_status not in ('DRAFT','ACTIVE','COMPLETED') then
    raise exception 'Wedding cannot be restored' using errcode = '23514';
  end if;
  if v_wedding.archived_from_status = 'ACTIVE'
    and v_wedding.ownership_mode = 'COUPLE_OWNED' and not exists (
      select 1 from public.wedding_memberships m where m.wedding_id = p_wedding_id
        and m.role = 'OWNER' and m.status = 'ACTIVE') then
    raise exception 'An active couple-owned Wedding requires an Owner' using errcode = '23514';
  end if;
  update public.weddings set status = v_wedding.archived_from_status,
    archived_from_status = null where id = p_wedding_id returning * into v_wedding;
  return v_wedding;
end;
$function$;

-- Every non-active status closes guest presentation, RSVP, passes, invitation
-- issuance, and notification production. Existing guest/RSVP rows are untouched.
create function private.cancel_inactive_wedding_notification_delivery()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if old.status = 'ACTIVE' and new.status <> 'ACTIVE' then
    update private.notification_delivery_outbox o
      set status = 'SKIPPED', claim_token = null
      from public.notifications n
      where n.id = o.notification_id and n.wedding_id = new.id
        and o.status in ('PENDING','FAILED','CLAIMED');
  end if;
  return new;
end;
$function$;
create trigger weddings_cancel_inactive_notification_delivery
after update of status on public.weddings for each row
execute function private.cancel_inactive_wedding_notification_delivery();

create or replace function private.require_active_notification_recipient()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.wedding_id is not null and (
    not private.wedding_allows_guest_access(new.wedding_id)
    or not exists (select 1 from public.wedding_memberships m
      where m.wedding_id = new.wedding_id and m.user_id = new.recipient_user_id
        and m.status = 'ACTIVE')
  ) then
    raise exception 'Wedding notification production is unavailable' using errcode = '23514';
  end if;
  return new;
end;
$function$;

create or replace function public.claim_notification_deliveries(p_limit integer default 25)
returns table(outbox_id uuid,claim_token uuid,notification_id uuid,channel public.notification_delivery_channel,
  recipient_user_id uuid,title text,body text)
language plpgsql security definer set search_path = '' as $function$
declare v_row record; v_pref public.wedding_notification_preferences; v_due timestamptz;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Invalid delivery batch limit' using errcode = '22023';
  end if;
  for v_row in
    select o.id,o.notification_id,o.channel,n.wedding_id,n.recipient_user_id,
      n.category,n.title,n.body
    from private.notification_delivery_outbox o
    join public.notifications n on n.id = o.notification_id
    where ((o.status in ('PENDING','FAILED') and o.next_attempt_at <= now())
      or (o.status = 'CLAIMED' and o.claimed_at < now() - interval '5 minutes'))
      and o.attempt_count < 10
    order by o.next_attempt_at,o.id limit p_limit
    for update of o skip locked
  loop
    if v_row.wedding_id is not null then
      select * into v_pref from public.wedding_notification_preferences p
        where p.wedding_id = v_row.wedding_id and p.user_id = v_row.recipient_user_id;
      if not private.wedding_allows_guest_access(v_row.wedding_id)
        or not exists (select 1 from public.wedding_memberships m
          where m.wedding_id = v_row.wedding_id and m.user_id = v_row.recipient_user_id
            and m.status = 'ACTIVE')
        or v_pref is null or not v_pref.notifications_enabled
        or (v_row.channel = 'EMAIL' and not v_pref.email_enabled)
        or (v_row.channel = 'PUSH' and not v_pref.push_enabled)
        or exists (select 1 from public.wedding_notification_category_preferences c
          where c.wedding_id = v_row.wedding_id and c.user_id = v_row.recipient_user_id
            and c.category = v_row.category and not c.enabled) then
        update private.notification_delivery_outbox o set status = 'SKIPPED', claim_token = null
          where o.id = v_row.id;
        continue;
      end if;
      v_due := private.notification_next_delivery_at(now(),v_pref.timezone,
        v_pref.quiet_hours_enabled,v_pref.quiet_hours_start,v_pref.quiet_hours_end);
      if v_due > now() then
        update private.notification_delivery_outbox o set next_attempt_at = v_due
          where o.id = v_row.id;
        continue;
      end if;
    end if;
    update private.notification_delivery_outbox o
      set status = 'CLAIMED',claimed_at = now(),claim_token = gen_random_uuid(),
        attempt_count = attempt_count + 1
      where o.id = v_row.id;
    outbox_id := v_row.id;
    select o.claim_token into claim_token from private.notification_delivery_outbox o
      where o.id = v_row.id;
    notification_id := v_row.notification_id;
    channel := v_row.channel;
    recipient_user_id := v_row.recipient_user_id;
    title := v_row.title;
    body := v_row.body;
    return next;
  end loop;
end;
$function$;

create function private.guard_wedding_invitation_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.status in ('PENDING','ACCEPTED') then
    perform 1 from public.weddings w where w.id = new.wedding_id
      and w.status in ('DRAFT','ACTIVE') and w.deletion_requested_at is null
      for share;
    if not found then
      raise exception 'Wedding invitations are unavailable in this state' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;
create trigger wedding_invitations_lifecycle_guard
before insert or update of status on public.wedding_invitations
for each row execute function private.guard_wedding_invitation_lifecycle();

create or replace function public.publish_wedding_website(p_wedding_id uuid, p_publish boolean)
returns public.wedding_websites language plpgsql security definer set search_path = '' as $function$
declare v_result public.wedding_websites;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.weddings where id = p_wedding_id for update;
  if not found or not private.can_manage_wedding_website(p_wedding_id) then
    raise exception 'Website management is not permitted' using errcode = '42501';
  end if;
  if p_publish is null then raise exception 'Publication choice is required' using errcode = '22023'; end if;
  if p_publish and not private.wedding_allows_guest_access(p_wedding_id) then
    raise exception 'Only an active Wedding may publish a website' using errcode = '23514';
  end if;
  update public.wedding_websites set is_published = p_publish,
    published_at = case when p_publish then coalesce(published_at, now()) else published_at end
    where wedding_id = p_wedding_id returning * into v_result;
  if not found then raise exception 'Website configuration does not exist' using errcode = 'P0002'; end if;
  return v_result;
end;
$function$;

create or replace function public.issue_household_website_token(p_household_id uuid, p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_token text;
begin
  select wedding_id into v_wedding_id from public.guest_households where id = p_household_id;
  if not found or (select auth.uid()) is null then
    raise exception 'Invitation access management is not permitted' using errcode = '42501';
  end if;
  perform 1 from public.weddings where id = v_wedding_id for update;
  if not private.can_manage_wedding_website(v_wedding_id) then
    raise exception 'Invitation access management is not permitted' using errcode = '42501';
  end if;
  if not private.wedding_allows_guest_access(v_wedding_id) then
    raise exception 'Invitation issuance requires an active Wedding' using errcode = '23514';
  end if;
  perform 1 from public.guest_households where id = p_household_id and wedding_id = v_wedding_id for update;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future' using errcode = '22023';
  end if;
  update private.household_website_tokens set revoked_at = now()
    where wedding_id = v_wedding_id and household_id = p_household_id and revoked_at is null;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.household_website_tokens(wedding_id,household_id,token_hash,expires_at)
    values(v_wedding_id,p_household_id,extensions.digest(v_token,'sha256'),p_expires_at);
  return v_token;
end;
$function$;

create or replace function private.valid_household_website_token(p_wedding_id uuid, p_token text)
returns uuid language sql stable security definer set search_path = '' as $function$
  select t.household_id from private.household_website_tokens t
  where private.wedding_allows_guest_access(p_wedding_id)
    and p_token ~ '^[0-9a-f]{64}$' and t.wedding_id = p_wedding_id
    and t.token_hash = extensions.digest(p_token,'sha256')
    and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
  limit 1;
$function$;

create or replace function public.guest_wedding_guide(p_slug text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_guide jsonb; v_wedding_id uuid; v_household_id uuid; v_passes jsonb;
begin
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  if not found or not private.wedding_allows_guest_access(v_wedding_id) then
    raise exception 'Guide unavailable' using errcode = 'P0002';
  end if;
  v_guide := private.guest_wedding_guide_seating_base(p_slug, p_token);
  if p_token is null then return v_guide; end if;
  v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
  if v_household_id is null then raise exception 'Invalid invitation access' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'guestId', g.id, 'reference', gp.reference, 'qrPayload', gp.qr_token,
    'seating', coalesce((select jsonb_agg(s.value)
      from jsonb_array_elements(coalesce(v_guide->'seating', '[]'::jsonb)) s(value)
      where s.value->>'guestId' = g.id::text), '[]'::jsonb))
    order by g.id), '[]'::jsonb) into v_passes
  from public.guests g
  join public.guest_rsvps r on r.wedding_id = g.wedding_id and r.guest_id = g.id
  join private.guest_passes gp on gp.wedding_id = g.wedding_id and gp.guest_id = g.id
    and gp.revoked_at is null
  where g.wedding_id = v_wedding_id and g.household_id = v_household_id
    and r.status = 'ATTENDING';
  return v_guide || jsonb_build_object('guestPasses', v_passes);
end;
$function$;

create or replace function public.guest_submit_rsvp(p_slug text, p_token text, p_guest_id uuid,
  p_status public.guest_rsvp_status, p_meal_choice text default null,
  p_dietary_notes text default null, p_response_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_household_id uuid; v_previous public.guest_rsvps;
begin
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  if not found then raise exception 'Guide unavailable' using errcode = 'P0002'; end if;
  perform 1 from public.weddings where id = v_wedding_id for share;
  if not private.wedding_allows_guest_access(v_wedding_id) then
    raise exception 'Guide unavailable' using errcode = 'P0002';
  end if;
  v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
  if v_household_id is null then raise exception 'Invalid invitation access' using errcode = '42501'; end if;
  select r.* into v_previous from public.guest_rsvps r
    join public.guests g on g.wedding_id = r.wedding_id and g.id = r.guest_id
    where r.wedding_id = v_wedding_id and r.guest_id = p_guest_id
      and g.household_id = v_household_id for update of r;
  if not found then raise exception 'Guest is not in this Household' using errcode = '42501'; end if;
  update public.guest_rsvps set status = p_status,
    meal_choice = nullif(btrim(p_meal_choice), ''), dietary_notes = nullif(btrim(p_dietary_notes), ''),
    response_notes = nullif(btrim(p_response_notes), ''),
    responded_at = case when p_status = 'NO_RESPONSE' then null
      when v_previous.status = p_status then coalesce(v_previous.responded_at, now()) else now() end
    where wedding_id = v_wedding_id and guest_id = p_guest_id;
  return jsonb_build_object('guestId', p_guest_id, 'status', p_status);
end;
$function$;

-- Storage bytes are deleted through the Storage API. A trigger serializes a
-- late upload with the Wedding deletion lock so it cannot create an orphan.
create function private.guard_wedding_storage_write()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_id uuid; v_requested timestamptz;
begin
  if new.bucket_id <> 'wedding-files' or new.name !~
    '^weddings/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
    return new;
  end if;
  v_id := pg_catalog.split_part(new.name,'/',2)::uuid;
  select deletion_requested_at into v_requested from public.weddings
    where id = v_id for share;
  if not found or v_requested is not null then
    raise exception 'Wedding Storage writes are unavailable' using errcode = '23514';
  end if;
  return new;
end;
$function$;
create trigger wedding_storage_write_guard
before insert or update of bucket_id, name on storage.objects
for each row execute function private.guard_wedding_storage_write();

create function public.request_wedding_deletion(p_wedding_id uuid, p_confirm_name text)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_wedding public.weddings; v_nonce uuid;
begin
  v_wedding := private.lock_wedding_lifecycle(p_wedding_id);
  if p_confirm_name is distinct from v_wedding.display_name or v_wedding.display_name is null then
    raise exception 'Wedding name confirmation does not match' using errcode = '22023';
  end if;
  if v_wedding.deletion_requested_at is not null then return v_wedding.deletion_nonce; end if;
  v_nonce := gen_random_uuid();
  update public.weddings set archived_from_status = case when status = 'ARCHIVED'
      then archived_from_status else status end,
    status = 'ARCHIVED', deletion_requested_at = now(), deletion_nonce = v_nonce
    where id = p_wedding_id;
  return v_nonce;
end;
$function$;

create function public.list_wedding_deletion_objects(p_wedding_id uuid, p_nonce uuid)
returns table(object_path text) language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  perform 1 from public.weddings w where w.id = p_wedding_id
    and w.deletion_requested_at is not null and w.deletion_nonce = p_nonce;
  if not found then raise exception 'Wedding deletion request unavailable' using errcode = '42501'; end if;
  return query select o.name from storage.objects o
    where o.bucket_id = 'wedding-files'
      and (o.name like 'weddings/' || p_wedding_id::text || '/%'
        or exists (select 1 from public.attachments a
          where a.wedding_id = p_wedding_id and a.bucket_id = o.bucket_id
            and a.object_path = o.name))
    order by o.name limit 500;
end;
$function$;

-- Check-in rows are immutable during ordinary operation; a pending Wedding
-- deletion is the one explicit exception for cascading removal of its history.
create or replace function private.reject_check_in_event_change()
returns trigger language plpgsql set search_path = '' as $function$
begin
  if tg_op = 'DELETE' and exists (select 1 from public.weddings w
    where w.id = old.wedding_id and w.deletion_requested_at is not null) then
    return old;
  end if;
  raise exception 'Check-in history is append-only' using errcode = '42501';
end;
$function$;

create function public.finalize_wedding_deletion(p_wedding_id uuid, p_nonce uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  perform 1 from public.weddings w where w.id = p_wedding_id
    and w.status = 'ARCHIVED' and w.deletion_requested_at is not null
    and w.deletion_nonce = p_nonce for update;
  if not found then raise exception 'Wedding deletion request unavailable' using errcode = '42501'; end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'wedding-files'
    and (o.name like 'weddings/' || p_wedding_id::text || '/%'
      or exists (select 1 from public.attachments a
        where a.wedding_id = p_wedding_id and a.bucket_id = o.bucket_id
          and a.object_path = o.name))) then
    raise exception 'Wedding Storage objects remain' using errcode = '23514';
  end if;
  delete from public.notifications where wedding_id = p_wedding_id;
  delete from public.guest_check_in_events where wedding_id = p_wedding_id;
  delete from public.wedding_day_items where wedding_id = p_wedding_id;
  delete from public.weddings where id = p_wedding_id;
  return true;
end;
$function$;

-- Account deletion is a separate, narrowly scoped workflow. It detaches
-- access without deleting any Wedding. Auth Admin then soft-deletes the user.
create function public.prepare_self_account_deletion()
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_user_id uuid := (select auth.uid()); v_wedding record;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  for v_wedding in
    select w.id, w.ownership_mode, w.created_by_user_id, m.role, m.id as membership_id
    from public.weddings w join public.wedding_memberships m on m.wedding_id = w.id
    where m.user_id = v_user_id and m.status = 'ACTIVE'
    order by w.id for update of w, m
  loop
    if v_wedding.ownership_mode = 'COORDINATOR_MANAGED'
      and v_wedding.created_by_user_id = v_user_id then
      raise exception 'Transfer coordinator control before deleting the account' using errcode = '23514';
    end if;
    if v_wedding.role = 'OWNER' and not exists (
      select 1 from public.wedding_memberships m
      where m.wedding_id = v_wedding.id and m.id <> v_wedding.membership_id
        and m.role = 'OWNER' and m.status = 'ACTIVE') then
      raise exception 'The final Owner cannot delete the account' using errcode = '23514';
    end if;
  end loop;
  update public.wedding_memberships set status = 'LEFT', ended_at = now()
    where user_id = v_user_id and status = 'ACTIVE';
  update public.wedding_people set linked_user_id = null where linked_user_id = v_user_id;
  delete from public.notifications where recipient_user_id = v_user_id;
  delete from public.wedding_notification_preferences where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  return true;
end;
$function$;

-- A soft-deleted Auth row remains for FK history. Its still-valid access JWT
-- must not establish a fresh Wedding or active membership before expiry.
create function private.guard_deleted_account_wedding_access()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_user_id uuid;
begin
  if tg_table_name = 'weddings' then
    v_user_id := new.created_by_user_id;
  elsif new.status = 'ACTIVE' then
    v_user_id := new.user_id;
  else
    return new;
  end if;
  if v_user_id is not null and exists (
    select 1 from auth.users u where u.id = v_user_id and u.deleted_at is not null
  ) then
    raise exception 'Deleted accounts cannot join or create Weddings' using errcode = '42501';
  end if;
  return new;
end;
$function$;
create trigger weddings_reject_deleted_creator
before insert on public.weddings for each row
execute function private.guard_deleted_account_wedding_access();
create trigger wedding_memberships_reject_deleted_user
before insert or update of user_id, status on public.wedding_memberships for each row
execute function private.guard_deleted_account_wedding_access();

create function private.guard_auth_user_deletion()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'UPDATE' and (old.deleted_at is not null or new.deleted_at is null) then
    return new;
  end if;
  perform 1 from public.weddings w
    join public.wedding_memberships m on m.wedding_id = w.id
    where m.user_id = old.id and m.status = 'ACTIVE'
    for update of w, m;
  if found then
    raise exception 'Leave or transfer Wedding membership before account deletion' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
create trigger auth_users_guard_soft_delete
before update of deleted_at on auth.users for each row
execute function private.guard_auth_user_deletion();
create trigger auth_users_guard_hard_delete
before delete on auth.users for each row
execute function private.guard_auth_user_deletion();

revoke execute on function private.can_manage_wedding_lifecycle(uuid),
  private.wedding_allows_guest_access(uuid), private.lock_wedding_lifecycle(uuid),
  private.cancel_inactive_wedding_notification_delivery(),
  private.guard_wedding_invitation_lifecycle(),
  private.guard_wedding_storage_write(),
  private.guard_deleted_account_wedding_access(), private.guard_auth_user_deletion(),
  public.activate_wedding(uuid), public.complete_wedding(uuid),
  public.archive_wedding(uuid), public.restore_wedding(uuid),
  public.request_wedding_deletion(uuid,text),
  public.list_wedding_deletion_objects(uuid,uuid),
  public.finalize_wedding_deletion(uuid,uuid),
  public.prepare_self_account_deletion()
  from public, anon, authenticated, service_role;
grant execute on function public.activate_wedding(uuid), public.complete_wedding(uuid),
  public.archive_wedding(uuid), public.restore_wedding(uuid),
  public.request_wedding_deletion(uuid,text), public.prepare_self_account_deletion()
  to authenticated;
grant execute on function public.list_wedding_deletion_objects(uuid,uuid),
  public.finalize_wedding_deletion(uuid,uuid) to service_role;

comment on function public.archive_wedding(uuid) is
  'Owner or coordinator-managed creator only. Locks the Wedding and preserves its prior operational status for restoration.';
comment on function public.request_wedding_deletion(uuid,text) is
  'Owner or coordinator-managed creator only. Locks and seals a Wedding for Storage API cleanup; never deletes an Auth User.';
comment on function public.finalize_wedding_deletion(uuid,uuid) is
  'Service-only final deletion after Storage API cleanup. Deletes Wedding-owned rows and preserves Auth Users.';
comment on function public.prepare_self_account_deletion() is
  'Caller-only account deletion preparation. Locks membership Weddings and preserves final Owner and coordinator controller safeguards.';

commit;
