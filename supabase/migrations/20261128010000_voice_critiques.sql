-- Stage 4: voice critiques.
-- Organisers upload each adjudicator's recorded critique against an entry.
-- Competitors only see (and can play/download) their critiques once the
-- organiser releases them, for the whole event or one session at a time.
-- Files sit in a private bucket at critiques/<event id>/<entry id>/<random>.<ext>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('critiques', 'critiques', false, 20971520,
        array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- When critiques were released to competitors (null = not yet).
alter table public.events add column critiques_released_at timestamptz;
alter table public.event_sessions add column critiques_released_at timestamptz;

-- One row per recording. An entry can have several (one per adjudicator).
create table public.entry_critiques (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(trim(file_name)) > 0),
  adjudicator text not null default '',
  size_bytes bigint not null check (size_bytes > 0),
  content_type text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index entry_critiques_entry_idx on public.entry_critiques (entry_id);
create index entry_critiques_event_idx on public.entry_critiques (event_id);

alter table public.entry_critiques enable row level security;

-- Has the organiser released critiques for this entry (whole event, or its session)?
create function public.critique_released(entry uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.entries e
    join public.events ev on ev.id = e.event_id
    join public.sections s on s.id = e.section_id
    left join public.event_sessions es on es.id = s.session_id
    where e.id = entry
      and (ev.critiques_released_at is not null or es.critiques_released_at is not null)
  );
$$;

-- Organisers see every critique for their events. Competitors see their own,
-- once released. Changes only happen through the website's server.
create policy "entry critiques: organiser, or owner once released" on public.entry_critiques
  for select to authenticated
  using (public.can_manage_event(event_id) or (public.owns_entry(entry_id) and public.critique_released(entry_id)));

grant select on public.entry_critiques to authenticated;
grant select, insert, update, delete on public.entry_critiques to service_role;
grant execute on function public.critique_released(uuid) to authenticated;
