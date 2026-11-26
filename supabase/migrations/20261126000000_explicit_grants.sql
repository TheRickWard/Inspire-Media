-- Newer Supabase projects no longer give the website automatic access to
-- new tables. These lines grant it explicitly. The row level security rules
-- from the first migration still decide which rows each person can see.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated;

-- Public pages: anyone can read published events (the security rules hide drafts).
grant select on public.events, public.event_sessions, public.sections, public.entries to anon;

-- Signed-in people.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on
  public.organisations,
  public.organisation_members,
  public.events,
  public.event_sessions,
  public.sections,
  public.entries
to authenticated;

-- Helper checks used inside the security rules.
grant execute on function public.is_platform_admin() to anon, authenticated;
grant execute on function public.is_org_member(uuid) to anon, authenticated;
grant execute on function public.is_org_owner(uuid) to anon, authenticated;
grant execute on function public.can_manage_event(uuid) to anon, authenticated;
grant execute on function public.is_event_published(uuid) to anon, authenticated;

-- Program tools (signed-in only).
grant execute on function public.import_program(uuid, jsonb) to authenticated;
grant execute on function public.add_late_entry(uuid, text, text, text, text) to authenticated;
grant execute on function public.move_entry(uuid, text) to authenticated;
grant execute on function public.add_organisation_member(uuid, text, public.org_role) to authenticated;

-- Fill in any missing profiles for accounts created before the setup ran.
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;
