begin;

-- Guest-facing times are independent of operational Run-of-Show times.
create table public.guest_program_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  operational_item_id uuid,
  title text not null check (btrim(title) <> ''),
  description text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  place_id uuid,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_published boolean not null default false,
  published_at timestamptz,
  review_required boolean not null default false,
  review_requested_at timestamptz,
  review_confirmed_at timestamptz,
  review_confirmed_by_user_id uuid references auth.users(id) on delete set null,
  review_resolution text check (review_resolution in ('KEEP','UPDATE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_program_items_wedding_id_id_key unique (wedding_id,id),
  constraint guest_program_items_operational_same_wedding_fkey
    foreign key (wedding_id,operational_item_id)
    references public.wedding_day_items(wedding_id,id) on delete set null (operational_item_id),
  constraint guest_program_items_place_same_wedding_fkey
    foreign key (wedding_id,place_id) references public.wedding_places(wedding_id,id),
  constraint guest_program_items_schedule_check
    check (scheduled_end is null or scheduled_end >= scheduled_start),
  constraint guest_program_items_review_check check (
    (not review_required or review_requested_at is not null)
    and ((review_confirmed_at is null and review_confirmed_by_user_id is null and review_resolution is null)
      or (review_confirmed_at is not null and review_resolution is not null))
  )
);
create index guest_program_items_order_idx
  on public.guest_program_items(wedding_id,is_published,sort_order,scheduled_start,id);
create index guest_program_items_operational_idx
  on public.guest_program_items(wedding_id,operational_item_id)
  where operational_item_id is not null;
create index guest_program_items_place_idx
  on public.guest_program_items(wedding_id,place_id);
create index guest_program_items_reviewer_idx
  on public.guest_program_items(review_confirmed_by_user_id);
create trigger guest_program_items_updated_at before update on public.guest_program_items
  for each row execute function private.set_updated_at();

create function private.can_manage_guest_program(p_wedding_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
  select (select auth.uid()) is not null and
    (private.has_active_wedding_role(p_wedding_id,
      array['OWNER','FULL_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id))
    and exists (select 1 from public.weddings w where w.id = p_wedding_id
      and w.status in ('DRAFT','ACTIVE') and w.deletion_requested_at is null);
$function$;

-- This trigger also runs when a DAY_OF_COORDINATOR edits the operational item.
-- It changes review metadata only; published guest times remain untouched.
create function private.require_guest_program_review()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if row(old.scheduled_start,old.scheduled_end,old.actual_start,old.actual_end,old.status)
    is distinct from
    row(new.scheduled_start,new.scheduled_end,new.actual_start,new.actual_end,new.status) then
    update public.guest_program_items p
      set review_required = true, review_requested_at = now(),
        review_confirmed_at = null, review_confirmed_by_user_id = null,
        review_resolution = null
      where p.wedding_id = new.wedding_id and p.operational_item_id = new.id;
  end if;
  return new;
end;
$function$;
create trigger wedding_day_items_guest_program_review
  after update of scheduled_start,scheduled_end,actual_start,actual_end,status
  on public.wedding_day_items for each row
  execute function private.require_guest_program_review();

-- All guest-facing time/publication changes go through this explicit boundary.
-- KEEP confirms the review without changing published times.
create function public.set_guest_program_publication(
  p_item_id uuid, p_action text, p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null, p_publish boolean default null
) returns public.guest_program_items language plpgsql security definer
set search_path = '' as $function$
declare v_item public.guest_program_items;
begin
  select * into v_item from public.guest_program_items where id = p_item_id for update;
  if not found then raise exception 'Guest Program item unavailable' using errcode = 'P0002'; end if;
  if not private.can_manage_guest_program(v_item.wedding_id) then
    raise exception 'Guest Program publication is not permitted' using errcode = '42501';
  end if;
  if p_action not in ('KEEP','UPDATE') or p_action is null then
    raise exception 'Invalid review action' using errcode = '22023';
  end if;
  if p_action = 'KEEP' and (not v_item.review_required
    or p_scheduled_start is not null or p_scheduled_end is not null
    or (p_publish is not null and p_publish is distinct from v_item.is_published)) then
    raise exception 'KEEP requires a pending review and unchanged publication' using errcode = '22023';
  end if;
  if p_action = 'UPDATE' and p_scheduled_start is null then
    raise exception 'Guest start time is required' using errcode = '22023';
  end if;
  update public.guest_program_items
    set scheduled_start = case when p_action = 'UPDATE' then p_scheduled_start else scheduled_start end,
      scheduled_end = case when p_action = 'UPDATE' then p_scheduled_end else scheduled_end end,
      is_published = case when p_action = 'UPDATE' then coalesce(p_publish,is_published) else is_published end,
      published_at = case when p_action = 'UPDATE' and coalesce(p_publish,is_published)
        then coalesce(published_at,now()) else published_at end,
      review_required = false,
      review_confirmed_at = case when v_item.review_required then now() else review_confirmed_at end,
      review_confirmed_by_user_id = case when v_item.review_required then (select auth.uid())
        else review_confirmed_by_user_id end,
      review_resolution = case when v_item.review_required then p_action else review_resolution end
    where id = p_item_id returning * into v_item;
  return v_item;
end;
$function$;

alter table public.guest_program_items enable row level security;
create policy guest_program_items_select_member on public.guest_program_items
  for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)));
create policy guest_program_items_insert_manager on public.guest_program_items
  for insert to authenticated with check ((select private.can_manage_guest_program(wedding_id)));
create policy guest_program_items_update_manager on public.guest_program_items
  for update to authenticated using ((select private.can_manage_guest_program(wedding_id)))
  with check ((select private.can_manage_guest_program(wedding_id)));
create policy guest_program_items_delete_manager on public.guest_program_items
  for delete to authenticated using ((select private.can_manage_guest_program(wedding_id)));
revoke all on public.guest_program_items from public,anon,authenticated,service_role;
grant select on public.guest_program_items to authenticated;
grant insert(wedding_id,operational_item_id,title,description,scheduled_start,scheduled_end,place_id,sort_order),
  update(operational_item_id,title,description,place_id,sort_order),delete
  on public.guest_program_items to authenticated;
grant select,insert,update,delete on public.guest_program_items to service_role;
revoke execute on function private.can_manage_guest_program(uuid),
  private.require_guest_program_review(),
  public.set_guest_program_publication(uuid,text,timestamptz,timestamptz,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.set_guest_program_publication(uuid,text,timestamptz,timestamptz,boolean)
  to authenticated;

create function private.guest_attire_colors(p_layer text, p_id uuid, p_avoid boolean)
returns jsonb language sql stable security definer set search_path = '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('hex', c.color_hex, 'name', c.name)
    order by c.sort_order,c.id), '[]'::jsonb)
  from (
    select id,color_hex,name,sort_order from public.dress_code_recommended_colors
      where p_layer = 'GENERAL' and not p_avoid and dress_code_id = p_id
    union all
    select id,color_hex,name,sort_order from public.dress_code_avoid_colors
      where p_layer = 'GENERAL' and p_avoid and dress_code_id = p_id
    union all
    select id,color_hex,name,sort_order from public.attire_group_recommended_colors
      where p_layer = 'GROUP' and not p_avoid and attire_group_id = p_id
    union all
    select id,color_hex,name,sort_order from public.attire_group_avoid_colors
      where p_layer = 'GROUP' and p_avoid and attire_group_id = p_id
    union all
    select id,color_hex,name,sort_order from public.guest_attire_recommended_colors
      where p_layer = 'GUEST' and not p_avoid and guest_attire_guidance_id = p_id
    union all
    select id,color_hex,name,sort_order from public.guest_attire_avoid_colors
      where p_layer = 'GUEST' and p_avoid and guest_attire_guidance_id = p_id
  ) c;
$function$;

create function private.guest_attire_projection(p_wedding_id uuid, p_household_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_dc public.wedding_dress_codes;
  v_guest record;
  v_group public.attire_groups;
  v_guidance public.guest_attire_guidance;
  v_result jsonb := '[]'::jsonb;
  v_general_recommended jsonb;
  v_general_avoid jsonb;
  v_group_recommended jsonb;
  v_group_avoid jsonb;
  v_guest_recommended jsonb;
  v_guest_avoid jsonb;
  v_groups jsonb;
  v_roles jsonb;
begin
  if p_household_id is null then return '[]'::jsonb; end if;
  select * into v_dc from public.wedding_dress_codes where wedding_id = p_wedding_id;
  if not found then return '[]'::jsonb; end if;
  v_general_recommended := private.guest_attire_colors('GENERAL',v_dc.id,false);
  v_general_avoid := private.guest_attire_colors('GENERAL',v_dc.id,true);
  for v_guest in select g.id from public.guests g
    where g.wedding_id = p_wedding_id and g.household_id = p_household_id order by g.id
  loop
    select * into v_guidance from public.guest_attire_guidance
      where wedding_id = p_wedding_id and guest_id = v_guest.id;
    select ag.* into v_group from public.attire_groups ag
      where ag.wedding_id = p_wedding_id and ag.dress_code_id = v_dc.id
        and (exists (select 1 from public.attire_group_guest_targets gt
          where gt.wedding_id = p_wedding_id and gt.attire_group_id = ag.id
            and gt.guest_id = v_guest.id)
          or exists (select 1 from public.attire_group_entourage_role_targets rt
            join public.entourage_assignments ea on ea.wedding_id = rt.wedding_id
              and ea.role_id = rt.entourage_role_id
            where rt.wedding_id = p_wedding_id and rt.attire_group_id = ag.id
              and ea.guest_id = v_guest.id))
      order by ag.sort_order,ag.id limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('name',er.name,'roleId',er.id)
      order by er.name,er.id),'[]'::jsonb) into v_roles
      from public.entourage_assignments ea
      join public.entourage_roles er on er.wedding_id = ea.wedding_id and er.id = ea.role_id
      where ea.wedding_id = p_wedding_id and ea.guest_id = v_guest.id;
    select coalesce(jsonb_agg(jsonb_build_object('id',ag.id,'title',ag.title,
      'description',ag.description,'instructions',ag.instructions,
      'recommendedColors',private.guest_attire_colors('GROUP',ag.id,false),
      'avoidColors',private.guest_attire_colors('GROUP',ag.id,true))
      order by ag.sort_order,ag.id),'[]'::jsonb) into v_groups
      from public.attire_groups ag
      where ag.wedding_id = p_wedding_id and ag.dress_code_id = v_dc.id
        and (exists (select 1 from public.attire_group_guest_targets gt
          where gt.wedding_id = p_wedding_id and gt.attire_group_id = ag.id
            and gt.guest_id = v_guest.id)
          or exists (select 1 from public.attire_group_entourage_role_targets rt
            join public.entourage_assignments ea on ea.wedding_id = rt.wedding_id
              and ea.role_id = rt.entourage_role_id
            where rt.wedding_id = p_wedding_id and rt.attire_group_id = ag.id
              and ea.guest_id = v_guest.id));
    v_group_recommended := private.guest_attire_colors('GROUP',v_group.id,false);
    v_group_avoid := private.guest_attire_colors('GROUP',v_group.id,true);
    v_guest_recommended := private.guest_attire_colors('GUEST',v_guidance.id,false);
    v_guest_avoid := private.guest_attire_colors('GUEST',v_guidance.id,true);
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'guestId',v_guest.id,'entourageRoles',v_roles,'attireGroups',v_groups,
      'guestGuidance',case when v_guidance.id is null then null else
        jsonb_build_object('title',v_guidance.title,'instructions',v_guidance.instructions,
          'recommendedColors',v_guest_recommended,
          'avoidColors',v_guest_avoid) end,
      'effectiveInstructions',coalesce(v_guidance.instructions,v_group.instructions,
        v_dc.general_notes,v_dc.description),
      'effectiveRecommendedColors',case when jsonb_array_length(v_guest_recommended)>0
        then v_guest_recommended when jsonb_array_length(v_group_recommended)>0
        then v_group_recommended else v_general_recommended end,
      'effectiveAvoidColors',case when jsonb_array_length(v_guest_avoid)>0
        then v_guest_avoid when jsonb_array_length(v_group_avoid)>0
        then v_group_avoid else v_general_avoid end));
  end loop;
  return v_result;
