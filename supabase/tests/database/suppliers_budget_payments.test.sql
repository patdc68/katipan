begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
select extensions.no_plan();

insert into auth.users (id, aud, role, email, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000701','authenticated','authenticated','f5-owner@katipan.test','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000702','authenticated','authenticated','f5-full@katipan.test','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000703','authenticated','authenticated','f5-day@katipan.test','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000704','authenticated','authenticated','f5-guest@katipan.test','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000705','authenticated','authenticated','f5-other@katipan.test','{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000706','authenticated','authenticated','f5-controller@katipan.test','{}','{}',now(),now());
insert into public.weddings
  (id, origin, status, ownership_mode, created_by_user_id, display_name) values
  ('10000000-0000-0000-0000-000000000701','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000701','F5 A'),
  ('10000000-0000-0000-0000-000000000702','COUPLE_CREATED','ACTIVE','COUPLE_OWNED','00000000-0000-0000-0000-000000000705','F5 B'),
  ('10000000-0000-0000-0000-000000000703','COORDINATOR_CREATED','ACTIVE','COORDINATOR_MANAGED','00000000-0000-0000-0000-000000000706','F5 C');
insert into public.wedding_memberships (wedding_id,user_id,role) values
  ('10000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000701','OWNER'),
  ('10000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000702','FULL_COORDINATOR'),
  ('10000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000703','DAY_OF_COORDINATOR'),
  ('10000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000704','GUEST_COORDINATOR'),
  ('10000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000705','OWNER'),
  ('10000000-0000-0000-0000-000000000703','00000000-0000-0000-0000-000000000706','FULL_COORDINATOR');
set constraints all immediate;
insert into public.budget_categories(id,wedding_id,name) values
  ('30000000-0000-0000-0000-000000000701','10000000-0000-0000-0000-000000000701','F5 Budget A'),
  ('30000000-0000-0000-0000-000000000702','10000000-0000-0000-0000-000000000702','F5 Budget B');
insert into public.suppliers(id,wedding_id,name,category) values
  ('50000000-0000-0000-0000-000000000701','10000000-0000-0000-0000-000000000701','F5 Supplier A','Catering'),
  ('50000000-0000-0000-0000-000000000702','10000000-0000-0000-0000-000000000702','F5 Supplier B','Flowers');
insert into public.attachments
  (id,wedding_id,object_path,original_filename,content_type,size_bytes,visibility,status,available_at) values
  ('40000000-0000-0000-0000-000000000701','10000000-0000-0000-0000-000000000701','tests/f5/receipt','receipt.pdf','application/pdf',100,'FINANCIAL_PRIVATE','AVAILABLE',now()),
  ('40000000-0000-0000-0000-000000000702','10000000-0000-0000-0000-000000000702','tests/f5/other','other.pdf','application/pdf',100,'FINANCIAL_PRIVATE','AVAILABLE',now());
insert into public.budget_items(id,wedding_id,category_id,supplier_id,name,estimated_amount)
values ('60000000-0000-0000-0000-000000000701','10000000-0000-0000-0000-000000000701',
  '30000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701','Supplier allocation',500);
insert into public.budget_items(id,wedding_id,category_id,name,estimated_amount,actual_amount)
values ('60000000-0000-0000-0000-000000000702','10000000-0000-0000-0000-000000000701',
  '30000000-0000-0000-0000-000000000701','Manual non-supplier cost',100,80);
create temp table f5_state(label text primary key,id uuid);
grant select, insert on f5_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000701',true);
select extensions.is((select committed_amount from public.suppliers where id = '50000000-0000-0000-0000-000000000701'),
  null::numeric, 'Supplier may start without a commitment');
select public.set_supplier_commitment('50000000-0000-0000-0000-000000000701',1000,current_date,'Signed agreement');
select extensions.ok((select committed_amount = 1000 and committed_on = current_date
  from public.suppliers where id = '50000000-0000-0000-0000-000000000701'),
  'Commitment has independent amount and date');
select extensions.ok((select scheduled_amount = 0 and actual_paid = 0 and remaining_commitment = 1000
  from public.supplier_finance_totals where supplier_id = '50000000-0000-0000-0000-000000000701'),
  'Commitment alone creates neither installment nor actual payment');

select extensions.throws_ok($$select public.create_budget_item(
  '10000000-0000-0000-0000-000000000701','30000000-0000-0000-0000-000000000701',
  '50000000-0000-0000-0000-000000000701','Duplicate actual',null,0,10)$$,
  '23514',null,'Supplier-linked budget item cannot carry duplicate actual');

insert into f5_state values ('installment',public.create_supplier_installment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  '60000000-0000-0000-0000-000000000701',300,current_date-1,'Deposit'));
select extensions.ok((select status = 'OVERDUE' and unpaid_balance = 300 and paid_amount = 0
  from public.supplier_installment_schedule where id = (select id from f5_state where label='installment')),
  'Past due installment is derived overdue while unpaid');
select extensions.ok((select committed_total=1000 and scheduled_total=300 and paid_total=0
  and remaining_commitment=1000 and overdue_total=300
  from public.wedding_payment_totals where wedding_id='10000000-0000-0000-0000-000000000701'),
  'Schedule remains independent of commitment and actual payment');

insert into f5_state values ('payment1',public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  (select id from f5_state where label='installment'),'60000000-0000-0000-0000-000000000701',
  100,now(),'Bank transfer','F5-001','First partial'));
