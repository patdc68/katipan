begin;

create domain public.normalized_hex_color as text
  constraint normalized_hex_color_format_check
  check (value ~ '^#[0-9A-F]{6}$');

create table public.wedding_motifs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  title text not null,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_motifs_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_motifs_wedding_id_key
    unique (wedding_id),
  constraint wedding_motifs_wedding_id_id_key
    unique (wedding_id, id),
  constraint wedding_motifs_title_trimmed_check
    check (title = pg_catalog.btrim(title) and title <> '')
);

create table public.motif_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  motif_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint motif_colors_motif_same_wedding_fkey
    foreign key (wedding_id, motif_id)
    references public.wedding_motifs (wedding_id, id)
    on delete cascade,
  constraint motif_colors_wedding_motif_sort_key
    unique (wedding_id, motif_id, sort_order),
  constraint motif_colors_wedding_motif_color_key
    unique (wedding_id, motif_id, color_hex),
  constraint motif_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint motif_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.wedding_dress_codes (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  title text not null,
  description text,
  venue_advice text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_dress_codes_wedding_id_fkey
    foreign key (wedding_id)
    references public.weddings (id)
    on delete cascade,
  constraint wedding_dress_codes_wedding_id_key
    unique (wedding_id),
  constraint wedding_dress_codes_wedding_id_id_key
    unique (wedding_id, id),
  constraint wedding_dress_codes_title_trimmed_check
    check (title = pg_catalog.btrim(title) and title <> '')
);

create table public.dress_code_recommended_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  dress_code_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dress_code_recommended_colors_code_same_wedding_fkey
    foreign key (wedding_id, dress_code_id)
    references public.wedding_dress_codes (wedding_id, id)
    on delete cascade,
  constraint dress_code_recommended_colors_parent_sort_key
    unique (wedding_id, dress_code_id, sort_order),
  constraint dress_code_recommended_colors_parent_color_key
    unique (wedding_id, dress_code_id, color_hex),
  constraint dress_code_recommended_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint dress_code_recommended_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.dress_code_avoid_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  dress_code_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dress_code_avoid_colors_code_same_wedding_fkey
    foreign key (wedding_id, dress_code_id)
    references public.wedding_dress_codes (wedding_id, id)
    on delete cascade,
  constraint dress_code_avoid_colors_parent_sort_key
    unique (wedding_id, dress_code_id, sort_order),
  constraint dress_code_avoid_colors_parent_color_key
    unique (wedding_id, dress_code_id, color_hex),
  constraint dress_code_avoid_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint dress_code_avoid_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.attire_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  dress_code_id uuid not null,
  title text not null,
  description text,
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attire_groups_dress_code_same_wedding_fkey
    foreign key (wedding_id, dress_code_id)
    references public.wedding_dress_codes (wedding_id, id)
    on delete cascade,
  constraint attire_groups_wedding_id_id_key
    unique (wedding_id, id),
  constraint attire_groups_title_trimmed_check
    check (title = pg_catalog.btrim(title) and title <> ''),
  constraint attire_groups_sort_order_check
    check (sort_order >= 0)
);

create unique index attire_groups_code_normalized_title_idx
  on public.attire_groups (wedding_id, dress_code_id, pg_catalog.lower(title));

create index attire_groups_code_sort_idx
  on public.attire_groups (wedding_id, dress_code_id, sort_order, id);

create table public.attire_group_recommended_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  attire_group_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attire_group_recommended_colors_group_same_wedding_fkey
    foreign key (wedding_id, attire_group_id)
    references public.attire_groups (wedding_id, id)
    on delete cascade,
  constraint attire_group_recommended_colors_parent_sort_key
    unique (wedding_id, attire_group_id, sort_order),
  constraint attire_group_recommended_colors_parent_color_key
    unique (wedding_id, attire_group_id, color_hex),
  constraint attire_group_recommended_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint attire_group_recommended_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.attire_group_avoid_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  attire_group_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attire_group_avoid_colors_group_same_wedding_fkey
    foreign key (wedding_id, attire_group_id)
    references public.attire_groups (wedding_id, id)
    on delete cascade,
  constraint attire_group_avoid_colors_parent_sort_key
    unique (wedding_id, attire_group_id, sort_order),
  constraint attire_group_avoid_colors_parent_color_key
    unique (wedding_id, attire_group_id, color_hex),
  constraint attire_group_avoid_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint attire_group_avoid_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.attire_group_guest_targets (
  wedding_id uuid not null,
  attire_group_id uuid not null,
  guest_id uuid not null,
  created_at timestamptz not null default now(),
  constraint attire_group_guest_targets_pkey
    primary key (wedding_id, attire_group_id, guest_id),
  constraint attire_group_guest_targets_group_same_wedding_fkey
    foreign key (wedding_id, attire_group_id)
    references public.attire_groups (wedding_id, id)
    on delete cascade,
  constraint attire_group_guest_targets_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade
);

