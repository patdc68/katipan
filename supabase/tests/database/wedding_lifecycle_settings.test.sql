begin;
set local role postgres;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000001b01','authenticated','authenticated','lifecycle-owner@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001b02','authenticated','authenticated','lifecycle-other@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001b03','authenticated','authenticated','lifecycle-coordinator@katipan.test','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000001b04','authenticated','authenticated','lifecycle-day@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name) values
('10000000-0000-0000-0000-000000001b01','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000001b01','Lifecycle Wedding'),
('10000000-0000-0000-0000-000000001b02','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000001b02','Other Wedding'),
('10000000-0000-0000-0000-000000001b03','COORDINATOR_CREATED','DRAFT','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000001b03','Client Wedding');
insert into public.wedding_memberships(wedding_id,user_id,role) values
('10000000-0000-0000-0000-000000001b01','00000000-0000-0000-0000-000000001b01','OWNER'),
('10000000-0000-0000-0000-000000001b01','00000000-0000-0000-0000-000000001b03','FULL_COORDINATOR'),
('10000000-0000-0000-0000-000000001b01','00000000-0000-0000-0000-000000001b04','DAY_OF_COORDINATOR'),
('10000000-0000-0000-0000-000000001b02','00000000-0000-0000-0000-000000001b02','OWNER'),
('10000000-0000-0000-0000-000000001b03','00000000-0000-0000-0000-000000001b03','FULL_COORDINATOR');
set constraints all immediate;
insert into public.guest_households(id,wedding_id,display_name) values
('20000000-0000-0000-0000-000000001b01','10000000-0000-0000-0000-000000001b01','Lifecycle Household');
insert into public.wedding_people(id,wedding_id,display_name) values
('30000000-0000-0000-0000-000000001b01','10000000-0000-0000-0000-000000001b01','Lifecycle Guest'),
('30000000-0000-0000-0000-000000001b02','10000000-0000-0000-0000-000000001b03','Client Partner One'),
('30000000-0000-0000-0000-000000001b03','10000000-0000-0000-0000-000000001b03','Client Partner Two');
insert into public.wedding_partners(wedding_id,person_id,partner_order) values
('10000000-0000-0000-0000-000000001b03','30000000-0000-0000-0000-000000001b02',1),
('10000000-0000-0000-0000-000000001b03','30000000-0000-0000-0000-000000001b03',2);
insert into public.guests(id,wedding_id,person_id,household_id) values
('40000000-0000-0000-0000-000000001b01','10000000-0000-0000-0000-000000001b01','30000000-0000-0000-0000-000000001b01','20000000-0000-0000-0000-000000001b01');
insert into public.attachments(id,wedding_id,object_path,original_filename,content_type,visibility) values
('50000000-0000-0000-0000-000000001b01','10000000-0000-0000-0000-000000001b01',
 'weddings/10000000-0000-0000-0000-000000001b01/50000000-0000-0000-0000-000000001b01/file',
 'file','application/octet-stream','WEDDING_MEMBER_PRIVATE');

create temporary table lifecycle_test_tokens(label text primary key, secret text not null);
create temporary table lifecycle_delete_nonce(value uuid);
grant select,insert on lifecycle_test_tokens to authenticated,service_role;
grant select,insert on lifecycle_delete_nonce to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
insert into public.wedding_websites(wedding_id,slug,access_mode) values
('10000000-0000-0000-0000-000000001b01','lifecycle-wedding','ANYONE_WITH_LINK');
insert into lifecycle_test_tokens values
('household',public.issue_household_website_token('20000000-0000-0000-0000-000000001b01'));
select public.publish_wedding_website('10000000-0000-0000-0000-000000001b01',true);
set local role service_role;
select public.guest_submit_rsvp('lifecycle-wedding',(select secret from lifecycle_test_tokens where label='household'),
  '40000000-0000-0000-0000-000000001b01','ATTENDING');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
select public.issue_guest_pass('40000000-0000-0000-0000-000000001b01');

