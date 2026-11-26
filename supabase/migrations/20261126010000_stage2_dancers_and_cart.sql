-- Stage 2: dancers, online entry carts, and the link from paid cart items to
-- program entries. Payment itself (Square) is added in a later migration.

-- ---------------------------------------------------------------------------
-- Dancers belong to the account that added them (a parent or a studio).
-- Only name, date of birth and studio are kept: the account holder is the contact.
-- ---------------------------------------------------------------------------

create table public.dancers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  date_of_birth date not null check (date_of_birth > date '1900-01-01'),
  studio_name text not null default '',
  created_at timestamptz not null default now()
);

create index dancers_owner_idx on public.dancers (owner_id);

-- ---------------------------------------------------------------------------
-- Age rules for sections, and the date ages are worked out on.
-- ---------------------------------------------------------------------------

alter table public.events add column age_as_at date;

-- Entries open and close on the event's dates ('auto'), unless an organiser
-- or the platform admin opens or closes them by hand.
alter table public.events add column entries_override text not null default 'auto'
  check (entries_override in ('auto', 'open', 'closed'));
comment on column public.events.age_as_at is 'Dancers'' ages are worked out on this date (often 1 January). Blank = the first day of the event.';

alter table public.sections add column min_age integer check (min_age between 0 and 120);
alter table public.sections add column max_age integer check (max_age between 0 and 120);
alter table public.sections add column max_dancers integer check (max_dancers > 0);
alter table public.sections add column min_dancers integer not null default 1 check (min_dancers > 0);

-- ---------------------------------------------------------------------------
-- Program entries made online don't have an item number until the organiser
-- numbers the program.
-- ---------------------------------------------------------------------------

alter table public.entries alter column item_number drop not null;
alter table public.entries drop constraint entries_item_number_check;
alter table public.entries add constraint entries_item_number_check check (item_number is null or length(trim(item_number)) > 0);
alter table public.entries add column entered_by uuid references public.profiles (id) on delete set null;

create table public.entry_dancers (
  entry_id uuid not null references public.entries (id) on delete cascade,
  dancer_id uuid not null references public.dancers (id) on delete restrict,
  primary key (entry_id, dancer_id)
);

-- ---------------------------------------------------------------------------
-- Carts: one open cart per person per event.
-- An item is either named dancers (parents, studios listing dancers) or a
-- studio entry that only gives the studio name (no children's details).
-- ---------------------------------------------------------------------------

create type public.order_status as enum ('open', 'paid', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status public.order_status not null default 'open',
  total_cents integer not null default 0,
  receipt_number text unique,
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index orders_one_open_cart on public.orders (user_id, event_id) where status = 'open';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete restrict,
  dancer_ids uuid[] not null default '{}',
  studio_name text not null default '',
  check (cardinality(dancer_ids) > 0 or length(trim(studio_name)) > 0),
  fee_cents integer not null check (fee_cents >= 0),
  entry_id uuid references public.entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Security rules
-- ---------------------------------------------------------------------------

alter table public.dancers enable row level security;
alter table public.entry_dancers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Helper checks (security definer, so the rules below don't loop into each other).
create function public.owns_dancer(dancer uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.dancers d where d.id = dancer and d.owner_id = (select auth.uid()));
$$;

create function public.dancer_entered_in_my_event(dancer uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entry_dancers ed join public.entries e on e.id = ed.entry_id
    where ed.dancer_id = dancer and public.can_manage_event(e.event_id)
  );
$$;

-- Dancers: the owner manages them. Organisers can see dancers entered in their events.
create policy "dancers: owner manages" on public.dancers
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "dancers: organisers see entered dancers" on public.dancers
  for select to authenticated
  using (public.dancer_entered_in_my_event(id));

create policy "entry dancers: owner or organiser reads" on public.entry_dancers
  for select to authenticated
  using (
    public.owns_dancer(dancer_id)
    or exists (select 1 from public.entries e where e.id = entry_id and public.can_manage_event(e.event_id))
  );

-- Orders: people see their own; organisers see orders for their events.
-- Changing an order's status or totals only happens through the functions below.
create policy "orders: owner or organiser reads" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_event(event_id));

create policy "order items: owner or organiser reads" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id
    and (o.user_id = (select auth.uid()) or public.can_manage_event(o.event_id))
  ));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the event taking entries today (Sydney time)? An organiser's manual
-- open/close wins over the dates.
create function public.entries_are_open(ev uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = ev
      and e.status = 'published'
      and (
        e.entries_override = 'open'
        or (
          e.entries_override = 'auto'
          and e.entries_open_on is not null
          and e.entries_close_on is not null
          and (now() at time zone 'Australia/Sydney')::date between e.entries_open_on and e.entries_close_on
        )
      )
  );
$$;

-- Age in whole years on a given date.
create function public.age_on(dob date, on_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(on_date, dob))::integer;
$$;

