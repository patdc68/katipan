begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-00000000a101','authenticated','authenticated','program-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-00000000a102','authenticated','authenticated','program-full@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-00000000a103','authenticated','authenticated','program-day@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-00000000a104','authenticated','authenticated','program-other@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name) values
('10000000-0000-0000-0000-00000000a101','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-00000000a101','Program Wedding'),
('10000000-0000-0000-0000-00000000a102','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-00000000a104','Other Wedding');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000a101','OWNER'),
('10000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000a102','FULL_COORDINATOR'),
('10000000-0000-0000-0000-00000000a101','00000000-0000-0000-0000-00000000a103','DAY_OF_COORDINATOR'),
('10000000-0000-0000-0000-00000000a102','00000000-0000-0000-0000-00000000a104','OWNER');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','First Household'),
('20000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','Second Household');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','First Guest'),
('30000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','Second Guest');
insert into public.guests(id,wedding_id,person_id,household_id) values
('40000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','30000000-0000-0000-0000-00000000a101','20000000-0000-0000-0000-00000000a101'),
('40000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','30000000-0000-0000-0000-00000000a102','20000000-0000-0000-0000-00000000a102');
insert into public.wedding_dress_codes(id,wedding_id,title,general_notes) values
('50000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','Garden formal','General attire');
insert into public.wedding_motifs(id,wedding_id,title) values
('50000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','Garden motif');
insert into public.dress_code_recommended_colors(wedding_id,dress_code_id,color_hex) values
('10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a101','#112233');
insert into public.dress_code_avoid_colors(wedding_id,dress_code_id,color_hex) values
('10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a101','#445566');
insert into public.entourage_roles(id,wedding_id,name) values
('60000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','Bridesmaid');
insert into public.entourage_assignments(wedding_id,role_id,guest_id) values
('10000000-0000-0000-0000-00000000a101','60000000-0000-0000-0000-00000000a101','40000000-0000-0000-0000-00000000a101');
insert into public.attire_groups(id,wedding_id,dress_code_id,title,instructions) values
('70000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a101','Entourage','Role attire');
insert into public.attire_group_entourage_role_targets(wedding_id,attire_group_id,entourage_role_id) values
('10000000-0000-0000-0000-00000000a101','70000000-0000-0000-0000-00000000a101','60000000-0000-0000-0000-00000000a101');
insert into public.attire_group_recommended_colors(wedding_id,attire_group_id,color_hex) values
('10000000-0000-0000-0000-00000000a101','70000000-0000-0000-0000-00000000a101','#778899');
insert into public.guest_attire_guidance(id,wedding_id,guest_id,instructions) values
('80000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','40000000-0000-0000-0000-00000000a101','Personal attire');
insert into public.guest_attire_avoid_colors(wedding_id,guest_attire_guidance_id,color_hex) values
('10000000-0000-0000-0000-00000000a101','80000000-0000-0000-0000-00000000a101','#AABBCC');
insert into public.attachments(id,wedding_id,object_path,original_filename,content_type,visibility,status,available_at) values
('90000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','weddings/10000000-0000-0000-0000-00000000a101/90000000-0000-0000-0000-00000000a101/image','image','image/png','GUEST_VISIBLE','AVAILABLE',now()),
('90000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','weddings/10000000-0000-0000-0000-00000000a101/90000000-0000-0000-0000-00000000a102/image','private','image/png','WEDDING_MEMBER_PRIVATE','AVAILABLE',now()),
('90000000-0000-0000-0000-00000000a103','10000000-0000-0000-0000-00000000a101','weddings/10000000-0000-0000-0000-00000000a101/90000000-0000-0000-0000-00000000a103/invoice','invoice','application/pdf','FINANCIAL_PRIVATE','AVAILABLE',now()),
('90000000-0000-0000-0000-00000000a104','10000000-0000-0000-0000-00000000a102','weddings/10000000-0000-0000-0000-00000000a102/90000000-0000-0000-0000-00000000a104/image','other','image/png','GUEST_VISIBLE','AVAILABLE',now()),
('90000000-0000-0000-0000-00000000a105','10000000-0000-0000-0000-00000000a101','weddings/10000000-0000-0000-0000-00000000a101/90000000-0000-0000-0000-00000000a105/image','motif','image/png','GUEST_VISIBLE','AVAILABLE',now());
insert into public.dress_code_inspiration_attachments(wedding_id,dress_code_id,attachment_id,sort_order) values
('10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a101','90000000-0000-0000-0000-00000000a101',0),
('10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a101','90000000-0000-0000-0000-00000000a102',1);
insert into public.motif_inspiration_attachments(wedding_id,motif_id,attachment_id) values
('10000000-0000-0000-0000-00000000a101','50000000-0000-0000-0000-00000000a102','90000000-0000-0000-0000-00000000a105');

