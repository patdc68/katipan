begin;

create type public.supplier_status as enum (
  'PROSPECT',
  'CONTACTED',
  'BOOKED',
  'COMPLETED',
  'CANCELLED'
);

create type public.budget_item_status as enum (
  'PLANNED',
  'CONFIRMED',
  'CANCELLED',
  'ARCHIVED'
);

create type public.supplier_payment_status as enum (
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED'
);

alter table public.weddings
add column currency_code text not null default 'PHP',
add constraint weddings_currency_code_iso_format_check
  check (currency_code ~ '^[A-Z]{3}$');

alter table public.attachments
add constraint attachments_wedding_id_id_key
  unique (wedding_id, id);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  name text not null,
  category text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  status public.supplier_status not null default 'PROSPECT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint suppliers_wedding_id_id_key
    unique (wedding_id, id),
  constraint suppliers_name_trimmed_check
    check (name = btrim(name) and name <> ''),
  constraint suppliers_category_trimmed_check
    check (category = btrim(category) and category <> ''),
  constraint suppliers_contact_name_not_blank_check
    check (contact_name is null or btrim(contact_name) <> ''),
  constraint suppliers_email_normalized_check
    check (email is null or (email = lower(btrim(email)) and email <> '')),
  constraint suppliers_phone_not_blank_check
    check (phone is null or btrim(phone) <> ''),
  constraint suppliers_website_not_blank_check
    check (website is null or btrim(website) <> '')
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_categories_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint budget_categories_wedding_id_id_key
    unique (wedding_id, id),
  constraint budget_categories_name_trimmed_check
    check (name = btrim(name) and name <> ''),
  constraint budget_categories_sort_order_nonnegative_check
    check (sort_order >= 0),
  constraint budget_categories_archived_at_check
    check (archived_at is null or archived_at >= created_at)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  category_id uuid not null,
  supplier_id uuid,
  name text not null,
  description text,
  estimated_amount numeric(14, 2) not null default 0,
  actual_amount numeric(14, 2),
  notes text,
  status public.budget_item_status not null default 'PLANNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_items_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint budget_items_category_same_wedding_fkey
    foreign key (wedding_id, category_id)
    references public.budget_categories (wedding_id, id)
    on delete restrict,
  constraint budget_items_supplier_same_wedding_fkey
    foreign key (wedding_id, supplier_id)
    references public.suppliers (wedding_id, id)
    on delete restrict,
  constraint budget_items_wedding_id_id_key
    unique (wedding_id, id),
  constraint budget_items_wedding_id_id_supplier_id_key
    unique (wedding_id, id, supplier_id),
  constraint budget_items_name_trimmed_check
    check (name = btrim(name) and name <> ''),
  constraint budget_items_estimated_amount_nonnegative_check
    check (estimated_amount >= 0),
  constraint budget_items_actual_amount_nonnegative_check
    check (actual_amount is null or actual_amount >= 0)
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  supplier_id uuid not null,
  budget_item_id uuid,
  amount numeric(14, 2) not null,
  due_date date not null,
  paid_at timestamptz,
  status public.supplier_payment_status not null default 'PENDING',
  payment_method text,
  reference_number text,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payments_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint supplier_payments_supplier_same_wedding_fkey
    foreign key (wedding_id, supplier_id)
    references public.suppliers (wedding_id, id)
    on delete restrict,
  constraint supplier_payments_budget_item_same_supplier_fkey
    foreign key (wedding_id, budget_item_id, supplier_id)
    references public.budget_items (wedding_id, id, supplier_id)
    on delete restrict,
  constraint supplier_payments_wedding_id_id_key
    unique (wedding_id, id),
  constraint supplier_payments_amount_positive_check
    check (amount > 0),
  constraint supplier_payments_overdue_is_derived_check
    check (status <> 'OVERDUE'),
  constraint supplier_payments_status_timestamps_check
    check (
      (
        status = 'PENDING'
        and paid_at is null
        and cancelled_at is null
      )
      or
      (
        status = 'PAID'
        and paid_at is not null
        and cancelled_at is null
      )
      or
      (
        status = 'CANCELLED'
        and cancelled_at is not null
        and (paid_at is null or cancelled_at >= paid_at)
      )
    ),
  constraint supplier_payments_payment_method_not_blank_check
    check (payment_method is null or btrim(payment_method) <> ''),
  constraint supplier_payments_reference_number_not_blank_check
    check (reference_number is null or btrim(reference_number) <> ''),
  constraint supplier_payments_paid_at_not_before_created_check
    check (paid_at is null or paid_at >= created_at),
  constraint supplier_payments_cancelled_at_not_before_created_check
    check (cancelled_at is null or cancelled_at >= created_at)
);

