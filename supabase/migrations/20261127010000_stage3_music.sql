-- Stage 3: music upload.
-- One music file per entry, kept in a private storage bucket called "music".
-- The website checks who you are, then hands the browser a one-off upload
-- link, so big audio files go straight to storage (not through the website).
-- Files sit at music/<event id>/<entry id>/<random>.<mp3|m4a|wav>.

-- Private bucket: 20 MB per file, audio only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', false, 20971520, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.entry_music (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(trim(file_name)) > 0),
  size_bytes bigint not null check (size_bytes > 0),
  content_type text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index entry_music_event_idx on public.entry_music (event_id);

alter table public.entry_music enable row level security;

-- Did the current user pay for (enter) this entry?
create function public.owns_entry(entry uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.entries e where e.id = entry and e.entered_by = (select auth.uid()));
$$;

-- Competitors can always see their own entries, even if the event is unpublished later.
create policy "entries: competitor reads own" on public.entries
  for select to authenticated
  using (entered_by = (select auth.uid()));

-- The competitor who entered, and the event's organisers, can see the music details.
-- Changes only happen through the website's server (after its checks).
create policy "entry music: owner or organiser reads" on public.entry_music
  for select to authenticated
  using (public.owns_entry(entry_id) or public.can_manage_event(event_id));

-- Can the current user upload music for this entry today?
-- Organisers: always. Competitors: their own entry, up to the music due date
-- (or the last day of the event if no due date is set), unless scratched.
create function public.music_upload_check(entry uuid)
returns text
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_entry record;
  v_today date := (now() at time zone 'Australia/Sydney')::date;
begin
  select e.id, e.event_id, e.status, e.entered_by, ev.music_due_on, ev.ends_on
  into v_entry
  from public.entries e join public.events ev on ev.id = e.event_id
  where e.id = entry;

  if v_entry.id is null then return 'That entry no longer exists.'; end if;
  if public.can_manage_event(v_entry.event_id) then return null; end if;
  if v_entry.entered_by is distinct from (select auth.uid()) then return 'You can only upload music for your own entries.'; end if;
  if v_entry.status = 'scratched' then return 'This entry has been scratched.'; end if;
  if v_today > coalesce(v_entry.music_due_on, v_entry.ends_on) then
    return 'Music uploads for this event have closed. Please contact the organiser.';
  end if;
  return null;
end;
$$;

grant select on public.entry_music to authenticated;
grant select, insert, update, delete on public.entry_music to service_role;
grant select on public.entries, public.events, public.sections to service_role;
grant execute on function public.owns_entry(uuid) to authenticated;
grant execute on function public.music_upload_check(uuid) to authenticated;
