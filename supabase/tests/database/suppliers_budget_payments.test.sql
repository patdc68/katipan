begin;

set local role postgres;

create extension if not exists pgtap with schema extensions;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select extensions.no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000501', 'authenticated', 'authenticated', 'finance-owner-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000502', 'authenticated', 'authenticated', 'finance-full-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000503', 'authenticated', 'authenticated', 'finance-day-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000504', 'authenticated', 'authenticated', 'finance-guest-coordinator-a@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000505', 'authenticated', 'authenticated', 'finance-unrelated@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000506', 'authenticated', 'authenticated', 'finance-owner-b@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000507', 'authenticated', 'authenticated', 'finance-controller@katipan.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.weddings (
  id,
  origin,
  status,
  ownership_mode,
  created_by_user_id,
  display_name
)
values
  ('10000000-0000-0000-0000-000000000501', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000501', 'Finance Wedding A'),
  ('10000000-0000-0000-0000-000000000502', 'COUPLE_CREATED', 'ACTIVE', 'COUPLE_OWNED', '00000000-0000-0000-0000-000000000506', 'Finance Wedding B'),
  ('10000000-0000-0000-0000-000000000503', 'COORDINATOR_CREATED', 'ACTIVE', 'COORDINATOR_MANAGED', '00000000-0000-0000-0000-000000000507', 'Finance Controller Wedding');

update public.weddings
set currency_code = 'USD'
where id = '10000000-0000-0000-0000-000000000502';

insert into public.wedding_memberships (
  id,
  wedding_id,
  user_id,
  role
)
values
  ('20000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000501', 'OWNER'),
  ('20000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502', 'FULL_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000503', 'DAY_OF_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000504', '10000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000504', 'GUEST_COORDINATOR'),
  ('20000000-0000-0000-0000-000000000506', '10000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000506', 'OWNER'),
  ('20000000-0000-0000-0000-000000000507', '10000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000507', 'FULL_COORDINATOR');

set constraints all immediate;

insert into public.budget_categories (
  id,
  wedding_id,
  name,
  sort_order
)
values
  ('30000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', 'Food', 1),
  ('30000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000501', 'Venue', 2),
  ('30000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000502', 'Photography', 1),
  ('30000000-0000-0000-0000-000000000504', '10000000-0000-0000-0000-000000000503', 'Coordination', 1);

insert into public.attachments (
  id,
  wedding_id,
  object_path,
  original_filename,
  content_type,
  size_bytes,
  visibility,
  status,
  available_at
)
values
  ('40000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', 'tests/finance-a/contract', 'contract.pdf', 'application/pdf', 100, 'FINANCIAL_PRIVATE', 'AVAILABLE', now()),
  ('40000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000501', 'tests/finance-a/receipt', 'receipt.pdf', 'application/pdf', 100, 'FINANCIAL_PRIVATE', 'AVAILABLE', now()),
  ('40000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000501', 'tests/finance-a/general', 'general.pdf', 'application/pdf', 100, 'WEDDING_MEMBER_PRIVATE', 'AVAILABLE', now()),
  ('40000000-0000-0000-0000-000000000504', '10000000-0000-0000-0000-000000000502', 'tests/finance-b/receipt', 'receipt-b.pdf', 'application/pdf', 100, 'FINANCIAL_PRIVATE', 'AVAILABLE', now());

create temporary table finance_test_state (
  label text primary key,
  value uuid not null
);

grant all on table finance_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);

insert into finance_test_state (label, value)
values
  (
    'caterer',
    public.create_supplier(
      '10000000-0000-0000-0000-000000000501',
      '  Mabuhay Catering  ',
      '  Catering  ',
      'Ana Reyes',
      '  ANA@EXAMPLE.COM  ',
      '+63 900 000 0000',
      'https://catering.example',
      'Primary caterer',
      'BOOKED'
    )
  ),
  (
    'photographer',
    public.create_supplier(
      '10000000-0000-0000-0000-000000000501',
      'Litrato Studio',
      'Photo and Video'
    )
  );

select extensions.ok(
  (
    select supplier.name = 'Mabuhay Catering'
      and supplier.category = 'Catering'
      and supplier.email = 'ana@example.com'
      and supplier.status = 'BOOKED'
    from public.suppliers as supplier
    where supplier.id = (select value from finance_test_state where label = 'caterer')
  ),
  'Supplier workflow normalizes contact fields and accepts customizable categories'
);

select extensions.is(
  (select count(distinct category) from public.suppliers),
  2::bigint,
  'One Wedding can use multiple free-text Supplier category types'
);