create table public.supplier_contract_attachments (
  wedding_id uuid not null,
  supplier_id uuid not null,
  attachment_id uuid not null,
  created_at timestamptz not null default now(),
  constraint supplier_contract_attachments_pkey
    primary key (wedding_id, supplier_id, attachment_id),
  constraint supplier_contract_attachments_supplier_same_wedding_fkey
    foreign key (wedding_id, supplier_id)
    references public.suppliers (wedding_id, id)
    on delete restrict,
  constraint supplier_contract_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments (wedding_id, id)
    on delete restrict
);

create table public.payment_receipt_attachments (
  wedding_id uuid not null,
  payment_id uuid not null,
  attachment_id uuid not null,
  created_at timestamptz not null default now(),
  constraint payment_receipt_attachments_pkey
    primary key (wedding_id, payment_id, attachment_id),
  constraint payment_receipt_attachments_payment_same_wedding_fkey
    foreign key (wedding_id, payment_id)
    references public.supplier_payments (wedding_id, id)
    on delete restrict,
  constraint payment_receipt_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments (wedding_id, id)
    on delete restrict
);

create index suppliers_wedding_status_name_idx
  on public.suppliers (wedding_id, status, name);

create index suppliers_wedding_category_idx
  on public.suppliers (wedding_id, category);

create unique index budget_categories_active_wedding_name_key
  on public.budget_categories (wedding_id, lower(name))
  where archived_at is null;

create index budget_categories_wedding_sort_idx
  on public.budget_categories (wedding_id, sort_order, name);

create index budget_items_wedding_category_status_idx
  on public.budget_items (wedding_id, category_id, status);

create index budget_items_wedding_supplier_idx
  on public.budget_items (wedding_id, supplier_id)
  where supplier_id is not null;

create index supplier_payments_wedding_supplier_status_due_idx
  on public.supplier_payments (wedding_id, supplier_id, status, due_date);

create index supplier_payments_pending_due_idx
  on public.supplier_payments (wedding_id, due_date, supplier_id)
  where status = 'PENDING';

create index supplier_payments_budget_item_idx
  on public.supplier_payments (wedding_id, budget_item_id, supplier_id)
  where budget_item_id is not null;

create index supplier_contract_attachments_attachment_idx
  on public.supplier_contract_attachments (wedding_id, attachment_id);

create index payment_receipt_attachments_attachment_idx
  on public.payment_receipt_attachments (wedding_id, attachment_id);

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row
execute function private.set_updated_at();

create trigger budget_categories_set_updated_at
before update on public.budget_categories
for each row
execute function private.set_updated_at();

create trigger budget_items_set_updated_at
before update on public.budget_items
for each row
execute function private.set_updated_at();

create trigger supplier_payments_set_updated_at
before update on public.supplier_payments
for each row
execute function private.set_updated_at();

create function private.can_manage_wedding_finances(
  p_wedding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      (select private.has_active_wedding_role(
        p_wedding_id,
        array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[]
      ))
      or (select private.controls_coordinator_managed_wedding(p_wedding_id))
    );
$function$;

create function private.enforce_supplier_payment_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.wedding_id is distinct from old.wedding_id
     or new.supplier_id is distinct from old.supplier_id
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_identity_immutable',
      message = 'Payment Wedding, Supplier, and creation time cannot be changed.';
  end if;

  if old.status = 'CANCELLED' and new is distinct from old then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_cancelled_immutable',
      message = 'Cancelled Payments are immutable.';
  end if;

  if old.status = 'PENDING' and new.status not in ('PENDING', 'PAID', 'CANCELLED') then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_status_transition_valid',
      message = 'Invalid Payment status transition.';
  elsif old.status = 'PAID' and new.status not in ('PAID', 'PENDING', 'CANCELLED') then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_status_transition_valid',
      message = 'Invalid Payment status transition.';
  elsif old.status = 'CANCELLED' and new.status <> 'CANCELLED' then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_status_transition_valid',
      message = 'Cancelled Payments cannot be reopened.';
  end if;

  if old.status <> 'PENDING'
     and (
       new.budget_item_id is distinct from old.budget_item_id
       or new.amount is distinct from old.amount
       or new.due_date is distinct from old.due_date
     ) then
    raise exception using
      errcode = '23514',
      constraint = 'supplier_payments_financial_fields_locked',
      message = 'Paid or cancelled Payment financial fields cannot be edited.';
  end if;

  return new;
