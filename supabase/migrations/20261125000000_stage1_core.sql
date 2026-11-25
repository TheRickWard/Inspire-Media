-- Stage 1: organisers, people, events, sessions, sections and program entries.
-- Every table has row level security (RLS) switched on, so the database itself
-- makes sure organisers only ever see and change their own competitions.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One profile per login. Created automatically when someone signs up.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  -- Platform admins (Rick's team) can see and manage every organiser.
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organisers (a business that runs competitions) and their staff
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact_email text,
  created_at timestamptz not null default now()
);

create type public.org_role as enum ('owner', 'staff');

create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create index organisation_members_user_idx on public.organisation_members (user_id);

-- ---------------------------------------------------------------------------
-- Competitions
-- ---------------------------------------------------------------------------

create type public.event_status as enum ('draft', 'published');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  status public.event_status not null default 'draft',
  venue_name text not null default '',
  venue_address text not null default '',
  starts_on date not null,
  ends_on date not null,
  entries_open_on date,
  entries_close_on date,
  music_due_on date,
  contact_email text not null default '',
  contact_phone text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index events_organisation_idx on public.events (organisation_id);

-- A session is usually one day, or a morning/afternoon block.
create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  session_date date,
  starts_at time,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

-- e.g. "Section 12 – Jazz Solo 10 Years & Under"
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid references public.event_sessions (id) on delete set null,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  genre text not null default '',
  age_group text not null default '',
  entry_fee_cents integer not null default 0 check (entry_fee_cents >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);

create index sections_event_idx on public.sections (event_id);

create type public.entry_status as enum ('entered', 'scratched');

-- One performance in the program.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  -- Text, so late entries can be numbered like "45A".
  item_number text not null check (length(trim(item_number)) > 0),
  performer_name text not null check (length(trim(performer_name)) > 0),
  studio_name text not null default '',
  routine_title text not null default '',
  status public.entry_status not null default 'entered',
  is_late_entry boolean not null default false,
  -- Running order within the whole event.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, item_number)
);

create index entries_event_position_idx on public.entries (event_id, position);
create index entries_section_idx on public.entries (section_id);

-- ---------------------------------------------------------------------------
-- Helper checks used by the security rules
-- ---------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org and m.user_id = (select auth.uid())
  );
$$;

create function public.is_org_owner(org uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.organisation_id = org and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- Can the current user manage this event? (organiser staff, or platform admin)
create function public.can_manage_event(ev uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.events e
    join public.organisation_members m on m.organisation_id = e.organisation_id
    where e.id = ev and m.user_id = (select auth.uid())
  );
$$;

create function public.is_event_published(ev uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = ev and e.status = 'published');
$$;

-- ---------------------------------------------------------------------------
-- Security rules
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.events enable row level security;
alter table public.event_sessions enable row level security;
alter table public.sections enable row level security;
alter table public.entries enable row level security;

-- Profiles: you see your own; organiser staff see their colleagues; admins see all.
create policy "profiles: read own, colleagues, or admin" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_platform_admin()
    or exists (
      select 1 from public.organisation_members mine
      join public.organisation_members theirs on theirs.organisation_id = mine.organisation_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- People may only change their own name, never their email or admin flag.
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- Organisations
create policy "organisations: members and admin read" on public.organisations
  for select to authenticated
  using (public.is_org_member(id) or public.is_platform_admin());

create policy "organisations: admin creates" on public.organisations
  for insert to authenticated
  with check (public.is_platform_admin());

create policy "organisations: owner or admin updates" on public.organisations
  for update to authenticated
  using (public.is_org_owner(id) or public.is_platform_admin())
  with check (public.is_org_owner(id) or public.is_platform_admin());

create policy "organisations: admin deletes" on public.organisations
  for delete to authenticated
  using (public.is_platform_admin());

-- Organisation members
create policy "members: colleagues and admin read" on public.organisation_members
  for select to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "members: owner or admin adds" on public.organisation_members
  for insert to authenticated
  with check (public.is_org_owner(organisation_id) or public.is_platform_admin());

create policy "members: owner or admin changes" on public.organisation_members
  for update to authenticated
  using (public.is_org_owner(organisation_id) or public.is_platform_admin())
  with check (public.is_org_owner(organisation_id) or public.is_platform_admin());

create policy "members: owner or admin removes" on public.organisation_members
  for delete to authenticated
  using (public.is_org_owner(organisation_id) or public.is_platform_admin());

-- Events: anyone can read a published event; organiser staff manage their own.
create policy "events: published or own" on public.events
  for select to anon, authenticated
  using (status = 'published' or public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "events: staff create" on public.events
  for insert to authenticated
  with check (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "events: staff update" on public.events
  for update to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin())
  with check (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "events: staff delete" on public.events
  for delete to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin());

-- Sessions, sections and entries follow their event.
create policy "sessions: published or own" on public.event_sessions
  for select to anon, authenticated
  using (public.is_event_published(event_id) or public.can_manage_event(event_id));
create policy "sessions: staff write" on public.event_sessions
  for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "sections: published or own" on public.sections
  for select to anon, authenticated
  using (public.is_event_published(event_id) or public.can_manage_event(event_id));
create policy "sections: staff write" on public.sections
  for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy "entries: published or own" on public.entries
  for select to anon, authenticated
  using (public.is_event_published(event_id) or public.can_manage_event(event_id));
create policy "entries: staff write" on public.entries
  for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- A section, session and entry must all belong to the same event.
create function public.check_entry_matches_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sections s where s.id = new.section_id and s.event_id = new.event_id
  ) then
    raise exception 'Section does not belong to this event';
  end if;
  return new;
end;
$$;

create trigger entries_match_event
  before insert or update on public.entries
  for each row execute function public.check_entry_matches_event();

create function public.check_section_matches_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_id is not null and not exists (
    select 1 from public.event_sessions s where s.id = new.session_id and s.event_id = new.event_id
  ) then
    raise exception 'Session does not belong to this event';
  end if;
  return new;
end;
$$;

create trigger sections_match_event
  before insert or update on public.sections
  for each row execute function public.check_section_matches_event();

-- ---------------------------------------------------------------------------
-- Adding a staff member by email (looks up the login safely)
-- ---------------------------------------------------------------------------

create function public.add_organisation_member(org uuid, member_email text, member_role public.org_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target uuid;
begin
  if not (public.is_org_owner(org) or public.is_platform_admin()) then
    raise exception 'Only the organiser''s owner or a platform admin can add people';
  end if;

  select p.id into target from public.profiles p where lower(p.email) = lower(trim(member_email));
  if target is null then
    raise exception 'No account uses that email yet. Ask them to sign up first.';
  end if;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (org, target, member_role)
  on conflict (organisation_id, user_id) do update set role = excluded.role;
end;
$$;

revoke execute on function public.add_organisation_member(uuid, text, public.org_role) from public, anon;
grant execute on function public.add_organisation_member(uuid, text, public.org_role) to authenticated;