insert into f5_state values ('payment2',public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  (select id from f5_state where label='installment'),'60000000-0000-0000-0000-000000000701',
  50,now(),'Cash','F5-002','Second partial'));
select extensions.ok((select amount=300 and paid_amount=150 and unpaid_balance=150 and status='OVERDUE'
  from public.supplier_installment_schedule where id=(select id from f5_state where label='installment')),
  'Two partial payments reduce the overdue balance without rewriting the schedule');
insert into f5_state values ('unscheduled',public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  null,null,20,now(),'Cash',null,'Legitimate unscheduled charge'));
select extensions.ok((select scheduled_total=300 and paid_total=170 and
  unscheduled_paid_total=20 and remaining_commitment=830
  from public.wedding_payment_totals where wedding_id='10000000-0000-0000-0000-000000000701'),
  'Unscheduled actual counts once, outside installment balance');
select extensions.is((select actual_total from public.wedding_budget_totals
  where wedding_id='10000000-0000-0000-0000-000000000701'),
  250::numeric,'Budget actual combines manual cost and supplier net actual once');

insert into f5_state values ('reversal',public.reverse_supplier_payment(
  (select id from f5_state where label='payment1'),'Wrong payment amount'));
select extensions.ok((select paid_total=70 and remaining_commitment=930 and overdue_total=250
  from public.wedding_payment_totals where wedding_id='10000000-0000-0000-0000-000000000701'),
  'Explicit reversal negates actual and reopens installment balance');
select extensions.throws_ok(format('select public.reverse_supplier_payment(%L,%L)',
  (select id from f5_state where label='payment1'),'Duplicate reversal'),
  '23505',null,'A payment can be reversed only once');
select extensions.throws_ok(format('update public.supplier_payment_transactions set amount=999 where id=%L',
  (select id from f5_state where label='payment2')),
  '42501',null,'Actual transaction rows cannot be silently edited');
insert into f5_state values ('correction',public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  (select id from f5_state where label='installment'),'60000000-0000-0000-0000-000000000701',
  80,now(),'Bank transfer','F5-001-C','Corrected amount'));
select extensions.is((select paid_total from public.wedding_payment_totals
  where wedding_id='10000000-0000-0000-0000-000000000701'),
  150::numeric,'Correction is a new transaction following the reversal');
update public.supplier_installments set amount=400
where id=(select id from f5_state where label='installment');
select extensions.ok((select scheduled_total=400 and paid_total=150 and overdue_total=270
  from public.wedding_payment_totals where wedding_id='10000000-0000-0000-0000-000000000701'),
  'Editing a schedule does not edit historical actual transactions');
select extensions.is((select count(*) from public.supplier_payment_transactions
  where installment_id=(select id from f5_state where label='installment')),
  4::bigint,'Multiple payments and reversal remain append-only records');

select extensions.ok(public.link_payment_receipt_attachment(
  (select id from f5_state where label='payment2'),'40000000-0000-0000-0000-000000000701'),
  'Receipt attaches to the actual payment transaction');
select extensions.is((select count(*) from public.payment_receipt_attachments
  where payment_id=(select id from f5_state where label='payment2')),
  1::bigint,'Receipt relationship follows the transaction ID');
select extensions.throws_ok(format('select public.link_payment_receipt_attachment(%L,%L)',
  (select id from f5_state where label='payment2'),
  '40000000-0000-0000-0000-000000000702'),
  '23503',null,'Cross-Wedding receipt link is rejected');
select extensions.throws_ok($$select public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000702',
  null,null,1,now())$$,
  '23503',null,'Cross-Wedding Supplier transaction is rejected');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000702',true);
select extensions.is((select count(*) from public.supplier_payment_transactions),
  5::bigint,'Full Coordinator reads finance transactions');