create index attire_group_guest_targets_guest_idx
  on public.attire_group_guest_targets (wedding_id, guest_id);

create table public.attire_group_entourage_role_targets (
  wedding_id uuid not null,
  attire_group_id uuid not null,
  entourage_role_id uuid not null,
  created_at timestamptz not null default now(),
  constraint attire_group_entourage_role_targets_pkey
    primary key (wedding_id, attire_group_id, entourage_role_id),
  constraint attire_group_entourage_role_targets_group_same_wedding_fkey
    foreign key (wedding_id, attire_group_id)
    references public.attire_groups (wedding_id, id)
    on delete cascade,
  constraint attire_group_entourage_role_targets_role_same_wedding_fkey
    foreign key (wedding_id, entourage_role_id)
    references public.entourage_roles (wedding_id, id)
    on delete cascade
);

create index attire_group_entourage_role_targets_role_idx
  on public.attire_group_entourage_role_targets (wedding_id, entourage_role_id);

create table public.guest_attire_guidance (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  guest_id uuid not null,
  title text,
  instructions text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_attire_guidance_guest_same_wedding_fkey
    foreign key (wedding_id, guest_id)
    references public.guests (wedding_id, id)
    on delete cascade,
  constraint guest_attire_guidance_wedding_guest_key
    unique (wedding_id, guest_id),
  constraint guest_attire_guidance_wedding_id_id_key
    unique (wedding_id, id),
  constraint guest_attire_guidance_title_trimmed_check
    check (title is null or (title = pg_catalog.btrim(title) and title <> '')),
  constraint guest_attire_guidance_instructions_trimmed_check
    check (instructions = pg_catalog.btrim(instructions) and instructions <> '')
);

create table public.guest_attire_recommended_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  guest_attire_guidance_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_attire_recommended_colors_guidance_same_wedding_fkey
    foreign key (wedding_id, guest_attire_guidance_id)
    references public.guest_attire_guidance (wedding_id, id)
    on delete cascade,
  constraint guest_attire_recommended_colors_parent_sort_key
    unique (wedding_id, guest_attire_guidance_id, sort_order),
  constraint guest_attire_recommended_colors_parent_color_key
    unique (wedding_id, guest_attire_guidance_id, color_hex),
  constraint guest_attire_recommended_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint guest_attire_recommended_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.guest_attire_avoid_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null,
  guest_attire_guidance_id uuid not null,
  color_hex public.normalized_hex_color not null,
  name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_attire_avoid_colors_guidance_same_wedding_fkey
    foreign key (wedding_id, guest_attire_guidance_id)
    references public.guest_attire_guidance (wedding_id, id)
    on delete cascade,
  constraint guest_attire_avoid_colors_parent_sort_key
    unique (wedding_id, guest_attire_guidance_id, sort_order),
  constraint guest_attire_avoid_colors_parent_color_key
    unique (wedding_id, guest_attire_guidance_id, color_hex),
  constraint guest_attire_avoid_colors_name_trimmed_check
    check (name is null or (name = pg_catalog.btrim(name) and name <> '')),
  constraint guest_attire_avoid_colors_sort_order_check
    check (sort_order >= 0)
);

create table public.motif_inspiration_attachments (
  wedding_id uuid not null,
  motif_id uuid not null,
  attachment_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint motif_inspiration_attachments_pkey
    primary key (wedding_id, motif_id, attachment_id),
  constraint motif_inspiration_attachments_motif_same_wedding_fkey
    foreign key (wedding_id, motif_id)
    references public.wedding_motifs (wedding_id, id)
    on delete cascade,
  constraint motif_inspiration_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments (wedding_id, id),
  constraint motif_inspiration_attachments_parent_sort_key
    unique (wedding_id, motif_id, sort_order),
  constraint motif_inspiration_attachments_sort_order_check
    check (sort_order >= 0)
);

create index motif_inspiration_attachments_attachment_idx
  on public.motif_inspiration_attachments (wedding_id, attachment_id);

