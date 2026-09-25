begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000801','authenticated','authenticated','website-owner-a@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000802','authenticated','authenticated','website-owner-b@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000803','authenticated','authenticated','website-day-of@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name,wedding_date) values
('10000000-0000-0000-0000-000000000801','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000801','Guide Wedding A','2027-02-01'),
('10000000-0000-0000-0000-000000000802','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000802','Guide Wedding B','2027-03-01');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000801','OWNER'),
('10000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000802','OWNER'),
('10000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000803','DAY_OF_COORDINATOR');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','Household One'),
('20000000-0000-0000-0000-000000000802','10000000-0000-0000-0000-000000000801','Household Two'),
('20000000-0000-0000-0000-000000000803','10000000-0000-0000-0000-000000000802','Other Wedding Household');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','Guest One'),
('30000000-0000-0000-0000-000000000802','10000000-0000-0000-0000-000000000801','Guest Two'),
('30000000-0000-0000-0000-000000000803','10000000-0000-0000-0000-000000000801','Private Guest'),
('30000000-0000-0000-0000-000000000804','10000000-0000-0000-0000-000000000802','Other Wedding Guest');
insert into public.guests(id,wedding_id,person_id,household_id,internal_notes,accessibility_assistance_note) values
('40000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','30000000-0000-0000-0000-000000000801','20000000-0000-0000-0000-000000000801','secret-internal','secret-accessibility'),
('40000000-0000-0000-0000-000000000802','10000000-0000-0000-0000-000000000801','30000000-0000-0000-0000-000000000802','20000000-0000-0000-0000-000000000801',null,null),
('40000000-0000-0000-0000-000000000803','10000000-0000-0000-0000-000000000801','30000000-0000-0000-0000-000000000803','20000000-0000-0000-0000-000000000802',null,null),
('40000000-0000-0000-0000-000000000804','10000000-0000-0000-0000-000000000802','30000000-0000-0000-0000-000000000804','20000000-0000-0000-0000-000000000803',null,null);
insert into public.wedding_places(id,wedding_id,source,place_type,custom_name,private_notes,guest_notes) values
('50000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','CUSTOM','GARDEN','Public Garden','secret-place','Gate A'),
('50000000-0000-0000-0000-000000000802','10000000-0000-0000-0000-000000000801','CUSTOM','HOTEL','Hidden Hotel','secret-hidden',null);
insert into public.wedding_place_purposes(wedding_id,place_id,purpose,guest_visible,guest_notes) values
('10000000-0000-0000-0000-000000000801','50000000-0000-0000-0000-000000000801','CEREMONY',true,'Use east entrance'),
('10000000-0000-0000-0000-000000000801','50000000-0000-0000-0000-000000000802','RECEPTION',false,null);
insert into public.wedding_dress_codes(id,wedding_id,title,description) values
('60000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','Garden formal','Wear light colors');
insert into public.attire_groups(id,wedding_id,dress_code_id,title) values
('70000000-0000-0000-0000-000000000801','10000000-0000-0000-0000-000000000801','60000000-0000-0000-0000-000000000801','Guest One Guidance');
insert into public.attire_group_guest_targets(wedding_id,attire_group_id,guest_id) values
('10000000-0000-0000-0000-000000000801','70000000-0000-0000-0000-000000000801','40000000-0000-0000-0000-000000000801');

create temporary table website_test_tokens(label text primary key, token text not null);
grant all on website_test_tokens to authenticated, service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
insert into public.wedding_websites(wedding_id,slug,access_mode,introduction) values
('10000000-0000-0000-0000-000000000801','guide-wedding-a','ANYONE_WITH_LINK','Welcome');
insert into public.wedding_website_sections(wedding_id,section_key,section_type,sort_order,audience,enabled) values
('10000000-0000-0000-0000-000000000801','intro','INTRO',0,'PUBLIC',true),
('10000000-0000-0000-0000-000000000801','places','PLACES',1,'PUBLIC',true),
('10000000-0000-0000-0000-000000000801','attire','DRESS_CODE',2,'INVITED',true),
('10000000-0000-0000-0000-000000000801','responses','RSVP',3,'PERSONALIZED',true),
('10000000-0000-0000-0000-000000000801','hidden','CUSTOM',4,'HIDDEN',true);
insert into website_test_tokens values ('one',public.issue_household_website_token('20000000-0000-0000-0000-000000000801'));
insert into website_test_tokens values ('two',public.issue_household_website_token('20000000-0000-0000-0000-000000000802'));
do $$ begin
  if (select is_published from public.wedding_websites where slug='guide-wedding-a') then raise exception 'Issue token published website'; end if;