end;
$function$;

create trigger supplier_payments_enforce_lifecycle
before update on public.supplier_payments
for each row
execute function private.enforce_supplier_payment_lifecycle();

create function private.enforce_financial_attachment_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_visibility public.attachment_visibility;
  v_status public.attachment_status;
begin
  select attachment.visibility, attachment.status
  into v_visibility, v_status
  from public.attachments as attachment
  where attachment.wedding_id = new.wedding_id
    and attachment.id = new.attachment_id;

  if not found then
    return new;
  end if;

  if v_visibility <> 'FINANCIAL_PRIVATE' then
    raise exception using
      errcode = '23514',
      constraint = 'financial_attachment_visibility_check',
      message = 'Contract and receipt Attachments must use FINANCIAL_PRIVATE visibility.';
  end if;

  if v_status = 'DELETED' then
    raise exception using
      errcode = '23514',
      constraint = 'financial_attachment_not_deleted_check',
      message = 'Deleted Attachments cannot be linked to financial records.';
  end if;

  return new;
end;
$function$;

create trigger supplier_contract_attachments_enforce_financial_visibility
before insert or update on public.supplier_contract_attachments
for each row
execute function private.enforce_financial_attachment_link();

create trigger payment_receipt_attachments_enforce_financial_visibility
before insert or update on public.payment_receipt_attachments
for each row
execute function private.enforce_financial_attachment_link();

create function public.create_supplier(
  p_wedding_id uuid,
  p_name text,
  p_category text,
  p_contact_name text default null,
  p_email text default null,
  p_phone text default null,
  p_website text default null,
  p_notes text default null,
  p_status public.supplier_status default 'PROSPECT'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_supplier_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Supplier management is not permitted.';
  end if;

  insert into public.suppliers (
    wedding_id,
    name,
    category,
    contact_name,
    email,
    phone,
    website,
    notes,
    status
  )
  values (
    p_wedding_id,
    pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_category),
    nullif(pg_catalog.btrim(p_contact_name), ''),
    nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
    nullif(pg_catalog.btrim(p_phone), ''),
    nullif(pg_catalog.btrim(p_website), ''),
    p_notes,
    p_status
  )
  returning id into v_supplier_id;

  return v_supplier_id;
end;
$function$;