end;
$function$;

create function private.guest_media_descriptors(p_wedding_id uuid, p_household_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('attachmentId',x.attachment_id,
    'source',x.source,'attireGroupId',x.attire_group_id)
    order by x.source,x.sort_order,x.attachment_id),'[]'::jsonb)
  from (
    select l.attachment_id,'DRESS_CODE'::text as source,null::uuid as attire_group_id,
      l.sort_order from public.dress_code_inspiration_attachments l
      join public.wedding_dress_codes dc on dc.wedding_id = l.wedding_id
        and dc.id = l.dress_code_id
      where l.wedding_id = p_wedding_id
    union all
    select l.attachment_id,'MOTIF',null::uuid,l.sort_order
      from public.motif_inspiration_attachments l
      where l.wedding_id = p_wedding_id and p_household_id is not null
    union all
    select l.attachment_id,'ATTIRE_GROUP',l.attire_group_id,l.sort_order
      from public.attire_group_inspiration_attachments l
      join public.attire_groups ag on ag.wedding_id = l.wedding_id
        and ag.id = l.attire_group_id
      where l.wedding_id = p_wedding_id and p_household_id is not null
        and exists (select 1 from public.guests g
          where g.wedding_id = p_wedding_id and g.household_id = p_household_id
            and (exists (select 1 from public.attire_group_guest_targets gt
              where gt.wedding_id = p_wedding_id and gt.attire_group_id = ag.id
                and gt.guest_id = g.id)
            or exists (select 1 from public.attire_group_entourage_role_targets rt
              join public.entourage_assignments ea on ea.wedding_id = rt.wedding_id
                and ea.role_id = rt.entourage_role_id
              where rt.wedding_id = p_wedding_id and rt.attire_group_id = ag.id
                and ea.guest_id = g.id)))
  ) x
  join public.attachments a on a.wedding_id = p_wedding_id and a.id = x.attachment_id
    and a.visibility = 'GUEST_VISIBLE' and a.status = 'AVAILABLE';