select extensions.ok(public.create_supplier('10000000-0000-0000-0000-000000000701',
  'Full Coordinator Supplier','Music') is not null,
  'Full Coordinator can write finance records');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000706',true);
select extensions.ok(public.create_supplier('10000000-0000-0000-0000-000000000703',
  'Controller Supplier','Coordination') is not null,
  'Valid temporary controller may manage its Wedding finances');
select extensions.is((select count(*) from public.suppliers),
  1::bigint,'Temporary controller sees only its Wedding');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000703',true);
select extensions.is((select count(*) from public.supplier_payment_transactions),
  0::bigint,'Day-of Coordinator cannot read actuals');
select extensions.is((select count(*) from public.wedding_payment_totals),
  0::bigint,'Day-of Coordinator cannot read derived finance totals');
select extensions.throws_ok($$select public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000701','50000000-0000-0000-0000-000000000701',
  null,null,1,now())$$,'42501',null,'Day-of Coordinator cannot record payment');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000704',true);
select extensions.is((select count(*) from public.supplier_installments),
  0::bigint,'Guest Coordinator cannot read installments');
select extensions.is((select count(*) from public.payment_receipt_attachments),
  0::bigint,'Guest Coordinator cannot read receipt metadata');
select extensions.throws_ok($$select public.set_supplier_commitment(
  '50000000-0000-0000-0000-000000000701',1)$$,
  '42501',null,'Guest Coordinator cannot change supplier commitment');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000705',true);
select extensions.is((select count(*) from public.suppliers),
  1::bigint,'Other Wedding Owner sees only their supplier');
select extensions.is((select count(*) from public.supplier_payment_transactions),
  0::bigint,'Cross-Wedding actual transactions stay isolated');

set local role postgres;
select extensions.ok(not exists (
  select 1 from private.legacy_supplier_payments old
  left join public.supplier_installments i on i.id=old.id and i.wedding_id=old.wedding_id
  where i.id is null or i.supplier_id<>old.supplier_id
    or i.budget_item_id is distinct from old.budget_item_id
    or i.amount<>old.amount or i.due_date<>old.due_date
    or i.cancelled_at is distinct from old.cancelled_at
    or i.created_at<>old.created_at),
  'Every legacy combined row retains its exact planned installment facts');
select extensions.ok(not exists (
  select 1 from private.legacy_supplier_payments old
  left join public.supplier_payment_transactions t
    on t.id=old.id and t.wedding_id=old.wedding_id and t.kind='PAYMENT'
  where old.paid_at is not null and (t.id is null or t.amount<>old.amount
    or t.paid_at<>old.paid_at or t.payment_method is distinct from old.payment_method
    or t.reference_number is distinct from old.reference_number
    or t.supplier_id<>old.supplier_id)),
  'Every paid legacy row retains paid date, method, reference, amount and identity');
select extensions.ok(not exists (
  select 1 from private.legacy_payment_receipt_attachments old_link
  join private.legacy_supplier_payments old_payment
    on old_payment.wedding_id=old_link.wedding_id and old_payment.id=old_link.payment_id
  left join public.payment_receipt_attachments new_link
    on new_link.wedding_id=old_link.wedding_id
      and new_link.payment_id=old_link.payment_id
      and new_link.attachment_id=old_link.attachment_id
  where old_payment.paid_at is not null and
    (new_link.attachment_id is null or new_link.created_at<>old_link.created_at)),
  'Legacy paid-row receipts follow the actual transaction without losing attachment links');
select extensions.ok(not has_table_privilege('anon','public.supplier_payment_transactions','SELECT')
  and not has_table_privilege('anon','public.supplier_installments','SELECT')
  and not has_table_privilege('anon','public.wedding_payment_totals','SELECT')
  and not has_function_privilege('anon',
    'public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,timestamptz,text,text,text)','EXECUTE'),
  'Anonymous callers have no finance table, view, or RPC access');
select extensions.ok(not has_table_privilege('authenticated','public.supplier_payment_transactions','UPDATE')
  and not has_table_privilege('authenticated','public.supplier_payment_transactions','DELETE')
  and not has_table_privilege('authenticated','private.legacy_supplier_payments','SELECT'),
  'Ledger is append-only and legacy audit rows are private');
select extensions.ok((select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('supplier_installment_schedule',
  'supplier_finance_totals','wedding_payment_totals','wedding_budget_totals')
  and c.reloptions @> array['security_invoker=true']),
  'Every finance aggregate view invokes source-table RLS');
select * from extensions.finish();
rollback;