create table public.dress_code_inspiration_attachments (
  wedding_id uuid not null,
  dress_code_id uuid not null,
  attachment_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint dress_code_inspiration_attachments_pkey
    primary key (wedding_id, dress_code_id, attachment_id),
  constraint dress_code_inspiration_attachments_code_same_wedding_fkey
    foreign key (wedding_id, dress_code_id)
    references public.wedding_dress_codes (wedding_id, id)
    on delete cascade,
  constraint dress_code_inspiration_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments (wedding_id, id),
  constraint dress_code_inspiration_attachments_parent_sort_key
    unique (wedding_id, dress_code_id, sort_order),
  constraint dress_code_inspiration_attachments_sort_order_check
    check (sort_order >= 0)
);

create index dress_code_inspiration_attachments_attachment_idx
  on public.dress_code_inspiration_attachments (wedding_id, attachment_id);

create table public.attire_group_inspiration_attachments (
  wedding_id uuid not null,
  attire_group_id uuid not null,
  attachment_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint attire_group_inspiration_attachments_pkey
    primary key (wedding_id, attire_group_id, attachment_id),
  constraint attire_group_inspiration_attachments_group_same_wedding_fkey
    foreign key (wedding_id, attire_group_id)
    references public.attire_groups (wedding_id, id)
    on delete cascade,
  constraint attire_group_inspiration_attachments_attachment_same_wedding_fkey
    foreign key (wedding_id, attachment_id)
    references public.attachments (wedding_id, id),
  constraint attire_group_inspiration_attachments_parent_sort_key
    unique (wedding_id, attire_group_id, sort_order),
  constraint attire_group_inspiration_attachments_sort_order_check
    check (sort_order >= 0)
);

create index attire_group_inspiration_attachments_attachment_idx
  on public.attire_group_inspiration_attachments (wedding_id, attachment_id);

create function private.can_manage_wedding_styling(
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

create function private.enforce_inspiration_attachment_link()
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

  if v_visibility not in ('GUEST_VISIBLE', 'WEDDING_MEMBER_PRIVATE') then
    raise exception using
      errcode = '23514',
      constraint = 'inspiration_attachment_visibility_check',
      message = 'Styling inspiration Attachments must use GUEST_VISIBLE or WEDDING_MEMBER_PRIVATE visibility.';
  end if;

  if v_status = 'DELETED' then
    raise exception using
      errcode = '23514',
      constraint = 'inspiration_attachment_not_deleted_check',
      message = 'Deleted Attachments cannot be linked as styling inspiration.';
  end if;

  return new;
end;
$function$;

create function private.protect_linked_inspiration_attachment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (
    new.visibility not in ('GUEST_VISIBLE', 'WEDDING_MEMBER_PRIVATE')
    or new.status = 'DELETED'
  ) and (
    exists (
      select 1
      from public.motif_inspiration_attachments as link
      where link.wedding_id = new.wedding_id
        and link.attachment_id = new.id
    )
    or exists (
      select 1
      from public.dress_code_inspiration_attachments as link
      where link.wedding_id = new.wedding_id
        and link.attachment_id = new.id
    )
    or exists (
      select 1
      from public.attire_group_inspiration_attachments as link
      where link.wedding_id = new.wedding_id
        and link.attachment_id = new.id
    )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'linked_inspiration_attachment_eligibility_check',
      message = 'A linked styling inspiration Attachment must remain non-deleted and GUEST_VISIBLE or WEDDING_MEMBER_PRIVATE.';
  end if;

  return new;
end;
$function$;

create trigger motif_inspiration_attachments_enforce_eligibility
before insert or update on public.motif_inspiration_attachments
for each row
execute function private.enforce_inspiration_attachment_link();

create trigger dress_code_inspiration_attachments_enforce_eligibility
before insert or update on public.dress_code_inspiration_attachments
for each row
execute function private.enforce_inspiration_attachment_link();

create trigger attire_group_inspiration_attachments_enforce_eligibility
before insert or update on public.attire_group_inspiration_attachments
for each row
execute function private.enforce_inspiration_attachment_link();

create trigger attachments_protect_linked_inspiration_eligibility
before update of visibility, status on public.attachments
for each row
execute function private.protect_linked_inspiration_attachment();

create trigger wedding_motifs_set_updated_at
before update on public.wedding_motifs
for each row execute function private.set_updated_at();

create trigger motif_colors_set_updated_at
before update on public.motif_colors
for each row execute function private.set_updated_at();

create trigger wedding_dress_codes_set_updated_at
before update on public.wedding_dress_codes
for each row execute function private.set_updated_at();

create trigger dress_code_recommended_colors_set_updated_at
before update on public.dress_code_recommended_colors
for each row execute function private.set_updated_at();

create trigger dress_code_avoid_colors_set_updated_at
before update on public.dress_code_avoid_colors
for each row execute function private.set_updated_at();

create trigger attire_groups_set_updated_at
before update on public.attire_groups
for each row execute function private.set_updated_at();

create trigger attire_group_recommended_colors_set_updated_at
before update on public.attire_group_recommended_colors
for each row execute function private.set_updated_at();

create trigger attire_group_avoid_colors_set_updated_at
before update on public.attire_group_avoid_colors
for each row execute function private.set_updated_at();

create trigger guest_attire_guidance_set_updated_at
before update on public.guest_attire_guidance
for each row execute function private.set_updated_at();

create trigger guest_attire_recommended_colors_set_updated_at
before update on public.guest_attire_recommended_colors
for each row execute function private.set_updated_at();

create trigger guest_attire_avoid_colors_set_updated_at
before update on public.guest_attire_avoid_colors
for each row execute function private.set_updated_at();

alter table public.wedding_motifs enable row level security;
alter table public.motif_colors enable row level security;
alter table public.wedding_dress_codes enable row level security;
alter table public.dress_code_recommended_colors enable row level security;
alter table public.dress_code_avoid_colors enable row level security;
alter table public.attire_groups enable row level security;
alter table public.attire_group_recommended_colors enable row level security;
alter table public.attire_group_avoid_colors enable row level security;
alter table public.attire_group_guest_targets enable row level security;
alter table public.attire_group_entourage_role_targets enable row level security;
alter table public.guest_attire_guidance enable row level security;
alter table public.guest_attire_recommended_colors enable row level security;
alter table public.guest_attire_avoid_colors enable row level security;
alter table public.motif_inspiration_attachments enable row level security;
alter table public.dress_code_inspiration_attachments enable row level security;
alter table public.attire_group_inspiration_attachments enable row level security;

do $policies$
declare
  v_table text;
begin
  foreach v_table in array array[
    'wedding_motifs',
    'motif_colors',
    'wedding_dress_codes',
    'dress_code_recommended_colors',
    'dress_code_avoid_colors',
    'attire_groups',
    'attire_group_recommended_colors',
    'attire_group_avoid_colors',
    'attire_group_guest_targets',
    'attire_group_entourage_role_targets',
    'guest_attire_guidance',
    'guest_attire_recommended_colors',
    'guest_attire_avoid_colors',
    'motif_inspiration_attachments',
    'dress_code_inspiration_attachments',
    'attire_group_inspiration_attachments'
  ]
  loop
    execute pg_catalog.format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_active_wedding_membership(wedding_id)))',
      v_table || '_select_member',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_manage_wedding_styling(wedding_id)))',
      v_table || '_insert_manager',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_manage_wedding_styling(wedding_id))) with check ((select private.can_manage_wedding_styling(wedding_id)))',
      v_table || '_update_manager',
      v_table
    );

    execute pg_catalog.format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_manage_wedding_styling(wedding_id)))',
      v_table || '_delete_manager',
      v_table
    );
  end loop;