$function$;

-- Keep the existing pass/seating projection as the base. This wrapper exposes
-- only published guest items and token-scoped attire, never operational rows.
alter function public.guest_wedding_guide(text,text) set schema private;
alter function private.guest_wedding_guide(text,text) rename to guest_wedding_guide_pass_base;
revoke execute on function private.guest_wedding_guide_pass_base(text,text)
  from public,anon,authenticated,service_role;
create function public.guest_wedding_guide(p_slug text,p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_guide jsonb;
  v_wedding_id uuid;
  v_household_id uuid;
  v_program jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_section jsonb;
  v_dc public.wedding_dress_codes;
  v_data jsonb;
begin
  v_guide := private.guest_wedding_guide_pass_base(p_slug,p_token);
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  if p_token is not null then
    v_household_id := private.valid_household_website_token(v_wedding_id,p_token);
    if v_household_id is null then
      raise exception 'Invalid invitation access' using errcode = '42501';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,
    'scheduledStart',p.scheduled_start,'scheduledEnd',p.scheduled_end,
    'placeId',p.place_id,'placeName',coalesce(pl.user_label,pl.custom_name))
    order by p.sort_order,p.scheduled_start,p.id),'[]'::jsonb)
    into v_program
    from public.guest_program_items p
    left join public.wedding_places pl on pl.wedding_id = p.wedding_id
      and pl.id = p.place_id and pl.archived_at is null
    where p.wedding_id = v_wedding_id and p.is_published;
  select * into v_dc from public.wedding_dress_codes where wedding_id = v_wedding_id;
  for v_section in select value from jsonb_array_elements(v_guide->'sections') loop
    if v_section->>'type' = 'DRESS_CODE' and v_dc.id is not null then
      v_data := coalesce(v_section->'data','{}'::jsonb) ||
        jsonb_build_object(
          'recommendedColors',private.guest_attire_colors('GENERAL',v_dc.id,false),
          'avoidColors',private.guest_attire_colors('GENERAL',v_dc.id,true),
          'guestGuidance',private.guest_attire_projection(v_wedding_id,v_household_id),
          'media',private.guest_media_descriptors(v_wedding_id,v_household_id));
      v_section := jsonb_set(v_section,'{data}',v_data);
    end if;
    v_sections := v_sections || jsonb_build_array(v_section);
  end loop;
  return v_guide || jsonb_build_object('guestProgram',v_program,'sections',v_sections);