insert into finance_test_state (label, value)
values
  (
    'catering-budget',
    public.create_budget_item(
      '10000000-0000-0000-0000-000000000501',
      '30000000-0000-0000-0000-000000000501',
      (select value from finance_test_state where label = 'caterer'),
      'Catering package',
      'Dinner for invited guests',
      150000.00,
      145000.00,
      'Includes service fee',
      'CONFIRMED'
    )
  ),
  (
    'manual-budget',
    public.create_budget_item(
      '10000000-0000-0000-0000-000000000501',
      '30000000-0000-0000-0000-000000000502',
      null,
      'Permit and corkage',
      'Non-supplier planned cost',
      30000.00,
      30000.00,
      null,
      'PLANNED'
    )
  );

select extensions.ok(
  exists (
    select 1
    from public.suppliers as supplier
    where supplier.id = (select value from finance_test_state where label = 'photographer')
  )
  and not exists (
    select 1
    from public.budget_items as budget_item
    where budget_item.supplier_id = (select value from finance_test_state where label = 'photographer')
  ),
  'Supplier records exist independently from Budget Items'
);

select extensions.ok(
  (
    select budget_item.estimated_amount = 150000.00
      and budget_item.actual_amount = 145000.00
    from public.budget_items as budget_item
    where budget_item.id = (select value from finance_test_state where label = 'catering-budget')
  ),
  'Budget Items keep estimated and actual money as separate exact numeric values'
);

select extensions.ok(
  (
    select total.currency_code = 'PHP'
      and total.active_item_count = 2
      and total.estimated_total = 180000.00
      and total.actual_total = 175000.00
    from public.wedding_budget_totals as total
    where total.wedding_id = '10000000-0000-0000-0000-000000000501'
  ),
  'Budget totals are derived from active Budget Items without editable duplicate totals'
);

insert into finance_test_state (label, value)
values
  (
    'past-installment',
    public.create_supplier_payment(
      '10000000-0000-0000-0000-000000000501',
      (select value from finance_test_state where label = 'caterer'),
      (select value from finance_test_state where label = 'catering-budget'),
      50000.00,
      current_date - 1,
      null,
      null,
      'Deposit'
    )
  ),
  (
    'future-installment',
    public.create_supplier_payment(
      '10000000-0000-0000-0000-000000000501',
      (select value from finance_test_state where label = 'caterer'),
      (select value from finance_test_state where label = 'catering-budget'),
      25000.00,
      current_date + 30,
      null,
      null,
      'Second installment'
    )
  );

select extensions.is(
  (
    select count(*)
    from public.supplier_payments
    where supplier_id = (select value from finance_test_state where label = 'caterer')
  ),
  2::bigint,
  'A Supplier supports multiple independent installments'
);

select extensions.is(
  (
    select status::text
    from public.supplier_payment_schedule
    where id = (select value from finance_test_state where label = 'past-installment')
  ),
  'OVERDUE',
  'Overdue status is derived from a past due date plus stored PENDING status'
);

select extensions.is(
  (
    select stored_status::text
    from public.supplier_payment_schedule
    where id = (select value from finance_test_state where label = 'past-installment')
  ),
  'PENDING',
  'OVERDUE is not stored as independently mutable Payment truth'
);

select extensions.ok(
  (
    select total.scheduled_total = 75000.00
      and total.paid_total = 0.00
      and total.pending_total = 25000.00
      and total.overdue_total = 50000.00
    from public.wedding_payment_totals as total
    where total.wedding_id = '10000000-0000-0000-0000-000000000501'
  ),
  'Payment schedule totals derive pending and overdue installments correctly'
);

select extensions.throws_ok(
  format(
    'update public.supplier_payments set status = %L where id = %L',
    'OVERDUE',
    (select value from finance_test_state where label = 'past-installment')
  ),
  '23514',
  null,
  'Stored OVERDUE status is rejected'
);

select extensions.ok(
  public.mark_supplier_payment_paid(
    (select value from finance_test_state where label = 'past-installment'),
    now(),
    'Bank transfer',
    'BANK-001'
  ) is not null,
  'Pending Payment can be marked paid'
);

select extensions.is(
  public.mark_supplier_payment_unpaid(
    (select value from finance_test_state where label = 'past-installment')
  )::text,
  'PENDING',
  'Paid Payment can be marked unpaid'
);

select public.mark_supplier_payment_paid(
  (select value from finance_test_state where label = 'past-installment'),
  now(),
  'Bank transfer',
  'BANK-001'
);

select extensions.ok(
  public.cancel_supplier_payment(
    (select value from finance_test_state where label = 'future-installment')
  ) is not null,
  'Pending Payment can be cancelled without physical deletion'
);

select extensions.ok(
  (
    select total.scheduled_total = 50000.00
      and total.paid_total = 50000.00
      and total.pending_total = 0.00
      and total.overdue_total = 0.00
    from public.wedding_payment_totals as total
    where total.wedding_id = '10000000-0000-0000-0000-000000000501'
  ),
  'Cancelled installments are excluded while paid totals remain derived'
);