end $$;
select public.publish_wedding_website('10000000-0000-0000-0000-000000000801',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000802',true);
insert into public.wedding_websites(wedding_id,slug,access_mode) values
('10000000-0000-0000-0000-000000000802','guide-wedding-b','INVITED_GUESTS_ONLY');
do $$ begin
  begin
    update public.wedding_websites set slug='guide-wedding-a' where slug='guide-wedding-b';
    raise exception 'Duplicate slug succeeded';
  exception when unique_violation then null; end;
end $$;
insert into website_test_tokens values ('other-wedding',public.issue_household_website_token('20000000-0000-0000-0000-000000000803'));
select public.publish_wedding_website('10000000-0000-0000-0000-000000000802',true);

set local role service_role;
do $$
declare j jsonb; t text;
begin
  select public.guest_wedding_guide('guide-wedding-a') into j;
  if jsonb_array_length(j->'sections') <> 2 or j::text like '%Guest One%' or j::text like '%secret-%'
    or j::text like '%Hidden Hotel%' or j::text like '%token_hash%' then raise exception 'Public projection leaked data: %', j; end if;
  select token into t from website_test_tokens where label='one';
  select public.guest_wedding_guide('guide-wedding-a',t) into j;
  if jsonb_array_length(j->'sections') <> 4 or j::text not like '%Guest One Guidance%'
    or j::text not like '%Guest One%' or j::text like '%Private Guest%'
    or j::text like '%secret-%' or j::text like '%Hidden Hotel%'
    or j::text like '%seating%' or j::text like '%guestPass%' then raise exception 'Invited projection incorrect: %', j; end if;
  perform public.guest_submit_rsvp('guide-wedding-a',t,'40000000-0000-0000-0000-000000000801','ATTENDING','Vegetarian','No peanuts','Thank you');
  if (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000000802') <> 'NO_RESPONSE' then
    raise exception 'RSVP was not individual'; end if;
  if (select delivery_status from public.guest_households where id='20000000-0000-0000-0000-000000000801') <> 'NOT_SENT' then
    raise exception 'RSVP changed invitation delivery'; end if;
  begin
    perform public.guest_submit_rsvp('guide-wedding-a',t,'40000000-0000-0000-0000-000000000803','ATTENDING');
    raise exception 'Cross Household RSVP succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guest_wedding_guide('guide-wedding-a',repeat('f',64));
    raise exception 'Invalid token succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guest_wedding_guide('guide-wedding-b',t);
    raise exception 'Token crossed Wedding';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guest_wedding_guide('guide-wedding-b');
    raise exception 'Invited-only guide was public';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000803',true);
do $$ begin
  begin
    perform public.publish_wedding_website('10000000-0000-0000-0000-000000000801',false);
    raise exception 'Day-of coordinator published';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
update public.wedding_websites set access_mode='INVITED_GUESTS_ONLY' where slug='guide-wedding-a';
select public.publish_wedding_website('10000000-0000-0000-0000-000000000801',false);
set local role service_role;
do $$ declare t text; begin
  select token into t from website_test_tokens where label='one';
  begin
    perform public.guest_wedding_guide('guide-wedding-a',t);
    raise exception 'Unpublished guide remained accessible';
  exception when no_data_found then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
select public.publish_wedding_website('10000000-0000-0000-0000-000000000801',true);
insert into website_test_tokens values ('reissued',public.issue_household_website_token('20000000-0000-0000-0000-000000000801'));
set local role service_role;
do $$ declare t text; begin
  select token into t from website_test_tokens where label='one';
  begin
    perform public.guest_wedding_guide('guide-wedding-a',t);
    raise exception 'Reissued token left old token valid';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
select public.revoke_household_website_token('20000000-0000-0000-0000-000000000801');
set local role service_role;
do $$ declare t text; begin
  select token into t from website_test_tokens where label='reissued';
  begin
    perform public.guest_wedding_guide('guide-wedding-a',t);
    raise exception 'Revoked token succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