-- Add an entry to the caller's cart for an event. Checks entry dates, and for
-- named dancers: ownership, numbers of dancers and age limits. A studio entry
-- (studio name, no dancers) skips the dancer checks.
create function public.add_to_cart(sec uuid, p_dancer_ids uuid[], p_studio_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_section public.sections%rowtype;
  v_event public.events%rowtype;
  v_order uuid;
  v_count integer;
  v_age_date date;
  v_bad text;
  v_item uuid;
  v_studio text := coalesce(trim(p_studio_name), '');
begin
  if v_user is null then
    raise exception 'Please sign in first';
  end if;

  select * into v_section from public.sections where id = sec;
  if v_section.id is null then
    raise exception 'That section no longer exists';
  end if;
  select * into v_event from public.events where id = v_section.event_id;

  if not public.entries_are_open(v_event.id) then
    raise exception 'Entries for this event are not open';
  end if;

  v_count := coalesce(cardinality(p_dancer_ids), 0);
  if v_count = 0 and v_studio = '' then
    raise exception 'Please choose at least one dancer, or enter a studio name';
  end if;
  if v_count > 0 and v_studio <> '' then
    raise exception 'Choose dancers or a studio name, not both';
  end if;

  if v_count > 0 then
    if (select count(*) from public.dancers where id = any (p_dancer_ids) and owner_id = v_user) <> v_count then
      raise exception 'You can only enter your own dancers';
    end if;
    if v_count < v_section.min_dancers then
      raise exception 'This section needs at least % dancers', v_section.min_dancers;
    end if;
    if v_section.max_dancers is not null and v_count > v_section.max_dancers then
      raise exception 'This section allows at most % dancers', v_section.max_dancers;
    end if;

    v_age_date := coalesce(v_event.age_as_at, v_event.starts_on);
    select string_agg(d.full_name || ' (' || public.age_on(d.date_of_birth, v_age_date) || ')', ', ')
    into v_bad
    from public.dancers d
    where d.id = any (p_dancer_ids)
      and (
        (v_section.min_age is not null and public.age_on(d.date_of_birth, v_age_date) < v_section.min_age)
        or (v_section.max_age is not null and public.age_on(d.date_of_birth, v_age_date) > v_section.max_age)
      );
    if v_bad is not null then
      raise exception 'Outside the age group for this section: %', v_bad;
    end if;
  end if;

  select id into v_order from public.orders
  where user_id = v_user and event_id = v_event.id and status = 'open';
  if v_order is null then
    insert into public.orders (user_id, event_id) values (v_user, v_event.id) returning id into v_order;
  end if;

  insert into public.order_items (order_id, section_id, dancer_ids, studio_name, fee_cents)
  values (v_order, sec, coalesce(p_dancer_ids, '{}'), v_studio, v_section.entry_fee_cents)
  returning id into v_item;

  update public.orders set total_cents = (select coalesce(sum(fee_cents), 0) from public.order_items where order_id = v_order)
  where id = v_order;

  return v_item;
end;
$$;

-- Remove an item from the caller's open cart.
create function public.remove_from_cart(item uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order uuid;
begin
  select o.id into v_order
  from public.order_items i join public.orders o on o.id = i.order_id
  where i.id = item and o.user_id = auth.uid() and o.status = 'open';
  if v_order is null then
    raise exception 'That item is not in your cart';
  end if;

  delete from public.order_items where id = item;
  update public.orders set total_cents = (select coalesce(sum(fee_cents), 0) from public.order_items where order_id = v_order)
  where id = v_order;
end;
$$;

-- A dancer can't be deleted once they're in a paid entry (records are kept);
-- otherwise remove them from any open cart items first.
create function public.delete_dancer(dancer uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.dancers where id = dancer and owner_id = auth.uid()) then
    raise exception 'That dancer is not yours';
  end if;
  if exists (select 1 from public.entry_dancers where dancer_id = dancer) then
    raise exception 'This dancer has paid entries, so their record is kept';
  end if;
  if exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where dancer = any (i.dancer_ids) and o.status = 'open'
  ) then
    raise exception 'Remove this dancer from your cart first';
  end if;
  delete from public.dancers where id = dancer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access for the website (newer Supabase projects need this spelled out).
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.dancers to authenticated;
grant select on public.entry_dancers, public.orders, public.order_items to authenticated;

revoke execute on function public.add_to_cart(uuid, uuid[], text) from public, anon;
revoke execute on function public.remove_from_cart(uuid) from public, anon;
revoke execute on function public.delete_dancer(uuid) from public, anon;
grant execute on function public.add_to_cart(uuid, uuid[], text) to authenticated;
grant execute on function public.remove_from_cart(uuid) to authenticated;
grant execute on function public.delete_dancer(uuid) to authenticated;
grant execute on function public.entries_are_open(uuid) to anon, authenticated;
grant execute on function public.age_on(date, date) to anon, authenticated;
grant execute on function public.owns_dancer(uuid) to authenticated;
grant execute on function public.dancer_entered_in_my_event(uuid) to authenticated;