select extensions.throws_ok(
  format(
    'select public.mark_supplier_payment_unpaid(%L)',
    (select value from finance_test_state where label = 'future-installment')
  ),
  '22023',
  null,
  'Cancelled Payments cannot be reopened'
);

select extensions.ok(
  public.link_supplier_contract_attachment(
    (select value from finance_test_state where label = 'caterer'),
    '40000000-0000-0000-0000-000000000501'
  ),
  'Contract workflow links an existing same-Wedding FINANCIAL_PRIVATE Attachment'
);

select extensions.ok(
  public.link_payment_receipt_attachment(
    (select value from finance_test_state where label = 'past-installment'),
    '40000000-0000-0000-0000-000000000502'
  ),
  'Receipt workflow links an existing same-Wedding FINANCIAL_PRIVATE Attachment'
);

select extensions.throws_ok(
  format(
    'select public.link_supplier_contract_attachment(%L, %L)',
    (select value from finance_test_state where label = 'caterer'),
    '40000000-0000-0000-0000-000000000503'
  ),
  '23514',
  null,
  'Non-financial Attachment visibility is rejected for Contracts'
);

select extensions.throws_ok(
  format(
    'select public.link_payment_receipt_attachment(%L, %L)',
    (select value from finance_test_state where label = 'past-installment'),
    '40000000-0000-0000-0000-000000000504'
  ),
  '23503',
  null,
  'Cross-Wedding Receipt Attachment link is rejected'
);

select extensions.throws_ok(
  $$
    select public.create_budget_item(
      '10000000-0000-0000-0000-000000000501',
      '30000000-0000-0000-0000-000000000503',
      null,
      'Cross Wedding Category'
    )
  $$,
  '23503',
  null,
  'Cross-Wedding Budget Category link is rejected'
);

set local role postgres;

insert into public.suppliers (
  id,
  wedding_id,
  name,
  category
)
values (
  '50000000-0000-0000-0000-000000000501',
  '10000000-0000-0000-0000-000000000502',
  'Wedding B Photographer',
  'Photography'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);

select extensions.throws_ok(
  $$
    select public.create_supplier_payment(
      '10000000-0000-0000-0000-000000000501',
      '50000000-0000-0000-0000-000000000501',
      null,
      1000.00,
      current_date
    )
  $$,
  '23503',
  null,
  'Cross-Wedding Supplier Payment link is rejected'
);

select extensions.throws_ok(
  $$delete from public.supplier_payments$$,
  '42501',
  null,
  'Authenticated managers cannot physically delete Payment history'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);

insert into finance_test_state (label, value)
values (
  'full-created',
  public.create_supplier(
    '10000000-0000-0000-0000-000000000501',
    'Coordinator Supplier',
    'Coordination'
  )
);

