begin;

create type public.attachment_visibility as enum (
  'PUBLIC',
  'GUEST_VISIBLE',
  'WEDDING_MEMBER_PRIVATE',
  'OWNER_PRIVATE',
  'FINANCIAL_PRIVATE'
);

create type public.attachment_status as enum (
  'PENDING_UPLOAD',
  'AVAILABLE',
  'DELETED'
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  uploaded_by_user_id uuid,
  bucket_id text not null default 'wedding-files',
  object_path text not null,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint,
  checksum_sha256 text,
  visibility public.attachment_visibility not null,
  status public.attachment_status not null default 'PENDING_UPLOAD',
  available_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint attachments_uploaded_by_user_id_fkey
    foreign key (uploaded_by_user_id)
    references auth.users (id)
    on delete set null,
  constraint attachments_bucket_id_fixed
    check (bucket_id = 'wedding-files'),
  constraint attachments_bucket_id_not_blank
    check (btrim(bucket_id) <> ''),
  constraint attachments_object_path_not_blank
    check (btrim(object_path) <> ''),
  constraint attachments_original_filename_not_blank
    check (btrim(original_filename) <> ''),
  constraint attachments_content_type_not_blank
    check (btrim(content_type) <> ''),
  constraint attachments_size_bytes_nonnegative
    check (size_bytes is null or size_bytes >= 0),
  constraint attachments_checksum_sha256_format
    check (
      checksum_sha256 is null
      or checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  constraint attachments_status_timestamps_consistent
    check (
      (
        status = 'PENDING_UPLOAD'
        and available_at is null
        and deleted_at is null
      )
      or
      (
        status = 'AVAILABLE'
        and available_at is not null
        and deleted_at is null
      )
      or
      (
        status = 'DELETED'
        and deleted_at is not null
        and (available_at is null or deleted_at >= available_at)
      )
    )
);

create index attachments_wedding_id_idx
  on public.attachments (wedding_id);

create index attachments_wedding_status_idx
  on public.attachments (wedding_id, status);

create index attachments_wedding_visibility_idx
  on public.attachments (wedding_id, visibility);

create index attachments_uploaded_by_user_id_idx
  on public.attachments (uploaded_by_user_id)
  where uploaded_by_user_id is not null;

create unique index attachments_bucket_object_path_key
  on public.attachments (bucket_id, object_path);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'wedding-files',
  'wedding-files',
  false,
  null,
  null
);

create function private.enforce_attachment_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.wedding_id is distinct from old.wedding_id
     or new.bucket_id is distinct from old.bucket_id
     or new.object_path is distinct from old.object_path
     or (
       new.uploaded_by_user_id is distinct from old.uploaded_by_user_id
       and not (
         old.uploaded_by_user_id is not null
         and new.uploaded_by_user_id is null
       )
     )
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_reserved_identity_immutable',
      message = 'Reserved Attachment identity cannot be changed. Uploader identity may only be cleared by account deletion.';
  end if;

  if old.status = 'PENDING_UPLOAD'
     and new.status not in ('PENDING_UPLOAD', 'AVAILABLE', 'DELETED') then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_status_transition_valid',
      message = 'Invalid Attachment status transition.';
  elsif old.status = 'AVAILABLE'
        and new.status not in ('AVAILABLE', 'DELETED') then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_status_transition_valid',
      message = 'Invalid Attachment status transition.';
  elsif old.status = 'DELETED'
        and new.status <> 'DELETED' then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_status_transition_valid',
      message = 'Deleted Attachments cannot be restored.';
  end if;

  if old.available_at is not null
     and new.available_at is distinct from old.available_at then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_available_at_immutable',
      message = 'Attachment availability time cannot be changed after it is set.';
  end if;

  if old.deleted_at is not null
     and new.deleted_at is distinct from old.deleted_at then
    raise exception using
      errcode = '23514',
      constraint = 'attachments_deleted_at_immutable',
      message = 'Attachment deletion time cannot be changed after it is set.';
  end if;

  return new;
end;
$function$;

create trigger attachments_enforce_lifecycle
before update on public.attachments
for each row
execute function private.enforce_attachment_lifecycle();

create trigger attachments_set_updated_at
before update on public.attachments
for each row
execute function private.set_updated_at();