end;
$policies$;

revoke all on table public.wedding_motifs,
  public.motif_colors,
  public.wedding_dress_codes,
  public.dress_code_recommended_colors,
  public.dress_code_avoid_colors,
  public.attire_groups,
  public.attire_group_recommended_colors,
  public.attire_group_avoid_colors,
  public.attire_group_guest_targets,
  public.attire_group_entourage_role_targets,
  public.guest_attire_guidance,
  public.guest_attire_recommended_colors,
  public.guest_attire_avoid_colors,
  public.motif_inspiration_attachments,
  public.dress_code_inspiration_attachments,
  public.attire_group_inspiration_attachments
from public, anon, authenticated, service_role;

grant select on table public.wedding_motifs,
  public.motif_colors,
  public.wedding_dress_codes,
  public.dress_code_recommended_colors,
  public.dress_code_avoid_colors,
  public.attire_groups,
  public.attire_group_recommended_colors,
  public.attire_group_avoid_colors,
  public.attire_group_guest_targets,
  public.attire_group_entourage_role_targets,
  public.guest_attire_guidance,
  public.guest_attire_recommended_colors,
  public.guest_attire_avoid_colors,
  public.motif_inspiration_attachments,
  public.dress_code_inspiration_attachments,
  public.attire_group_inspiration_attachments
to authenticated;

grant insert (wedding_id, title, description, notes),
  update (title, description, notes),
  delete
on table public.wedding_motifs
to authenticated;

grant insert (wedding_id, motif_id, color_hex, name, sort_order),
  update (color_hex, name, sort_order),
  delete
on table public.motif_colors
to authenticated;

grant insert (wedding_id, title, description, venue_advice, general_notes),
  update (title, description, venue_advice, general_notes),
  delete
on table public.wedding_dress_codes
to authenticated;