-- Final Owner and cross-Wedding authority remain separate from archive/delete.
do $$ begin
  begin
    perform public.leave_wedding('10000000-0000-0000-0000-000000001b01');
    raise exception 'Final Owner left';
  exception when check_violation then null; end;
  begin
    perform public.archive_wedding('10000000-0000-0000-0000-000000001b02');
    raise exception 'Cross-Wedding archive succeeded';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b03',true);
do $$ begin
  begin
    perform public.archive_wedding('10000000-0000-0000-0000-000000001b01');
    raise exception 'Full Coordinator archived couple-owned Wedding';
  exception when insufficient_privilege then null; end;
end $$;
select public.issue_partner_owner_invitation('10000000-0000-0000-0000-000000001b03',
  '30000000-0000-0000-0000-000000001b02');
do $$ begin
  begin
    perform public.publish_wedding_website('10000000-0000-0000-0000-000000001b03',true);
    raise exception 'Draft publishing succeeded';
  exception when check_violation then null; end;
end $$;
select public.activate_wedding('10000000-0000-0000-0000-000000001b03');
select public.archive_wedding('10000000-0000-0000-0000-000000001b03');
do $$ begin
  begin
    perform public.issue_partner_owner_invitation('10000000-0000-0000-0000-000000001b03',
      '30000000-0000-0000-0000-000000001b03');
    raise exception 'Archived partner invitation issued';
  exception when check_violation then null; end;
end $$;
select public.restore_wedding('10000000-0000-0000-0000-000000001b03');
do $$ begin
  if (select status from public.weddings where id='10000000-0000-0000-0000-000000001b03') <> 'ACTIVE' then
    raise exception 'Coordinator-managed Wedding restore lost active state'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
select public.remove_wedding_member('10000000-0000-0000-0000-000000001b01',
  (select id from public.wedding_memberships where wedding_id='10000000-0000-0000-0000-000000001b01'
    and user_id='00000000-0000-0000-0000-000000001b03'));
do $$ begin
  if (select status from public.wedding_memberships where wedding_id='10000000-0000-0000-0000-000000001b01'
    and user_id='00000000-0000-0000-0000-000000001b03') <> 'REMOVED' then
    raise exception 'Remove Member did not retain distinct status'; end if;
end $$;
select public.archive_wedding('10000000-0000-0000-0000-000000001b01');
do $$ begin
  if (select status from public.guest_rsvps where guest_id='40000000-0000-0000-0000-000000001b01') <> 'ATTENDING' then
    raise exception 'Archive changed RSVP'; end if;
  if (select is_published from public.wedding_websites where slug='lifecycle-wedding') is not true then
    raise exception 'Archive destroyed publication setting'; end if;
  begin
    perform public.get_guest_pass('40000000-0000-0000-0000-000000001b01');
    raise exception 'Archived Pass retrieval succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.publish_wedding_website('10000000-0000-0000-0000-000000001b01',true);
    raise exception 'Archived publishing succeeded';
  exception when check_violation then null; end;
  begin
    perform public.issue_household_website_token('20000000-0000-0000-0000-000000001b01');
    raise exception 'Archived Household invitation issued';
  exception when check_violation then null; end;
end $$;
set local role service_role;
do $$ declare v_token text := (select secret from lifecycle_test_tokens where label='household'); begin
  begin
    perform public.guest_wedding_guide('lifecycle-wedding',v_token);
    raise exception 'Archived Guide accessible';
  exception when no_data_found then null; end;
  begin
    perform public.guest_submit_rsvp('lifecycle-wedding',v_token,'40000000-0000-0000-0000-000000001b01','DECLINED');
    raise exception 'Archived RSVP accepted';
  exception when no_data_found then null; end;
  begin
    perform public.enqueue_notification('10000000-0000-0000-0000-000000001b01',
      '00000000-0000-0000-0000-000000001b01','SYSTEM','Archived','No delivery',gen_random_uuid());
    raise exception 'Archived notification produced';
  exception when check_violation then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
select public.restore_wedding('10000000-0000-0000-0000-000000001b01');
do $$ begin
  if (select status from public.weddings where id='10000000-0000-0000-0000-000000001b01') <> 'ACTIVE'
    or public.get_guest_pass('40000000-0000-0000-0000-000000001b01') is null then
    raise exception 'Restore did not resume Pass retrieval'; end if;
