begin;

create type public.website_template as enum ('SAMPAGUITA', 'LUNTIAN', 'FILIPINIANA', 'MODERN_LOVE', 'AFTER_DARK');
create type public.website_access_mode as enum ('ANYONE_WITH_LINK', 'INVITED_GUESTS_ONLY');
create type public.website_section_audience as enum ('PUBLIC', 'INVITED', 'PERSONALIZED', 'HIDDEN');
create type public.website_section_type as enum ('INTRO', 'PLACES', 'DRESS_CODE', 'RSVP', 'CUSTOM');

create table public.wedding_websites (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  slug text not null unique,
  template_key public.website_template not null default 'SAMPAGUITA',
  is_published boolean not null default false,
  published_at timestamptz,
  access_mode public.website_access_mode not null default 'INVITED_GUESTS_ONLY',
  title text,
  introduction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_websites_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80),
  constraint wedding_websites_title_check check (title is null or (title = btrim(title) and title <> '')),
  constraint wedding_websites_published_at_check check (not is_published or published_at is not null)
);

create table public.wedding_website_sections (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.wedding_websites(wedding_id) on delete cascade,
  section_key text not null,
  section_type public.website_section_type not null,
  sort_order integer not null default 0,
  audience public.website_section_audience not null default 'HIDDEN',
  enabled boolean not null default false,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_website_sections_wedding_key_key unique (wedding_id, section_key),
  constraint wedding_website_sections_key_check check (section_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint wedding_website_sections_sort_check check (sort_order >= 0),
  constraint wedding_website_sections_content_check check (content is null or section_type in ('INTRO', 'CUSTOM'))
);

create index wedding_website_sections_order_idx on public.wedding_website_sections(wedding_id, sort_order, id);

create table private.household_website_tokens (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  household_id uuid not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint household_website_tokens_household_fk foreign key (wedding_id, household_id)
    references public.guest_households(wedding_id, id) on delete cascade,
  constraint household_website_tokens_expiry_check check (expires_at is null or expires_at > created_at)
);
create unique index household_website_tokens_active_household_idx
  on private.household_website_tokens(wedding_id, household_id) where revoked_at is null;
create index household_website_tokens_household_idx on private.household_website_tokens(wedding_id, household_id);

create trigger wedding_websites_updated_at before update on public.wedding_websites
  for each row execute function private.set_updated_at();
create trigger wedding_website_sections_updated_at before update on public.wedding_website_sections
  for each row execute function private.set_updated_at();

create function private.can_manage_wedding_website(p_wedding_id uuid) returns boolean
language sql stable security definer set search_path = '' as $function$
  select private.has_active_wedding_role(p_wedding_id, array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[])
      or private.controls_coordinator_managed_wedding(p_wedding_id);
$function$;

alter table public.wedding_websites enable row level security;
alter table public.wedding_website_sections enable row level security;
alter table private.household_website_tokens enable row level security;

create policy wedding_websites_read_member on public.wedding_websites for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
create policy wedding_websites_insert_manager on public.wedding_websites for insert to authenticated
  with check ((select private.can_manage_wedding_website(wedding_id)));
create policy wedding_websites_update_manager on public.wedding_websites for update to authenticated
  using ((select private.can_manage_wedding_website(wedding_id)))
  with check ((select private.can_manage_wedding_website(wedding_id)));
create policy wedding_website_sections_read_member on public.wedding_website_sections for select to authenticated
  using ((select private.has_active_wedding_membership(wedding_id)));
create policy wedding_website_sections_insert_manager on public.wedding_website_sections for insert to authenticated
  with check ((select private.can_manage_wedding_website(wedding_id)));
create policy wedding_website_sections_update_manager on public.wedding_website_sections for update to authenticated
  using ((select private.can_manage_wedding_website(wedding_id)))
  with check ((select private.can_manage_wedding_website(wedding_id)));
create policy wedding_website_sections_delete_manager on public.wedding_website_sections for delete to authenticated
  using ((select private.can_manage_wedding_website(wedding_id)));

revoke all on public.wedding_websites, public.wedding_website_sections from public, anon, authenticated;
grant select on public.wedding_websites, public.wedding_website_sections to authenticated;
grant insert (wedding_id, slug, template_key, access_mode, title, introduction)
  on public.wedding_websites to authenticated;
grant update (slug, template_key, access_mode, title, introduction)
  on public.wedding_websites to authenticated;
grant insert (wedding_id, section_key, section_type, sort_order, audience, enabled, content)
  on public.wedding_website_sections to authenticated;
grant update (section_key, section_type, sort_order, audience, enabled, content)
  on public.wedding_website_sections to authenticated;
grant delete on public.wedding_website_sections to authenticated;
revoke all on private.household_website_tokens from public, anon, authenticated;

create function public.publish_wedding_website(p_wedding_id uuid, p_publish boolean)
returns public.wedding_websites language plpgsql security definer set search_path = '' as $function$
declare v_result public.wedding_websites;
begin
  if (select auth.uid()) is null or not private.can_manage_wedding_website(p_wedding_id) then
    raise exception 'Website management is not permitted' using errcode = '42501';
  end if;
  update public.wedding_websites set is_published = p_publish,
    published_at = case when p_publish then coalesce(published_at, now()) else published_at end
    where wedding_id = p_wedding_id returning * into v_result;
  if not found then raise exception 'Website configuration does not exist' using errcode = 'P0002'; end if;
  return v_result;
end;
$function$;

create function public.issue_household_website_token(p_household_id uuid, p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_token text;
begin
  select wedding_id into v_wedding_id from public.guest_households where id = p_household_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_wedding_website(v_wedding_id) then
    raise exception 'Invitation access management is not permitted' using errcode = '42501';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future' using errcode = '22023';
  end if;
  update private.household_website_tokens set revoked_at = now()
    where wedding_id = v_wedding_id and household_id = p_household_id and revoked_at is null;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.household_website_tokens(wedding_id, household_id, token_hash, expires_at)
    values (v_wedding_id, p_household_id, extensions.digest(v_token, 'sha256'), p_expires_at);
  return v_token;
end;
$function$;

create function public.revoke_household_website_token(p_household_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid;
begin
  select wedding_id into v_wedding_id from public.guest_households where id = p_household_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_wedding_website(v_wedding_id) then
    raise exception 'Invitation access management is not permitted' using errcode = '42501';
  end if;
  update private.household_website_tokens set revoked_at = now()
    where wedding_id = v_wedding_id and household_id = p_household_id and revoked_at is null;
end;
$function$;

create function private.valid_household_website_token(p_wedding_id uuid, p_token text)
returns uuid language sql stable security definer set search_path = '' as $function$
  select t.household_id from private.household_website_tokens t
  where p_token ~ '^[0-9a-f]{64}$'
    and t.wedding_id = p_wedding_id
    and t.token_hash = extensions.digest(p_token, 'sha256')
    and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
  limit 1;
$function$;

create function public.guest_wedding_guide(p_slug text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_site public.wedding_websites; v_household_id uuid; v_wedding jsonb; v_sections jsonb;
begin
  select * into v_site from public.wedding_websites where slug = p_slug and is_published;
  if not found then raise exception 'Guide unavailable' using errcode = 'P0002'; end if;
  if p_token is not null then
    v_household_id := private.valid_household_website_token(v_site.wedding_id, p_token);
    if v_household_id is null then raise exception 'Invalid invitation access' using errcode = '42501'; end if;
  elsif v_site.access_mode = 'INVITED_GUESTS_ONLY' then
    raise exception 'Invitation access required' using errcode = '42501';
  end if;
  select jsonb_build_object('name', w.display_name, 'date', w.wedding_date,
      'timezone', w.timezone, 'location', w.general_location,
      'partners', coalesce((select jsonb_agg(p.display_name order by wp.partner_order)
        from public.wedding_partners wp join public.wedding_people p
          on p.wedding_id = wp.wedding_id and p.id = wp.person_id
        where wp.wedding_id = w.id), '[]'::jsonb)) into v_wedding
    from public.weddings w where w.id = v_site.wedding_id and w.status <> 'ARCHIVED';
  if v_wedding is null then raise exception 'Guide unavailable' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('key', s.section_key, 'type', s.section_type,
      'audience', s.audience, 'content', case when s.section_type in ('INTRO','CUSTOM') then coalesce(s.content, case when s.section_type = 'INTRO' then v_site.introduction end) end,
      'data', case
        when s.section_type = 'PLACES' then coalesce((select jsonb_agg(jsonb_build_object(
          'purpose', pp.purpose, 'label', pp.purpose_label, 'name', coalesce(pl.user_label, pl.custom_name),
          'address', pl.custom_address, 'googlePlaceId', pl.google_place_id,
          'placeType', pl.place_type, 'notes', coalesce(pp.guest_notes, pl.guest_notes))
          order by pp.sort_order, pl.id) from public.wedding_place_purposes pp
          join public.wedding_places pl on pl.wedding_id = pp.wedding_id and pl.id = pp.place_id
          where pp.wedding_id = v_site.wedding_id and pp.guest_visible and pl.archived_at is null), '[]'::jsonb)
        when s.section_type = 'DRESS_CODE' then (select jsonb_build_object(
          'title', dc.title, 'description', dc.description, 'venueAdvice', dc.venue_advice,
          'generalNotes', dc.general_notes,
          'attireGroups', coalesce((select jsonb_agg(jsonb_build_object('title', ag.title,
            'description', ag.description, 'instructions', ag.instructions, 'guestId', g.id)
            order by ag.sort_order, ag.id)
            from public.attire_groups ag
            join public.guests g on g.wedding_id = ag.wedding_id and g.household_id = v_household_id
            where ag.wedding_id = v_site.wedding_id and (
              exists (select 1 from public.attire_group_guest_targets gt
                where gt.wedding_id = ag.wedding_id and gt.attire_group_id = ag.id and gt.guest_id = g.id)
              or exists (select 1 from public.attire_group_entourage_role_targets rt
                join public.entourage_assignments ea on ea.wedding_id = rt.wedding_id and ea.role_id = rt.entourage_role_id
                where rt.wedding_id = ag.wedding_id and rt.attire_group_id = ag.id and ea.guest_id = g.id)
            )), '[]'::jsonb))
          from public.wedding_dress_codes dc where dc.wedding_id = v_site.wedding_id)
        when s.section_type = 'RSVP' and v_household_id is not null then
          coalesce((select jsonb_agg(jsonb_build_object('guestId', g.id, 'name', p.display_name,
            'status', r.status, 'mealChoice', r.meal_choice, 'dietaryNotes', r.dietary_notes,
            'responseNotes', r.response_notes) order by p.display_name, g.id)
            from public.guests g join public.wedding_people p on p.wedding_id = g.wedding_id and p.id = g.person_id
            join public.guest_rsvps r on r.wedding_id = g.wedding_id and r.guest_id = g.id
            where g.wedding_id = v_site.wedding_id and g.household_id = v_household_id), '[]'::jsonb)
        else null end) order by s.sort_order, s.id), '[]'::jsonb) into v_sections
    from public.wedding_website_sections s
    where s.wedding_id = v_site.wedding_id and s.enabled
      and (s.audience = 'PUBLIC' or (v_household_id is not null and s.audience in ('INVITED','PERSONALIZED')))
      and not (s.section_type = 'RSVP' and v_household_id is null);
  return jsonb_build_object('slug', v_site.slug, 'template', v_site.template_key,
    'title', v_site.title, 'wedding', v_wedding, 'sections', v_sections);
end;
$function$;

create function public.guest_submit_rsvp(p_slug text, p_token text, p_guest_id uuid,
  p_status public.guest_rsvp_status, p_meal_choice text default null,
  p_dietary_notes text default null, p_response_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_wedding_id uuid; v_household_id uuid; v_previous public.guest_rsvps;
begin
  select wedding_id into v_wedding_id from public.wedding_websites
    where slug = p_slug and is_published;
  if not found then raise exception 'Guide unavailable' using errcode = 'P0002'; end if;
  v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
  if v_household_id is null then raise exception 'Invalid invitation access' using errcode = '42501'; end if;
  select r.* into v_previous from public.guest_rsvps r
    join public.guests g on g.wedding_id = r.wedding_id and g.id = r.guest_id
    where r.wedding_id = v_wedding_id and r.guest_id = p_guest_id and g.household_id = v_household_id for update of r;
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

revoke execute on function private.can_manage_wedding_website(uuid), private.valid_household_website_token(uuid,text),
  public.publish_wedding_website(uuid,boolean), public.issue_household_website_token(uuid,timestamptz),
  public.revoke_household_website_token(uuid), public.guest_wedding_guide(text,text),
  public.guest_submit_rsvp(text,text,uuid,public.guest_rsvp_status,text,text,text)
  from public, anon, authenticated;
grant execute on function private.can_manage_wedding_website(uuid) to authenticated;
grant execute on function public.publish_wedding_website(uuid,boolean),
  public.issue_household_website_token(uuid,timestamptz), public.revoke_household_website_token(uuid)
  to authenticated;
grant execute on function public.guest_wedding_guide(text,text),
  public.guest_submit_rsvp(text,text,uuid,public.guest_rsvp_status,text,text,text) to service_role;

commit;