end;
$function$;
revoke execute on function public.guest_wedding_guide(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.guest_wedding_guide(text,text) to service_role;

-- The service-only locator never returns a path to the guest. The Edge
-- Function signs the private object for 60 seconds after this check.
create function public.guest_media_locator(p_slug text,p_token text,p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_site public.wedding_websites; v_household_id uuid; v_attachment public.attachments;
begin
  select * into v_site from public.wedding_websites
    where slug = p_slug and is_published;
  if not found or not private.wedding_allows_guest_access(v_site.wedding_id) then
    raise exception 'Media unavailable' using errcode = 'P0002';
  end if;
  if p_token is not null then
    v_household_id := private.valid_household_website_token(v_site.wedding_id,p_token);
    if v_household_id is null then raise exception 'Invalid invitation access' using errcode = '42501'; end if;
  elsif v_site.access_mode <> 'ANYONE_WITH_LINK' then
    raise exception 'Invitation access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.wedding_website_sections s
    where s.wedding_id = v_site.wedding_id and s.section_type = 'DRESS_CODE'
      and s.enabled and (s.audience = 'PUBLIC'
        or (v_household_id is not null and s.audience in ('INVITED','PERSONALIZED')))) then
    raise exception 'Media unavailable' using errcode = 'P0002';
  end if;
  select * into v_attachment from public.attachments a
    where a.id = p_attachment_id and a.wedding_id = v_site.wedding_id
      and a.visibility = 'GUEST_VISIBLE' and a.status = 'AVAILABLE';
  if not found then raise exception 'Media unavailable' using errcode = 'P0002'; end if;
  if not exists (select 1 from jsonb_array_elements(
      private.guest_media_descriptors(v_site.wedding_id,v_household_id)) m
      where m->>'attachmentId' = p_attachment_id::text)
    or (v_household_id is null and not exists (
      select 1 from public.wedding_website_sections s
      where s.wedding_id = v_site.wedding_id and s.section_type = 'DRESS_CODE'
        and s.enabled and s.audience = 'PUBLIC')) then
    raise exception 'Media unavailable' using errcode = 'P0002';
  end if;
  return jsonb_build_object('bucket',v_attachment.bucket_id,'path',v_attachment.object_path);
end;
$function$;
revoke execute on function private.guest_attire_colors(text,uuid,boolean),
  private.guest_attire_projection(uuid,uuid),private.guest_media_descriptors(uuid,uuid),
  public.guest_media_locator(text,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.guest_media_locator(text,text,uuid) to service_role;

commit;