end $$;
set local role service_role;
select public.guest_wedding_guide('lifecycle-wedding',(select secret from lifecycle_test_tokens where label='household'));
select public.guest_submit_rsvp('lifecycle-wedding',(select secret from lifecycle_test_tokens where label='household'),
  '40000000-0000-0000-0000-000000001b01','ATTENDING');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
select public.complete_wedding('10000000-0000-0000-0000-000000001b01');
set local role service_role;
do $$ declare v_token text := (select secret from lifecycle_test_tokens where label='household'); begin
  begin
    perform public.guest_wedding_guide('lifecycle-wedding',v_token);
    raise exception 'Completed Guide accessible';
  exception when no_data_found then null; end;
  begin
    perform public.guest_submit_rsvp('lifecycle-wedding',v_token,'40000000-0000-0000-0000-000000001b01','DECLINED');
    raise exception 'Completed RSVP accepted';
  exception when no_data_found then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
do $$ begin
  begin
    perform public.get_guest_pass('40000000-0000-0000-0000-000000001b01');
    raise exception 'Completed Pass retrieval succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.publish_wedding_website('10000000-0000-0000-0000-000000001b01',true);
    raise exception 'Completed publishing succeeded';
  exception when check_violation then null; end;
end $$;
select public.archive_wedding('10000000-0000-0000-0000-000000001b01');
select public.restore_wedding('10000000-0000-0000-0000-000000001b01');
do $$ begin
  if (select status from public.weddings where id='10000000-0000-0000-0000-000000001b01') <> 'COMPLETED' then
    raise exception 'Completed Wedding restored to wrong state'; end if;
end $$;
select public.activate_wedding('10000000-0000-0000-0000-000000001b01');

-- Private invitation digests remain unavailable to both client roles.
do $$ begin
  begin
    perform 1 from private.wedding_invitation_secrets;
    raise exception 'Private invitation secrets readable';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.archive_wedding('10000000-0000-0000-0000-000000001b01');
    raise exception 'Anon lifecycle call succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guest_submit_rsvp('lifecycle-wedding',repeat('a',64),
      '40000000-0000-0000-0000-000000001b01','DECLINED');
    raise exception 'Anon direct RSVP succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Account deletion preparation must refuse the final Owner, while a lower
-- coordinator can leave without deleting either Wedding or Auth User.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
do $$ begin
  begin
    perform public.prepare_self_account_deletion();
    raise exception 'Final Owner prepared account deletion';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b04',true);
select public.prepare_self_account_deletion();
set local role postgres;
do $$ begin
  if (select status from public.wedding_memberships where user_id='00000000-0000-0000-0000-000000001b04') <> 'LEFT'
    or not exists (select 1 from auth.users where id='00000000-0000-0000-0000-000000001b04') then
    raise exception 'Account preparation deleted Wedding/User or failed to end access'; end if;
end $$;
update auth.users set deleted_at = now() where id='00000000-0000-0000-0000-000000001b04';

-- Wedding deletion removes Wedding-owned rows and never Auth users.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001b01',true);
insert into lifecycle_delete_nonce values
  (public.request_wedding_deletion('10000000-0000-0000-0000-000000001b01','Lifecycle Wedding'));
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.finalize_wedding_deletion('10000000-0000-0000-0000-000000001b01',
  (select value from lifecycle_delete_nonce));
set local role postgres;
do $$ begin
  if exists (select 1 from public.weddings where id='10000000-0000-0000-0000-000000001b01')
    or exists (select 1 from public.guests where wedding_id='10000000-0000-0000-0000-000000001b01')
    or exists (select 1 from public.attachments where wedding_id='10000000-0000-0000-0000-000000001b01')
    or exists (select 1 from public.wedding_websites where wedding_id='10000000-0000-0000-0000-000000001b01')
    or not exists (select 1 from auth.users where id='00000000-0000-0000-0000-000000001b01')
    or not exists (select 1 from public.weddings where id='10000000-0000-0000-0000-000000001b02') then
    raise exception 'Wedding deletion crossed domain boundary'; end if;
end $$;

rollback;
