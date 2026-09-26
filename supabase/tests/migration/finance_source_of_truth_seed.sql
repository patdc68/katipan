begin;
set local role postgres;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000790','authenticated','authenticated',
  'f5-migration@katipan.test','{}','{}',now(),now());
insert into public.weddings(id,origin,status,ownership_mode,created_by_user_id,display_name)
values ('10000000-0000-0000-0000-000000000790','COUPLE_CREATED','ACTIVE','COUPLE_OWNED',
  '00000000-0000-0000-0000-000000000790','F5 migration fixture');
insert into public.wedding_memberships(wedding_id,user_id,role)
values ('10000000-0000-0000-0000-000000000790','00000000-0000-0000-0000-000000000790','OWNER');
set constraints all immediate;
insert into public.budget_categories(id,wedding_id,name)
values ('30000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000790','Legacy');
insert into public.suppliers(id,wedding_id,name,category)
values ('50000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000790','Legacy supplier','Catering');
insert into public.budget_items(id,wedding_id,category_id,supplier_id,name,estimated_amount,actual_amount)
values ('60000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000790',
  '30000000-0000-0000-0000-000000000790','50000000-0000-0000-0000-000000000790','Supplier allocation',200,40);
insert into public.budget_items(id,wedding_id,category_id,name,estimated_amount,actual_amount)
values ('60000000-0000-0000-0000-000000000791','10000000-0000-0000-0000-000000000790',
  '30000000-0000-0000-0000-000000000790','Manual cost',10,5);
insert into public.attachments(id,wedding_id,object_path,original_filename,content_type,size_bytes,visibility,status,available_at)
values
  ('40000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000790','tests/f5/paid','paid.pdf','application/pdf',100,'FINANCIAL_PRIVATE','AVAILABLE',now()),
  ('40000000-0000-0000-0000-000000000791','10000000-0000-0000-0000-000000000790','tests/f5/pending','pending.pdf','application/pdf',100,'FINANCIAL_PRIVATE','AVAILABLE',now()),
  ('40000000-0000-0000-0000-000000000792','10000000-0000-0000-0000-000000000790','tests/f5/contract','contract.pdf','application/pdf',100,'FINANCIAL_PRIVATE','AVAILABLE',now());
insert into public.supplier_payments(id,wedding_id,supplier_id,budget_item_id,amount,due_date,paid_at,status,payment_method,reference_number,notes,created_at,updated_at)
values ('70000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000790',
  '50000000-0000-0000-0000-000000000790','60000000-0000-0000-0000-000000000790',
  100,'2026-09-24','2026-09-25 10:00+00','PAID','Bank transfer','LEGACY-001','Deposit',
  '2026-09-24 10:00+00','2026-09-25 10:00+00');
insert into public.supplier_payments(id,wedding_id,supplier_id,amount,due_date,paid_at,status,payment_method,reference_number,notes,cancelled_at,created_at,updated_at)
values ('70000000-0000-0000-0000-000000000791','10000000-0000-0000-0000-000000000790',
  '50000000-0000-0000-0000-000000000790',50,'2026-09-24','2026-09-25 10:00+00',
  'CANCELLED','Cash','LEGACY-002','Cancelled after payment','2026-09-26 10:00+00',
  '2026-09-24 10:00+00','2026-09-26 10:00+00');
insert into public.supplier_payments(id,wedding_id,supplier_id,amount,due_date,status,notes,created_at,updated_at)
values ('70000000-0000-0000-0000-000000000792','10000000-0000-0000-0000-000000000790',
  '50000000-0000-0000-0000-000000000790',25,'2026-09-30','PENDING','Pending evidence',
  '2026-09-24 10:00+00','2026-09-24 10:00+00');
insert into public.payment_receipt_attachments(wedding_id,payment_id,attachment_id)
values
  ('10000000-0000-0000-0000-000000000790','70000000-0000-0000-0000-000000000790','40000000-0000-0000-0000-000000000790'),
  ('10000000-0000-0000-0000-000000000790','70000000-0000-0000-0000-000000000792','40000000-0000-0000-0000-000000000791');
insert into public.supplier_contract_attachments(wedding_id,supplier_id,attachment_id)
values ('10000000-0000-0000-0000-000000000790','50000000-0000-0000-0000-000000000790',
  '40000000-0000-0000-0000-000000000792');
