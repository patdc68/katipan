begin;

create or replace function public.guest_wedding_guide(p_slug text, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_guide jsonb;
  v_wedding_id uuid;
  v_household_id uuid;
  v_passes jsonb;
  v_program jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_section jsonb;
  v_dc public.wedding_dress_codes;
  v_data jsonb;
begin
  v_guide := private.guest_wedding_guide_pass_base(p_slug, p_token);
  select wedding_id into v_wedding_id
  from public.wedding_websites
  where slug = p_slug and is_published;

  if p_token is not null then
    v_household_id := private.valid_household_website_token(v_wedding_id, p_token);
    if v_household_id is null then
      raise exception 'Invalid invitation access' using errcode = '42501';
    end if;

    select coalesce(
      jsonb_agg(
        pass_entry.value || jsonb_build_object('name', person.display_name)
        order by pass_entry.ordinality
      ),
      '[]'::jsonb
    )
    into v_passes
    from jsonb_array_elements(coalesce(v_guide->'guestPasses', '[]'::jsonb))
      with ordinality as pass_entry(value, ordinality)
    join public.guests guest
      on guest.id::text = pass_entry.value->>'guestId'
      and guest.wedding_id = v_wedding_id
      and guest.household_id = v_household_id
    join public.wedding_people person
      on person.id = guest.person_id
      and person.wedding_id = guest.wedding_id;

    v_guide := jsonb_set(v_guide, '{guestPasses}', v_passes, true);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', program.id,
        'title', program.title,
        'description', program.description,
        'scheduledStart', program.scheduled_start,
        'scheduledEnd', program.scheduled_end,
        'placeId', program.place_id,
        'placeName', coalesce(place.user_label, place.custom_name)
      )
      order by program.sort_order, program.scheduled_start, program.id
    ),
    '[]'::jsonb
  )
  into v_program
  from public.guest_program_items program
  left join public.wedding_places place
    on place.wedding_id = program.wedding_id
    and place.id = program.place_id
    and place.archived_at is null
  where program.wedding_id = v_wedding_id and program.is_published;

  select * into v_dc
  from public.wedding_dress_codes
  where wedding_id = v_wedding_id;

  for v_section in select value from jsonb_array_elements(v_guide->'sections') loop
    if v_section->>'type' = 'DRESS_CODE' and v_dc.id is not null then
      v_data := coalesce(v_section->'data', '{}'::jsonb) || jsonb_build_object(
        'recommendedColors', private.guest_attire_colors('GENERAL', v_dc.id, false),
        'avoidColors', private.guest_attire_colors('GENERAL', v_dc.id, true),
        'guestGuidance', private.guest_attire_projection(v_wedding_id, v_household_id),
        'media', private.guest_media_descriptors(v_wedding_id, v_household_id)
      );
      v_section := jsonb_set(v_section, '{data}', v_data);
    end if;
    v_sections := v_sections || jsonb_build_array(v_section);
  end loop;

  return v_guide || jsonb_build_object('guestProgram', v_program, 'sections', v_sections);
end;
$function$;

revoke execute on function public.guest_wedding_guide(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.guest_wedding_guide(text, text) to service_role;

commit;