select extensions.ok(
  exists (
    select 1
    from public.suppliers
    where id = (select value from finance_test_state where label = 'full-created')
  ),
  'Full Coordinator can manage Wedding finance records'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000507', true);

insert into finance_test_state (label, value)
values (
  'controller-created',
  public.create_supplier(
    '10000000-0000-0000-0000-000000000503',
    'Controller Supplier',
    'Coordination'
  )
);

select extensions.is(
  (select count(*) from public.suppliers),
  1::bigint,
  'Temporary coordinator-managed controller can manage and read its Wedding finance records'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000503', true);

select extensions.throws_ok(
  $$select public.create_supplier('10000000-0000-0000-0000-000000000501', 'Denied Day Of', 'Test')$$,
  '42501',
  null,
  'Day-of Coordinator cannot manage finance records'
);

select extensions.ok(
  (select count(*) from public.suppliers) = 0
  and (select count(*) from public.budget_categories) = 0
  and (select count(*) from public.budget_items) = 0
  and (select count(*) from public.supplier_payments) = 0
  and (select count(*) from public.supplier_contract_attachments) = 0
  and (select count(*) from public.payment_receipt_attachments) = 0
  and (select count(*) from public.supplier_payment_schedule) = 0
  and (select count(*) from public.wedding_budget_totals) = 0
  and (select count(*) from public.wedding_payment_totals) = 0,
  'Day-of Coordinator cannot read finance tables or projections'
);

select extensions.is(
  (select count(*) from public.attachments),
  1::bigint,
  'Day-of Coordinator cannot read FINANCIAL_PRIVATE Attachment metadata'
);
select extensions.is(
  (select count(*) from public.weddings where id = '10000000-0000-0000-0000-000000000501'),
  1::bigint,
  'Day-of Coordinator retains non-financial Wedding access'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000504', true);

select extensions.throws_ok(
  $$select public.create_supplier('10000000-0000-0000-0000-000000000501', 'Denied Guest Coordinator', 'Test')$$,
  '42501',
  null,
  'Guest Coordinator cannot manage finance records'
);

select extensions.ok(
  (select count(*) from public.suppliers) = 0
  and (select count(*) from public.budget_categories) = 0
  and (select count(*) from public.budget_items) = 0
  and (select count(*) from public.supplier_payments) = 0
  and (select count(*) from public.supplier_contract_attachments) = 0
  and (select count(*) from public.payment_receipt_attachments) = 0
  and (select count(*) from public.supplier_payment_schedule) = 0
  and (select count(*) from public.wedding_budget_totals) = 0
  and (select count(*) from public.wedding_payment_totals) = 0,
  'Guest Coordinator cannot read finance tables or projections'
);

select extensions.is(
  (select count(*) from public.attachments),
  1::bigint,
  'Guest Coordinator cannot read FINANCIAL_PRIVATE Attachment metadata'
);
select extensions.is(
  (select count(*) from public.weddings where id = '10000000-0000-0000-0000-000000000501'),
  1::bigint,
  'Guest Coordinator retains non-financial Wedding access'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000505', true);

select extensions.throws_ok(
  $$select public.create_supplier('10000000-0000-0000-0000-000000000501', 'Denied Unrelated', 'Test')$$,
  '42501',
  null,
  'Unrelated authenticated user cannot manage finance records'
);

select extensions.ok(
  (select count(*) from public.suppliers) = 0
  and (select count(*) from public.budget_categories) = 0
  and (select count(*) from public.budget_items) = 0
  and (select count(*) from public.supplier_payments) = 0
  and (select count(*) from public.supplier_contract_attachments) = 0
  and (select count(*) from public.payment_receipt_attachments) = 0,
  'Unrelated authenticated user cannot read finance tables or typed Attachment links'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000506', true);

select extensions.ok(
  (select count(*) from public.suppliers) = 1
  and (
    select currency_code = 'USD'
    from public.weddings
    where id = '10000000-0000-0000-0000-000000000502'
  ),
  'Wedding B Owner sees only Wedding B data and can use a non-PHP currency'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);

select extensions.ok(
  (select count(*) from public.suppliers where wedding_id = '10000000-0000-0000-0000-000000000502') = 0
  and (select count(*) from public.budget_items where wedding_id = '10000000-0000-0000-0000-000000000502') = 0
  and (select count(*) from public.supplier_payments where wedding_id = '10000000-0000-0000-0000-000000000502') = 0,
  'Wedding A Owner is isolated from Wedding B Suppliers, Budget Items, and Payments'
);

set local role postgres;

select extensions.ok(
  not has_table_privilege('anon', 'public.suppliers', 'SELECT')
  and not has_table_privilege('anon', 'public.budget_categories', 'SELECT')
  and not has_table_privilege('anon', 'public.budget_items', 'SELECT')
  and not has_table_privilege('anon', 'public.supplier_payments', 'SELECT')
  and not has_table_privilege('anon', 'public.supplier_payment_schedule', 'SELECT')
  and not has_table_privilege('anon', 'public.wedding_budget_totals', 'SELECT')
  and not has_table_privilege('anon', 'public.wedding_payment_totals', 'SELECT')
  and not has_function_privilege(
    'anon',
    'public.create_supplier(uuid,text,text,text,text,text,text,text,public.supplier_status)',
    'EXECUTE'
  ),
  'Anonymous role has no finance table, derived view, or workflow access'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.suppliers', 'DELETE')
  and not has_table_privilege('authenticated', 'public.budget_items', 'DELETE')
  and not has_table_privilege('authenticated', 'public.supplier_payments', 'DELETE')
  and not has_table_privilege('authenticated', 'public.supplier_contract_attachments', 'DELETE')
  and not has_table_privilege('authenticated', 'public.payment_receipt_attachments', 'DELETE'),
  'Authenticated users have no physical delete path for finance history or evidence links'
);

select extensions.ok(
  (
    select count(*) = 3
    from pg_class as relation
    join pg_namespace as relation_schema
      on relation_schema.oid = relation.relnamespace
    where relation_schema.nspname = 'public'
      and relation.relname in (
        'supplier_payment_schedule',
        'wedding_budget_totals',
        'wedding_payment_totals'
      )
      and relation.reloptions @> array['security_invoker=true']
  ),
  'All finance views are security-invoker views and preserve underlying RLS'
);

set local role anon;

select extensions.throws_ok(
  $$select count(*) from public.suppliers$$,
  '42501',
  null,
  'Anonymous Supplier read is denied'
);

select extensions.throws_ok(
  $$select count(*) from public.wedding_budget_totals$$,
  '42501',
  null,
  'Anonymous Budget totals read is denied'
);

set local role postgres;

select * from extensions.finish();

rollback;