create temporary table program_tokens(label text primary key, token text not null);
grant all on program_tokens to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a101',true);
insert into public.wedding_websites(wedding_id,slug,access_mode) values
('10000000-0000-0000-0000-00000000a101','program-wedding','ANYONE_WITH_LINK');
insert into public.wedding_website_sections(wedding_id,section_key,section_type,audience,enabled) values
('10000000-0000-0000-0000-00000000a101','attire','DRESS_CODE','PUBLIC',true);
insert into program_tokens values
('first',public.issue_household_website_token('20000000-0000-0000-0000-00000000a101')),
('second',public.issue_household_website_token('20000000-0000-0000-0000-00000000a102'));
select public.publish_wedding_website('10000000-0000-0000-0000-00000000a101',true);
set local role postgres;
insert into public.wedding_day_items(id,wedding_id,title,scheduled_start) values
('a0000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','Operational opening','2027-01-01 09:00+00'),
('a0000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101','Later item','2027-01-01 10:00+00');
insert into public.guest_program_items(id,wedding_id,operational_item_id,title,scheduled_start) values
('b0000000-0000-0000-0000-00000000a101','10000000-0000-0000-0000-00000000a101','a0000000-0000-0000-0000-00000000a101','Guest opening','2027-01-01 09:30+00'),
('b0000000-0000-0000-0000-00000000a102','10000000-0000-0000-0000-00000000a101',null,'Guest later','2027-01-01 11:00+00');
set local role service_role;
do $$ begin
  if jsonb_array_length(public.guest_wedding_guide('program-wedding')->'guestProgram') <> 0 then
    raise exception 'Unpublished Guest Program was visible';
  end if;
end $$;
set local role authenticated;
select public.set_guest_program_publication('b0000000-0000-0000-0000-00000000a101','UPDATE','2027-01-01 09:30+00',null,true);
select public.set_guest_program_publication('b0000000-0000-0000-0000-00000000a102','UPDATE','2027-01-01 11:00+00',null,true);

set local role service_role;
do $$ declare j jsonb; t text; begin
  j := public.guest_wedding_guide('program-wedding');
  if jsonb_array_length(j->'guestProgram') <> 2 or j::text like '%Operational opening%'
    or j::text like '%Personal attire%' or j::text not like '%#112233%'
    or j::text not like '%#445566%'
    or j::text like '%90000000-0000-0000-0000-00000000a105%'
    then raise exception 'Public guide projection failed: %',j; end if;
  select token into t from program_tokens where label='first';
  j := public.guest_wedding_guide('program-wedding',t);
  if j::text not like '%Personal attire%' or j::text not like '%Bridesmaid%'
    or j::text not like '%#778899%' or j::text not like '%#AABBCC%'
    or j::text like '%Second Guest%' or j::text like '%90000000-0000-0000-0000-00000000a102%' then
    raise exception 'Token-scoped attire precedence/media failed: %',j;
  end if;
  j := public.guest_wedding_guide('program-wedding',
    (select token from program_tokens where label='second'));
  if j::text like '%Personal attire%' or j::text like '%Bridesmaid%'
    or j::text not like '%General attire%' then
    raise exception 'Household isolation failed: %',j;
  end if;
  perform public.guest_media_locator('program-wedding',t,
    '90000000-0000-0000-0000-00000000a101');
  perform public.guest_media_locator('program-wedding',t,
    '90000000-0000-0000-0000-00000000a105');
  perform public.guest_media_locator('program-wedding',null,
    '90000000-0000-0000-0000-00000000a101');
  begin
    perform public.guest_media_locator('program-wedding',null,
      '90000000-0000-0000-0000-00000000a105');
    raise exception 'Invited motif media exposed publicly';
  exception when no_data_found then null; end;
  begin
    perform public.guest_media_locator('program-wedding',t,
      '90000000-0000-0000-0000-00000000a102');
    raise exception 'Private media exposed';
  exception when no_data_found then null; end;
  begin
    perform public.guest_media_locator('program-wedding',t,
      '90000000-0000-0000-0000-00000000a103');
    raise exception 'Financial media exposed';
  exception when no_data_found then null; end;
  begin
    perform public.guest_media_locator('program-wedding',t,
      '90000000-0000-0000-0000-00000000a104');
    raise exception 'Cross-Wedding media exposed';
  exception when no_data_found then null; end;
  begin
    perform public.guest_media_locator('program-wedding',repeat('0',64),
      '90000000-0000-0000-0000-00000000a101');
    raise exception 'Invalid token accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a103',true);