create function public.update_supplier(
  p_supplier_id uuid,
  p_name text,
  p_category text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_website text,
  p_notes text,
  p_status public.supplier_status
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select supplier.wedding_id
  into v_wedding_id
  from public.suppliers as supplier
  where supplier.id = p_supplier_id;

  if not found then
    raise exception using errcode = '22023', message = 'Supplier not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Supplier management is not permitted.';
  end if;

  update public.suppliers as supplier
  set
    name = pg_catalog.btrim(p_name),
    category = pg_catalog.btrim(p_category),
    contact_name = nullif(pg_catalog.btrim(p_contact_name), ''),
    email = nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
    phone = nullif(pg_catalog.btrim(p_phone), ''),
    website = nullif(pg_catalog.btrim(p_website), ''),
    notes = p_notes,
    status = p_status
  where supplier.id = p_supplier_id;

  return p_supplier_id;
end;
$function$;

create function public.create_budget_item(
  p_wedding_id uuid,
  p_category_id uuid,
  p_supplier_id uuid,
  p_name text,
  p_description text default null,
  p_estimated_amount numeric default 0,
  p_actual_amount numeric default null,
  p_notes text default null,
  p_status public.budget_item_status default 'PLANNED'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_budget_item_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Budget management is not permitted.';
  end if;

  insert into public.budget_items (
    wedding_id,
    category_id,
    supplier_id,
    name,
    description,
    estimated_amount,
    actual_amount,
    notes,
    status
  )
  values (
    p_wedding_id,
    p_category_id,
    p_supplier_id,
    pg_catalog.btrim(p_name),
    p_description,
    p_estimated_amount,
    p_actual_amount,
    p_notes,
    p_status
  )
  returning id into v_budget_item_id;

  return v_budget_item_id;
end;
$function$;

create function public.update_budget_item(
  p_budget_item_id uuid,
  p_category_id uuid,
  p_supplier_id uuid,
  p_name text,
  p_description text,
  p_estimated_amount numeric,
  p_actual_amount numeric,
  p_notes text,
  p_status public.budget_item_status
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select budget_item.wedding_id
  into v_wedding_id
  from public.budget_items as budget_item
  where budget_item.id = p_budget_item_id;

  if not found then
    raise exception using errcode = '22023', message = 'Budget Item not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Budget management is not permitted.';
  end if;

  update public.budget_items as budget_item
  set
    category_id = p_category_id,
    supplier_id = p_supplier_id,
    name = pg_catalog.btrim(p_name),
    description = p_description,
    estimated_amount = p_estimated_amount,
    actual_amount = p_actual_amount,
    notes = p_notes,
    status = p_status
  where budget_item.id = p_budget_item_id;

  return p_budget_item_id;
end;
$function$;

create function public.create_supplier_payment(
  p_wedding_id uuid,
  p_supplier_id uuid,
  p_budget_item_id uuid,
  p_amount numeric,
  p_due_date date,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_payment_id uuid;
begin
  if not private.can_manage_wedding_finances(p_wedding_id) then
    raise exception using errcode = '42501', message = 'Payment management is not permitted.';
  end if;

  insert into public.supplier_payments (
    wedding_id,
    supplier_id,
    budget_item_id,
    amount,
    due_date,
    payment_method,
    reference_number,
    notes
  )
  values (
    p_wedding_id,
    p_supplier_id,
    p_budget_item_id,
    p_amount,
    p_due_date,
    nullif(pg_catalog.btrim(p_payment_method), ''),
    nullif(pg_catalog.btrim(p_reference_number), ''),
    p_notes
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$function$;

create function public.update_supplier_payment(
  p_payment_id uuid,
  p_budget_item_id uuid,
  p_amount numeric,
  p_due_date date,
  p_payment_method text,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_status public.supplier_payment_status;
begin
  select payment.wedding_id, payment.status
  into v_wedding_id, v_status
  from public.supplier_payments as payment
  where payment.id = p_payment_id;

  if not found then
    raise exception using errcode = '22023', message = 'Payment not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Payment management is not permitted.';
  end if;

  if v_status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'Only a pending Payment can change its financial details.';
  end if;

  update public.supplier_payments as payment
  set
    budget_item_id = p_budget_item_id,
    amount = p_amount,
    due_date = p_due_date,
    payment_method = nullif(pg_catalog.btrim(p_payment_method), ''),
    reference_number = nullif(pg_catalog.btrim(p_reference_number), ''),
    notes = p_notes
  where payment.id = p_payment_id;

  return p_payment_id;
end;
$function$;

create function public.mark_supplier_payment_paid(
  p_payment_id uuid,
  p_paid_at timestamptz default now(),
  p_payment_method text default null,
  p_reference_number text default null
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_status public.supplier_payment_status;
  v_paid_at timestamptz;
begin
  select payment.wedding_id, payment.status, payment.paid_at
  into v_wedding_id, v_status, v_paid_at
  from public.supplier_payments as payment
  where payment.id = p_payment_id;

  if not found then
    raise exception using errcode = '22023', message = 'Payment not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Payment management is not permitted.';
  end if;

  if v_status = 'CANCELLED' then
    raise exception using errcode = '22023', message = 'A cancelled Payment cannot be marked paid.';
  end if;

  if v_status = 'PAID' then
    return v_paid_at;
  end if;

  update public.supplier_payments as payment
  set
    status = 'PAID',
    paid_at = p_paid_at,
    cancelled_at = null,
    payment_method = coalesce(
      nullif(pg_catalog.btrim(p_payment_method), ''),
      payment.payment_method
    ),
    reference_number = coalesce(
      nullif(pg_catalog.btrim(p_reference_number), ''),
      payment.reference_number
    )
  where payment.id = p_payment_id;

  return p_paid_at;
end;
$function$;

create function public.mark_supplier_payment_unpaid(
  p_payment_id uuid
)
returns public.supplier_payment_status
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_status public.supplier_payment_status;
begin
  select payment.wedding_id, payment.status
  into v_wedding_id, v_status
  from public.supplier_payments as payment
  where payment.id = p_payment_id;

  if not found then
    raise exception using errcode = '22023', message = 'Payment not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Payment management is not permitted.';
  end if;

  if v_status = 'CANCELLED' then
    raise exception using errcode = '22023', message = 'A cancelled Payment cannot be reopened.';
  end if;

  update public.supplier_payments as payment
  set
    status = 'PENDING',
    paid_at = null,
    cancelled_at = null
  where payment.id = p_payment_id
    and payment.status = 'PAID';

  return 'PENDING'::public.supplier_payment_status;
end;
$function$;

create function public.cancel_supplier_payment(
  p_payment_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
  v_status public.supplier_payment_status;
  v_cancelled_at timestamptz;
begin
  select payment.wedding_id, payment.status, payment.cancelled_at
  into v_wedding_id, v_status, v_cancelled_at
  from public.supplier_payments as payment
  where payment.id = p_payment_id;

  if not found then
    raise exception using errcode = '22023', message = 'Payment not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Payment management is not permitted.';
  end if;

  if v_status = 'CANCELLED' then
    return v_cancelled_at;
  end if;

  v_cancelled_at := pg_catalog.now();

  update public.supplier_payments as payment
  set
    status = 'CANCELLED',
    cancelled_at = v_cancelled_at
  where payment.id = p_payment_id;

  return v_cancelled_at;
end;
$function$;

create function public.link_supplier_contract_attachment(
  p_supplier_id uuid,
  p_attachment_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select supplier.wedding_id
  into v_wedding_id
  from public.suppliers as supplier
  where supplier.id = p_supplier_id;

  if not found then
    raise exception using errcode = '22023', message = 'Supplier not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Contract Attachment linking is not permitted.';
  end if;

  insert into public.supplier_contract_attachments (
    wedding_id,
    supplier_id,
    attachment_id
  )
  values (
    v_wedding_id,
    p_supplier_id,
    p_attachment_id
  )
  on conflict do nothing;

  return found;
end;
$function$;

create function public.link_payment_receipt_attachment(
  p_payment_id uuid,
  p_attachment_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_wedding_id uuid;
begin
  select payment.wedding_id
  into v_wedding_id
  from public.supplier_payments as payment
  where payment.id = p_payment_id;

  if not found then
    raise exception using errcode = '22023', message = 'Payment not found.';
  end if;

  if not private.can_manage_wedding_finances(v_wedding_id) then
    raise exception using errcode = '42501', message = 'Receipt Attachment linking is not permitted.';
  end if;

  insert into public.payment_receipt_attachments (
    wedding_id,
    payment_id,
    attachment_id
  )
  values (
    v_wedding_id,
    p_payment_id,
    p_attachment_id
  )
  on conflict do nothing;

  return found;
end;
$function$;

alter table public.suppliers enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_contract_attachments enable row level security;
alter table public.payment_receipt_attachments enable row level security;

create policy suppliers_select_member
on public.suppliers
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy suppliers_insert_manager
on public.suppliers
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy suppliers_update_manager
on public.suppliers
for update
to authenticated
using ((select private.can_manage_wedding_finances(wedding_id)))
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy budget_categories_select_member
on public.budget_categories
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy budget_categories_insert_manager
on public.budget_categories
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy budget_categories_update_manager
on public.budget_categories
for update
to authenticated
using ((select private.can_manage_wedding_finances(wedding_id)))
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy budget_items_select_member
on public.budget_items
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy budget_items_insert_manager
on public.budget_items
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy budget_items_update_manager
on public.budget_items
for update
to authenticated
using ((select private.can_manage_wedding_finances(wedding_id)))
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy supplier_payments_select_member
on public.supplier_payments
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy supplier_payments_insert_manager
on public.supplier_payments
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy supplier_payments_update_manager
on public.supplier_payments
for update
to authenticated
using ((select private.can_manage_wedding_finances(wedding_id)))
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy supplier_contract_attachments_select_member
on public.supplier_contract_attachments
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy supplier_contract_attachments_insert_manager
on public.supplier_contract_attachments
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create policy payment_receipt_attachments_select_member
on public.payment_receipt_attachments
for select
to authenticated
using ((select private.has_active_wedding_membership(wedding_id)));

create policy payment_receipt_attachments_insert_manager
on public.payment_receipt_attachments
for insert
to authenticated
with check ((select private.can_manage_wedding_finances(wedding_id)));

create view public.supplier_payment_schedule
with (security_invoker = true)
as
select
  payment.id,
  payment.wedding_id,
  payment.supplier_id,
  payment.budget_item_id,
  payment.amount,
  payment.due_date,
  payment.paid_at,
  case
    when payment.status = 'PENDING'
      and payment.due_date < current_date
      then 'OVERDUE'::public.supplier_payment_status
    else payment.status
  end as status,
  payment.status as stored_status,
  payment.payment_method,
  payment.reference_number,
  payment.notes,
  payment.cancelled_at,
  payment.created_at,
  payment.updated_at
from public.supplier_payments as payment;

create view public.wedding_budget_totals
with (security_invoker = true)
as
select
  wedding.id as wedding_id,
  wedding.currency_code,
  count(budget_item.id) filter (
    where budget_item.status in ('PLANNED', 'CONFIRMED')
  )::bigint as active_item_count,
  coalesce(sum(budget_item.estimated_amount) filter (
    where budget_item.status in ('PLANNED', 'CONFIRMED')
  ), 0::numeric)::numeric(14, 2) as estimated_total,
  coalesce(sum(budget_item.actual_amount) filter (
    where budget_item.status in ('PLANNED', 'CONFIRMED')
  ), 0::numeric)::numeric(14, 2) as actual_total
from public.weddings as wedding
left join public.budget_items as budget_item
  on budget_item.wedding_id = wedding.id
group by wedding.id, wedding.currency_code;

create view public.wedding_payment_totals
with (security_invoker = true)
as
select
  wedding.id as wedding_id,
  wedding.currency_code,
  coalesce(sum(payment.amount) filter (
    where payment.status <> 'CANCELLED'
  ), 0::numeric)::numeric(14, 2) as scheduled_total,
  coalesce(sum(payment.amount) filter (
    where payment.status = 'PAID'
  ), 0::numeric)::numeric(14, 2) as paid_total,
  coalesce(sum(payment.amount) filter (
    where payment.status = 'PENDING'
      and payment.due_date >= current_date
  ), 0::numeric)::numeric(14, 2) as pending_total,
  coalesce(sum(payment.amount) filter (
    where payment.status = 'PENDING'
      and payment.due_date < current_date
  ), 0::numeric)::numeric(14, 2) as overdue_total
from public.weddings as wedding
left join public.supplier_payments as payment
  on payment.wedding_id = wedding.id
group by wedding.id, wedding.currency_code;

revoke all on table public.suppliers,
  public.budget_categories,
  public.budget_items,
  public.supplier_payments,
  public.supplier_contract_attachments,
  public.payment_receipt_attachments,
  public.supplier_payment_schedule,
  public.wedding_budget_totals,
  public.wedding_payment_totals
from public, anon, authenticated, service_role;

grant select on table public.suppliers,
  public.budget_categories,
  public.budget_items,
  public.supplier_payments,
  public.supplier_contract_attachments,
  public.payment_receipt_attachments,
  public.supplier_payment_schedule,
  public.wedding_budget_totals,
  public.wedding_payment_totals
to authenticated;

grant insert (
  wedding_id,
  name,
  category,
  contact_name,
  email,
  phone,
  website,
  notes,
  status
),
update (
  name,
  category,
  contact_name,
  email,
  phone,
  website,
  notes,
  status
)
on table public.suppliers
to authenticated;

grant insert (
  wedding_id,
  name,
  description,
  sort_order,
  archived_at
),
update (
  name,
  description,
  sort_order,
  archived_at
)
on table public.budget_categories
to authenticated;

grant insert (
  wedding_id,
  category_id,
  supplier_id,
  name,
  description,
  estimated_amount,
  actual_amount,
  notes,
  status
),
update (
  category_id,
  supplier_id,
  name,
  description,
  estimated_amount,
  actual_amount,
  notes,
  status
)
on table public.budget_items
to authenticated;

grant insert (
  wedding_id,
  supplier_id,
  budget_item_id,
  amount,
  due_date,
  payment_method,
  reference_number,
  notes
),
update (
  budget_item_id,
  amount,
  due_date,
  paid_at,
  status,
  payment_method,
  reference_number,
  notes,
  cancelled_at
)
on table public.supplier_payments
to authenticated;

grant insert (wedding_id, supplier_id, attachment_id)
on table public.supplier_contract_attachments
to authenticated;

grant insert (wedding_id, payment_id, attachment_id)
on table public.payment_receipt_attachments
to authenticated;

grant update (currency_code)
on table public.weddings
to authenticated;

grant select, insert, update, delete
on table public.suppliers,
  public.budget_categories,
  public.budget_items,
  public.supplier_payments,
  public.supplier_contract_attachments,
  public.payment_receipt_attachments
to service_role;

grant select on table public.supplier_payment_schedule,
  public.wedding_budget_totals,
  public.wedding_payment_totals
to service_role;

revoke all on type public.supplier_status,
  public.budget_item_status,
  public.supplier_payment_status
from public, anon, authenticated, service_role;

grant usage on type public.supplier_status,
  public.budget_item_status,
  public.supplier_payment_status
to authenticated, service_role;

revoke execute on function private.can_manage_wedding_finances(uuid),
  private.enforce_supplier_payment_lifecycle(),
  private.enforce_financial_attachment_link()
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_wedding_finances(uuid)
to authenticated;

revoke execute on function public.create_supplier(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.supplier_status
),
public.update_supplier(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.supplier_status
),
public.create_budget_item(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  public.budget_item_status
),
public.update_budget_item(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  public.budget_item_status
),
public.create_supplier_payment(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text
),
public.update_supplier_payment(
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text
),
public.mark_supplier_payment_paid(uuid, timestamptz, text, text),
public.mark_supplier_payment_unpaid(uuid),
public.cancel_supplier_payment(uuid),
public.link_supplier_contract_attachment(uuid, uuid),
public.link_payment_receipt_attachment(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_supplier(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.supplier_status
),
public.update_supplier(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.supplier_status
),
public.create_budget_item(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  public.budget_item_status
),
public.update_budget_item(
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  public.budget_item_status
),
public.create_supplier_payment(
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text
),
public.update_supplier_payment(
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text
),
public.mark_supplier_payment_paid(uuid, timestamptz, text, text),
public.mark_supplier_payment_unpaid(uuid),
public.cancel_supplier_payment(uuid),
public.link_supplier_contract_attachment(uuid, uuid),
public.link_payment_receipt_attachment(uuid, uuid)
to authenticated, service_role;

comment on column public.weddings.currency_code is
  'ISO 4217-style three-letter currency code for this Wedding. PHP is the V1 default, not a global invariant.';

comment on table public.suppliers is
  'Wedding-scoped supplier records. Supplier lifecycle is independent from Budget Items and Payment installments.';

comment on table public.budget_items is
  'Wedding budget allocations and manual planned/actual costs. Totals are derived; Supplier linkage is optional.';

comment on table public.supplier_payments is
  'Supplier installment transactions. OVERDUE is never stored; it is derived from PENDING plus due_date in supplier_payment_schedule.';

comment on table public.supplier_contract_attachments is
  'Typed same-Wedding links from Suppliers to centralized FINANCIAL_PRIVATE Attachment metadata.';

comment on table public.payment_receipt_attachments is
  'Typed same-Wedding links from Supplier Payments to centralized FINANCIAL_PRIVATE Attachment metadata.';

comment on view public.wedding_budget_totals is
  'Derived totals from active Budget Items only. Supplier Payment transactions are deliberately not duplicated into Budget totals.';

comment on function private.can_manage_wedding_finances(uuid) is
  'Allows an active Owner, active Full Coordinator, or the valid temporary coordinator-managed controller to manage Suppliers, Budget, and Payments.';

commit;