grant insert (wedding_id, dress_code_id, color_hex, name, sort_order),
  update (color_hex, name, sort_order),
  delete
on table public.dress_code_recommended_colors,
  public.dress_code_avoid_colors
to authenticated;

grant insert (wedding_id, dress_code_id, title, description, instructions, sort_order),
  update (title, description, instructions, sort_order),
  delete
on table public.attire_groups
to authenticated;

grant insert (wedding_id, attire_group_id, color_hex, name, sort_order),
  update (color_hex, name, sort_order),
  delete
on table public.attire_group_recommended_colors,
  public.attire_group_avoid_colors
to authenticated;

grant insert (wedding_id, attire_group_id, guest_id), delete
on table public.attire_group_guest_targets
to authenticated;

grant insert (wedding_id, attire_group_id, entourage_role_id), delete
on table public.attire_group_entourage_role_targets
to authenticated;

grant insert (wedding_id, guest_id, title, instructions, notes),
  update (title, instructions, notes),
  delete
on table public.guest_attire_guidance
to authenticated;

grant insert (wedding_id, guest_attire_guidance_id, color_hex, name, sort_order),
  update (color_hex, name, sort_order),
  delete
on table public.guest_attire_recommended_colors,
  public.guest_attire_avoid_colors
to authenticated;

grant insert (wedding_id, motif_id, attachment_id, sort_order),
  update (sort_order),
  delete
on table public.motif_inspiration_attachments
to authenticated;

grant insert (wedding_id, dress_code_id, attachment_id, sort_order),
  update (sort_order),
  delete
on table public.dress_code_inspiration_attachments
to authenticated;

grant insert (wedding_id, attire_group_id, attachment_id, sort_order),
  update (sort_order),
  delete
on table public.attire_group_inspiration_attachments
to authenticated;

grant select, insert, update, delete
on table public.wedding_motifs,
  public.motif_colors,
  public.wedding_dress_codes,
  public.dress_code_recommended_colors,
  public.dress_code_avoid_colors,
  public.attire_groups,
  public.attire_group_recommended_colors,
  public.attire_group_avoid_colors,
  public.attire_group_guest_targets,
  public.attire_group_entourage_role_targets,
  public.guest_attire_guidance,
  public.guest_attire_recommended_colors,
  public.guest_attire_avoid_colors,
  public.motif_inspiration_attachments,
  public.dress_code_inspiration_attachments,
  public.attire_group_inspiration_attachments
to service_role;

revoke all on domain public.normalized_hex_color
from public, anon, authenticated, service_role;

grant usage on domain public.normalized_hex_color
to authenticated, service_role;

revoke execute on function private.can_manage_wedding_styling(uuid),
  private.enforce_inspiration_attachment_link(),
  private.protect_linked_inspiration_attachment()
from public, anon, authenticated, service_role;

grant execute on function private.can_manage_wedding_styling(uuid)
to authenticated;

comment on domain public.normalized_hex_color is
  'Canonical uppercase #RRGGBB color value shared by motif and attire guidance without merging their semantic palettes.';

comment on table public.wedding_motifs is
  'One Wedding motif record. Motif colors are presentation identity and never imply Guest attire recommendations.';

comment on table public.wedding_dress_codes is
  'One Wedding-level general Guest dress guidance record, separate from the Wedding motif.';

comment on table public.attire_groups is
  'Custom Wedding attire guidance groups. Titles are free-form and do not encode ceremony, religion, nationality, or fixed entourage roles.';

comment on table public.attire_group_guest_targets is
  'Direct Attire Group targets for individual Guests. This relationship never changes Guest identity, RSVP, Seating, or check-in.';

comment on table public.attire_group_entourage_role_targets is
  'Attire Group targets for customizable Entourage Roles. This relationship never changes role assignments or Guest identity.';

comment on table public.guest_attire_guidance is
  'Optional Guest-specific attire guidance overlay. Effective guidance remains derived from general Dress Code, role/group targets, then this Guest-specific layer.';

comment on table public.motif_inspiration_attachments is
  'Typed same-Wedding links from a Motif to centralized eligible Attachment metadata.';

comment on table public.dress_code_inspiration_attachments is
  'Typed same-Wedding links from general Dress Code guidance to centralized eligible Attachment metadata.';

comment on table public.attire_group_inspiration_attachments is
  'Typed same-Wedding links from an Attire Group to centralized eligible Attachment metadata.';

comment on function private.can_manage_wedding_styling(uuid) is
  'Allows an active Owner, active Full Coordinator, or the valid temporary coordinator-managed controller to manage Motif, Dress Code, and Attire guidance.';

commit;