update public.wedding_day_items set scheduled_start='2027-01-01 09:20+00',status='DELAYED'
  where id='a0000000-0000-0000-0000-00000000a101';
do $$ begin
  if not (select review_required from public.guest_program_items
    where id='b0000000-0000-0000-0000-00000000a101')
    or (select scheduled_start from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a101') <> '2027-01-01 09:30+00'
    or (select scheduled_start from public.wedding_day_items
      where id='a0000000-0000-0000-0000-00000000a102') <> '2027-01-01 10:00+00'
    or (select scheduled_start from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a102') <> '2027-01-01 11:00+00' then
    raise exception 'Operational delay cascaded or failed to request review';
  end if;
  begin
    update public.guest_program_items set scheduled_start='2027-01-01 10:00+00'
      where id='b0000000-0000-0000-0000-00000000a101';
    raise exception 'DAY_OF changed guest-facing time directly';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_guest_program_publication('b0000000-0000-0000-0000-00000000a101','KEEP');
    raise exception 'DAY_OF published Guest Program';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a102',true);
select public.set_guest_program_publication('b0000000-0000-0000-0000-00000000a101','KEEP');
do $$ begin
  if (select review_required from public.guest_program_items
    where id='b0000000-0000-0000-0000-00000000a101')
    or (select review_resolution from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a101') <> 'KEEP'
    or (select review_confirmed_by_user_id from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a101')
      <> '00000000-0000-0000-0000-00000000a102' then
    raise exception 'Explicit KEEP confirmation failed';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a103',true);
update public.wedding_day_items set scheduled_start='2027-01-01 09:40+00'
  where id='a0000000-0000-0000-0000-00000000a101';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a101',true);
select public.set_guest_program_publication('b0000000-0000-0000-0000-00000000a101','UPDATE',
  '2027-01-01 09:50+00',null,true);
do $$ begin
  if (select review_resolution from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a101') <> 'UPDATE'
    or (select scheduled_start from public.guest_program_items
      where id='b0000000-0000-0000-0000-00000000a101') <> '2027-01-01 09:50+00' then
    raise exception 'Explicit guest time confirmation failed';
  end if;
end $$;
select public.revoke_household_website_token('20000000-0000-0000-0000-00000000a101');
update public.wedding_website_sections set audience='INVITED'
  where wedding_id='10000000-0000-0000-0000-00000000a101'
    and section_key='attire';
set local role service_role;
do $$ begin
  begin
    perform public.guest_media_locator('program-wedding',null,
      '90000000-0000-0000-0000-00000000a101');
    raise exception 'Non-public media exposed without token';
  exception when no_data_found then null; end;
  begin
    perform public.guest_media_locator('program-wedding',
      (select token from program_tokens where label='first'),
      '90000000-0000-0000-0000-00000000a101');
    raise exception 'Revoked token accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
update private.household_website_tokens
  set created_at=now()-interval '2 days', expires_at=now()-interval '1 day'
  where household_id='20000000-0000-0000-0000-00000000a102';
set local role service_role;
do $$ begin
  begin
    perform public.guest_media_locator('program-wedding',
      (select token from program_tokens where label='second'),
      '90000000-0000-0000-0000-00000000a101');
    raise exception 'Expired token accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
do $$ begin
  if has_table_privilege('anon','public.guest_program_items','SELECT')
    or has_function_privilege('anon','public.guest_media_locator(text,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.guest_media_locator(text,text,uuid)','EXECUTE') then
    raise exception 'Raw Guest Program or media locator exposed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a104',true);
do $$ begin
  if exists (select 1 from public.guest_program_items
    where wedding_id='10000000-0000-0000-0000-00000000a101') then
    raise exception 'Cross-Wedding Guest Program exposed';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a101',true);
select public.archive_wedding('10000000-0000-0000-0000-00000000a101');
set local role service_role;
do $$ begin
  begin
    perform public.guest_wedding_guide('program-wedding');
    raise exception 'Archived Guest Program exposed';
  exception when no_data_found then null; end;
end $$;
rollback;
