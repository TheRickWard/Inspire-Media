-- Program helpers. These run with the caller's own permissions, so the
-- security rules in the previous migration still apply to everything they do.

-- Import program rows (from a CSV) in one go. Either every row is added, or none are.
-- rows: [{ item_number, section_code, section_name, session, performer_name,
--          studio_name, routine_title, genre, age_group }]
create function public.import_program(ev uuid, rows jsonb)
returns integer
language plpgsql
security invoker set search_path = ''
as $$
declare
  r jsonb;
  v_session_id uuid;
  v_section_id uuid;
  v_next_pos integer;
  v_next_section_pos integer;
  v_next_session_pos integer;
  v_dupes text;
  v_count integer := 0;
begin
  if not public.can_manage_event(ev) then
    raise exception 'You do not have access to this event';
  end if;

  select string_agg(x.item, ', ' order by x.item) into v_dupes
  from (
    select distinct trim(elem ->> 'item_number') as item
    from jsonb_array_elements(rows) elem
    where exists (
      select 1 from public.entries e
      where e.event_id = ev and lower(e.item_number) = lower(trim(elem ->> 'item_number'))
    )
  ) x;
  if v_dupes is not null then
    raise exception 'These item numbers are already in the program: %', v_dupes;
  end if;

  select coalesce(max(position), 0) + 1 into v_next_pos from public.entries where event_id = ev;
  select coalesce(max(position), 0) + 1 into v_next_section_pos from public.sections where event_id = ev;
  select coalesce(max(position), 0) + 1 into v_next_session_pos from public.event_sessions where event_id = ev;

  for r in select * from jsonb_array_elements(rows) loop
    v_session_id := null;
    if coalesce(trim(r ->> 'session'), '') <> '' then
      select id into v_session_id from public.event_sessions
      where event_id = ev and lower(name) = lower(trim(r ->> 'session'));
      if v_session_id is null then
        insert into public.event_sessions (event_id, name, position)
        values (ev, trim(r ->> 'session'), v_next_session_pos)
        returning id into v_session_id;
        v_next_session_pos := v_next_session_pos + 1;
      end if;
    end if;

    select id into v_section_id from public.sections
    where event_id = ev and lower(code) = lower(trim(r ->> 'section_code'));
    if v_section_id is null then
      insert into public.sections (event_id, session_id, code, name, genre, age_group, position)
      values (
        ev, v_session_id, trim(r ->> 'section_code'),
        coalesce(nullif(trim(r ->> 'section_name'), ''), 'Section ' || trim(r ->> 'section_code')),
        coalesce(trim(r ->> 'genre'), ''), coalesce(trim(r ->> 'age_group'), ''),
        v_next_section_pos
      )
      returning id into v_section_id;
      v_next_section_pos := v_next_section_pos + 1;
    end if;

    insert into public.entries (event_id, section_id, item_number, performer_name, studio_name, routine_title, position)
    values (
      ev, v_section_id, trim(r ->> 'item_number'), trim(r ->> 'performer_name'),
      coalesce(trim(r ->> 'studio_name'), ''), coalesce(trim(r ->> 'routine_title'), ''),
      v_next_pos
    );
    v_next_pos := v_next_pos + 1;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Add a late entry at the end of its section, shuffling later items down one place.
create function public.add_late_entry(
  sec uuid, p_item_number text, p_performer_name text, p_studio_name text, p_routine_title text
)
returns uuid
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_event uuid;
  v_pos integer;
  v_id uuid;
begin
  select event_id into v_event from public.sections where id = sec;
  if v_event is null or not public.can_manage_event(v_event) then
    raise exception 'You do not have access to this section';
  end if;

  if exists (select 1 from public.entries where event_id = v_event and lower(item_number) = lower(trim(p_item_number))) then
    raise exception 'Item number % is already in the program', trim(p_item_number);
  end if;

  -- After the last item in this section; if the section is empty, after the
  -- last item of any earlier section; otherwise at the very start.
  select max(e.position) into v_pos from public.entries e where e.section_id = sec;
  if v_pos is null then
    select max(e.position) into v_pos
    from public.entries e join public.sections s on s.id = e.section_id
    where e.event_id = v_event
      and s.position <= (select position from public.sections where id = sec);
  end if;
  v_pos := coalesce(v_pos, 0) + 1;

  update public.entries set position = position + 1 where event_id = v_event and position >= v_pos;

  insert into public.entries (event_id, section_id, item_number, performer_name, studio_name, routine_title, is_late_entry, position)
  values (v_event, sec, trim(p_item_number), trim(p_performer_name), coalesce(trim(p_studio_name), ''), coalesce(trim(p_routine_title), ''), true, v_pos)
  returning id into v_id;

  return v_id;
end;
$$;

-- Move an entry one place up or down within its section's running order.
create function public.move_entry(entry uuid, direction text)
returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_this public.entries%rowtype;
  v_other public.entries%rowtype;
begin
  select * into v_this from public.entries where id = entry;
  if v_this.id is null or not public.can_manage_event(v_this.event_id) then
    raise exception 'You do not have access to this entry';
  end if;

  if direction = 'up' then
    select * into v_other from public.entries
    where section_id = v_this.section_id and position < v_this.position
    order by position desc limit 1;
  elsif direction = 'down' then
    select * into v_other from public.entries
    where section_id = v_this.section_id and position > v_this.position
    order by position asc limit 1;
  else
    raise exception 'Direction must be up or down';
  end if;

  if v_other.id is null then
    return; -- already at the top or bottom
  end if;

  update public.entries set position = v_other.position where id = v_this.id;
  update public.entries set position = v_this.position where id = v_other.id;
end;
$$;

revoke execute on function public.import_program(uuid, jsonb) from public, anon;
revoke execute on function public.add_late_entry(uuid, text, text, text, text) from public, anon;
revoke execute on function public.move_entry(uuid, text) from public, anon;
grant execute on function public.import_program(uuid, jsonb) to authenticated;
grant execute on function public.add_late_entry(uuid, text, text, text, text) to authenticated;
grant execute on function public.move_entry(uuid, text) to authenticated;
