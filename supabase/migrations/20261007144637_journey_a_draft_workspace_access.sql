begin;

-- Owners and the managing coordinator can prepare individual Guest Passes while
-- a Wedding is a draft. Guest-facing lookup still requires an active Wedding.
create or replace function private.can_manage_guest_pass(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w where w.id = p_wedding_id
      and w.status in ('DRAFT', 'ACTIVE') and w.deletion_requested_at is null)
    and (private.has_active_wedding_role(p_wedding_id,
      array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id));
$function$;

-- Run of Show is planning data and can be prepared before activation. Check-in
-- authorization remains tied to ACTIVE Weddings through can_manage_wedding_day.
create function private.can_manage_run_of_show(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select exists (select 1 from public.weddings w where w.id = p_wedding_id
      and w.status in ('DRAFT', 'ACTIVE') and w.deletion_requested_at is null)
    and (private.has_active_wedding_role(p_wedding_id,
      array['OWNER', 'FULL_COORDINATOR', 'DAY_OF_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id));
$function$;

drop policy wedding_day_items_insert_manager on public.wedding_day_items;
create policy wedding_day_items_insert_manager on public.wedding_day_items
  for insert to authenticated with check ((select private.can_manage_run_of_show(wedding_id)));
drop policy wedding_day_items_update_manager on public.wedding_day_items;
create policy wedding_day_items_update_manager on public.wedding_day_items
  for update to authenticated using ((select private.can_manage_run_of_show(wedding_id)))
  with check ((select private.can_manage_run_of_show(wedding_id)));
drop policy wedding_day_items_delete_manager on public.wedding_day_items;
create policy wedding_day_items_delete_manager on public.wedding_day_items
  for delete to authenticated using ((select private.can_manage_run_of_show(wedding_id)));
drop policy wedding_day_item_memberships_insert_manager on public.wedding_day_item_memberships;
create policy wedding_day_item_memberships_insert_manager on public.wedding_day_item_memberships
  for insert to authenticated with check ((select private.can_manage_run_of_show(wedding_id)));
drop policy wedding_day_item_memberships_delete_manager on public.wedding_day_item_memberships;
create policy wedding_day_item_memberships_delete_manager on public.wedding_day_item_memberships
  for delete to authenticated using ((select private.can_manage_run_of_show(wedding_id)));

revoke execute on function private.can_manage_run_of_show(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_manage_run_of_show(uuid) to authenticated;

-- A deliberate Publish confirmation on a draft Wedding activates it in the
-- same transaction, but only for a member who can manage its lifecycle.
create or replace function public.publish_wedding_website(p_wedding_id uuid, p_publish boolean)
returns public.wedding_websites language plpgsql security definer set search_path = '' as $function$
declare v_result public.wedding_websites; v_status public.wedding_status; v_deletion_requested_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select status, deletion_requested_at into v_status, v_deletion_requested_at
    from public.weddings where id = p_wedding_id for update;
  if not found or not private.can_manage_wedding_website(p_wedding_id) then
    raise exception 'Website management is not permitted' using errcode = '42501';
  end if;
  if p_publish is null then raise exception 'Publication choice is required' using errcode = '22023'; end if;
  if p_publish and v_status = 'DRAFT' and v_deletion_requested_at is null then
    if not private.can_manage_wedding_lifecycle(p_wedding_id) then
      raise exception 'Wedding lifecycle management is not permitted' using errcode = '42501';
    end if;
    update public.weddings set status = 'ACTIVE' where id = p_wedding_id;
  end if;
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

comment on function private.can_manage_run_of_show(uuid) is
  'Allows active operational Wedding members to prepare Run-of-Show items while a Wedding is DRAFT or ACTIVE; check-in remains ACTIVE-only.';
comment on function public.publish_wedding_website(uuid, boolean) is
  'Publishes only for a Wedding with guest access. Publishing a DRAFT Wedding atomically activates it for a member authorized to manage that lifecycle.';

commit;