create function private.can_manage_attachment(
  p_wedding_id uuid,
  p_visibility public.attachment_visibility
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      (select private.controls_coordinator_managed_wedding(p_wedding_id))
      or exists (
        select 1
        from public.weddings as wedding
        join public.wedding_memberships as membership
          on membership.wedding_id = wedding.id
        where wedding.id = p_wedding_id
          and wedding.ownership_mode = 'COUPLE_OWNED'
          and membership.user_id = (select auth.uid())
          and membership.status = 'ACTIVE'
          and (
            membership.role = 'OWNER'
            or (
              membership.role = 'FULL_COORDINATOR'
              and p_visibility <> 'OWNER_PRIVATE'
            )
          )
      )
    );
$function$;

create function private.can_read_attachment(
  p_wedding_id uuid,
  p_visibility public.attachment_visibility
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and case p_visibility
      when 'PUBLIC' then
        (select private.has_active_wedding_membership(p_wedding_id))
      when 'GUEST_VISIBLE' then
        (select private.has_active_wedding_membership(p_wedding_id))
      when 'WEDDING_MEMBER_PRIVATE' then
        (select private.has_active_wedding_membership(p_wedding_id))
      when 'OWNER_PRIVATE' then
        (select private.controls_coordinator_managed_wedding(p_wedding_id))
        or (select private.has_active_wedding_role(
          p_wedding_id,
          array['OWNER']::public.wedding_membership_role[]
        ))
      when 'FINANCIAL_PRIVATE' then
        (select private.controls_coordinator_managed_wedding(p_wedding_id))
        or (select private.has_active_wedding_role(
          p_wedding_id,
          array['OWNER', 'FULL_COORDINATOR']::public.wedding_membership_role[]
        ))
      else false
    end;
$function$;

create function private.can_upload_reserved_storage_object(
  p_bucket_id text,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_bucket_id = 'wedding-files'
    and exists (
      select 1
      from public.attachments as attachment
      where attachment.bucket_id = p_bucket_id
        and attachment.object_path = p_object_path
        and attachment.status = 'PENDING_UPLOAD'
        and attachment.deleted_at is null
        and attachment.uploaded_by_user_id = (select auth.uid())
        and private.can_manage_attachment(
          attachment.wedding_id,
          attachment.visibility
        )
    );
$function$;

create function private.can_read_storage_object(
  p_bucket_id text,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_bucket_id = 'wedding-files'
    and exists (
      select 1
      from public.attachments as attachment
      where attachment.bucket_id = p_bucket_id
        and attachment.object_path = p_object_path
        and attachment.status = 'AVAILABLE'
        and attachment.deleted_at is null
        and private.can_read_attachment(
          attachment.wedding_id,
          attachment.visibility
        )
    );
$function$;

create function private.can_delete_storage_object(
  p_bucket_id text,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_bucket_id = 'wedding-files'
    and exists (
      select 1
      from public.attachments as attachment
      where attachment.bucket_id = p_bucket_id
        and attachment.object_path = p_object_path
        and attachment.status = 'DELETED'
        and attachment.deleted_at is not null
        and private.can_manage_attachment(
          attachment.wedding_id,
          attachment.visibility
        )
    );
$function$;

create function public.reserve_attachment(
  p_wedding_id uuid,
  p_original_filename text,
  p_content_type text,
  p_visibility public.attachment_visibility
)
returns table (
  attachment_id uuid,
  bucket_id text,
  object_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_attachment_id uuid := gen_random_uuid();
  v_object_path text;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_wedding_id is null
     or p_visibility is null
     or nullif(pg_catalog.btrim(p_original_filename), '') is null
     or nullif(pg_catalog.btrim(p_content_type), '') is null then
    raise exception using errcode = '22023', message = 'Valid Wedding, filename, content type, and visibility are required.';
  end if;

  if not private.can_manage_attachment(p_wedding_id, p_visibility) then
    raise exception using errcode = '42501', message = 'Attachment reservation is not permitted.';
  end if;

  v_object_path := pg_catalog.format(
    'weddings/%s/%s/%s',
    p_wedding_id,
    v_attachment_id,
    pg_catalog.encode(extensions.gen_random_bytes(32), 'hex')
  );

  insert into public.attachments (
    id,
    wedding_id,
    uploaded_by_user_id,
    bucket_id,
    object_path,
    original_filename,
    content_type,
    visibility,
    status
  )
  values (
    v_attachment_id,
    p_wedding_id,
    v_caller_user_id,
    'wedding-files',
    v_object_path,
    pg_catalog.btrim(p_original_filename),
    pg_catalog.btrim(p_content_type),
    p_visibility,
    'PENDING_UPLOAD'
  );

  return query
  select v_attachment_id, 'wedding-files'::text, v_object_path;
end;
$function$;

create function public.confirm_attachment_uploaded(
  p_attachment_id uuid,
  p_size_bytes bigint,
  p_checksum_sha256 text default null
)
returns table (
  attachment_id uuid,
  attachment_status public.attachment_status,
  available_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_attachment public.attachments%rowtype;
  v_checksum_sha256 text;
  v_available_at timestamptz;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_attachment_id is null or p_size_bytes is null or p_size_bytes < 0 then
    raise exception using errcode = '22023', message = 'Attachment ID and a nonnegative file size are required.';
  end if;

  if p_checksum_sha256 is not null then
    v_checksum_sha256 := pg_catalog.lower(pg_catalog.btrim(p_checksum_sha256));

    if v_checksum_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception using errcode = '22023', message = 'SHA-256 checksum must contain exactly 64 hexadecimal characters.';
    end if;
  end if;

  select attachment.*
  into v_attachment
  from public.attachments as attachment
  where attachment.id = p_attachment_id
  for update;

  if not found
     or not private.can_manage_attachment(
       v_attachment.wedding_id,
       v_attachment.visibility
     ) then
    raise exception using errcode = '42501', message = 'Attachment confirmation is not permitted.';
  end if;

  if v_attachment.status = 'DELETED' then
    raise exception using errcode = '22023', message = 'A deleted Attachment cannot be confirmed.';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = v_attachment.bucket_id
      and object.name = v_attachment.object_path
  ) then
    raise exception using errcode = '22023', message = 'The reserved Storage object does not exist.';
  end if;

  if v_attachment.status = 'AVAILABLE' then
    if v_attachment.size_bytes is distinct from p_size_bytes
       or v_attachment.checksum_sha256 is distinct from v_checksum_sha256 then
      raise exception using errcode = '22023', message = 'Attachment was already confirmed with different metadata.';
    end if;

    return query
    select v_attachment.id, v_attachment.status, v_attachment.available_at;
    return;
  end if;

  v_available_at := pg_catalog.now();

  update public.attachments as attachment
  set
    size_bytes = p_size_bytes,
    checksum_sha256 = v_checksum_sha256,
    status = 'AVAILABLE',
    available_at = v_available_at
  where attachment.id = v_attachment.id;

  return query
  select v_attachment.id, 'AVAILABLE'::public.attachment_status, v_available_at;
end;
$function$;

create function public.mark_attachment_deleted(
  p_attachment_id uuid
)
returns table (
  attachment_id uuid,
  attachment_status public.attachment_status,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller_user_id uuid := (select auth.uid());
  v_attachment public.attachments%rowtype;
  v_deleted_at timestamptz;
begin
  if v_caller_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select attachment.*
  into v_attachment
  from public.attachments as attachment
  where attachment.id = p_attachment_id
  for update;

  if not found
     or not private.can_manage_attachment(
       v_attachment.wedding_id,
       v_attachment.visibility
     ) then
    raise exception using errcode = '42501', message = 'Attachment deletion is not permitted.';
  end if;

  if v_attachment.status = 'DELETED' then
    return query
    select v_attachment.id, v_attachment.status, v_attachment.deleted_at;
    return;
  end if;

  v_deleted_at := pg_catalog.now();

  update public.attachments as attachment
  set
    status = 'DELETED',
    deleted_at = v_deleted_at
  where attachment.id = v_attachment.id;

  return query
  select v_attachment.id, 'DELETED'::public.attachment_status, v_deleted_at;
end;
$function$;

alter table public.attachments enable row level security;

create policy attachments_select_by_visibility
on public.attachments
for select
to authenticated
using (
  status = 'AVAILABLE'
  and deleted_at is null
  and (select private.can_read_attachment(wedding_id, visibility))
);

create policy wedding_files_insert_reserved
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'wedding-files'
  and (select private.can_upload_reserved_storage_object(bucket_id, name))
);

create policy wedding_files_select_available
on storage.objects
for select
to authenticated
using (
  bucket_id = 'wedding-files'
  and (
    (select private.can_read_storage_object(bucket_id, name))
    or (
      storage.allow_any_operation(array[
        'storage.object.delete',
        'storage.object.delete_many'
      ])
      and (select private.can_delete_storage_object(bucket_id, name))
    )
  )
);

create policy wedding_files_delete_marked
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'wedding-files'
  and (select private.can_delete_storage_object(bucket_id, name))
);

revoke all on table public.attachments
from public, anon, authenticated, service_role;

grant select on table public.attachments to authenticated;
grant select, insert, update, delete on table public.attachments to service_role;

revoke all on type public.attachment_visibility
from public, anon, authenticated, service_role;

revoke all on type public.attachment_status
from public, anon, authenticated, service_role;

grant usage on type public.attachment_visibility,
  public.attachment_status
to authenticated, service_role;

revoke execute on function private.enforce_attachment_lifecycle()
from public, anon, authenticated, service_role;

revoke execute on function private.can_manage_attachment(
  uuid,
  public.attachment_visibility
)
from public, anon, authenticated, service_role;

revoke execute on function private.can_read_attachment(
  uuid,
  public.attachment_visibility
)
from public, anon, authenticated, service_role;

revoke execute on function private.can_upload_reserved_storage_object(text, text)
from public, anon, authenticated, service_role;

revoke execute on function private.can_read_storage_object(text, text)
from public, anon, authenticated, service_role;

revoke execute on function private.can_delete_storage_object(text, text)
from public, anon, authenticated, service_role;

grant execute on function private.can_read_attachment(
  uuid,
  public.attachment_visibility
)
to authenticated;

grant execute on function private.can_upload_reserved_storage_object(text, text)
to authenticated;

grant execute on function private.can_read_storage_object(text, text)
to authenticated;

grant execute on function private.can_delete_storage_object(text, text)
to authenticated;

revoke execute on function public.reserve_attachment(
  uuid,
  text,
  text,
  public.attachment_visibility
)
from public, anon, authenticated, service_role;

revoke execute on function public.confirm_attachment_uploaded(uuid, bigint, text)
from public, anon, authenticated, service_role;

revoke execute on function public.mark_attachment_deleted(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.reserve_attachment(
  uuid,
  text,
  text,
  public.attachment_visibility
)
to authenticated;

grant execute on function public.confirm_attachment_uploaded(uuid, bigint, text)
to authenticated;

grant execute on function public.mark_attachment_deleted(uuid)
to authenticated;

comment on table public.attachments is
  'Wedding-scoped Supabase Storage metadata. File bytes and temporary access URLs are never stored here; durable object identity is bucket_id plus object_path.';

comment on type public.attachment_visibility is
  'KATIPAN business visibility. PUBLIC is only publication eligibility; every V1 object remains private in Supabase Storage.';

comment on function private.can_upload_reserved_storage_object(text, text) is
  'Private Storage RLS helper requiring an exact pending reservation, its original uploader, and current Wedding management authority.';

comment on function public.reserve_attachment(
  uuid,
  text,
  text,
  public.attachment_visibility
) is
  'SECURITY DEFINER is required because direct Attachment inserts are closed. It derives auth.uid(), validates current role and visibility authority, fixes the private bucket, and generates an opaque unique object path.';

comment on function public.confirm_attachment_uploaded(uuid, bigint, text) is
  'SECURITY DEFINER is required because direct Attachment updates are closed. It derives auth.uid(), locks and reauthorizes the reservation, verifies the exact Storage object exists, validates metadata, and performs an idempotent PENDING_UPLOAD to AVAILABLE transition.';

comment on function public.mark_attachment_deleted(uuid) is
  'SECURITY DEFINER is required because direct Attachment updates are closed. It derives auth.uid(), locks and reauthorizes the Attachment, and performs an idempotent logical deletion before Storage cleanup is permitted.';

commit;
