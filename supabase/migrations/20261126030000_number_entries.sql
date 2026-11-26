-- Give item numbers to a program in running order.
--
-- p_mode = 'all':  renumber the whole program 1, 2, 3 ... in running order
--                  (scratched items keep their place and get a number too).
-- p_mode = 'new':  only give numbers to entries that don't have one yet
--                  (for example, paid online entries). Each gets the number
--                  of the item before it plus a letter: 12A, 12B ... so
--                  numbers already printed or sent out don't change.
--                  If nothing is numbered yet, it numbers 1, 2, 3 ...
-- Returns how many entries were given a number.

create function public.number_entries(ev uuid, p_mode text)
returns integer
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_entry record;
  v_n integer := 0;
  v_prev text;
  v_letter integer;
  v_candidate text;
  v_count integer := 0;
begin
  if not public.can_manage_event(ev) then
    raise exception 'You do not have access to this event';
  end if;
  if p_mode not in ('all', 'new') then
    raise exception 'Mode must be all or new';
  end if;

  if p_mode = 'new' and not exists (select 1 from public.entries where event_id = ev and item_number is not null) then
    p_mode := 'all';
  end if;

  if p_mode = 'all' then
    -- Clear first so the new numbers can't clash with the old ones.
    update public.entries set item_number = null where event_id = ev;
    for v_entry in select id from public.entries where event_id = ev order by position, created_at loop
      v_n := v_n + 1;
      update public.entries set item_number = v_n::text where id = v_entry.id;
    end loop;
    return v_n;
  end if;

  for v_entry in select id, item_number from public.entries where event_id = ev order by position, created_at loop
    if v_entry.item_number is not null then
      v_prev := v_entry.item_number;
      continue;
    end if;
    -- Before the first numbered item: use "0" as the base (0A, 0B ...).
    v_letter := 0;
    loop
      v_letter := v_letter + 1;
      if v_letter > 26 then
        raise exception 'Too many new entries after item % to number with letters. Use "Renumber the whole program" instead.', coalesce(v_prev, '0');
      end if;
      v_candidate := coalesce(v_prev, '0') || chr(64 + v_letter);
      exit when not exists (select 1 from public.entries where event_id = ev and lower(item_number) = lower(v_candidate));
    end loop;
    update public.entries set item_number = v_candidate where id = v_entry.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.number_entries(uuid, text) from public, anon;
grant execute on function public.number_entries(uuid, text) to authenticated;
