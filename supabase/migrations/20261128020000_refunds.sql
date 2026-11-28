-- Refunds.
-- An organisation owner (or the site admin) refunds some or all of a paid
-- receipt. The money goes back through Square or PayPal (the same payment the
-- competitor made), or the refund is just recorded if it was made another way
-- (cash, bank transfer). Refunded entries can be scratched from the program.

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  -- 'square' / 'paypal': sent back through that service. 'manual': recorded only.
  method text not null check (method in ('square', 'paypal', 'manual')),
  -- pending: being sent; refunded: done (or accepted by Square/PayPal); failed: nothing was refunded.
  status text not null default 'pending' check (status in ('pending', 'refunded', 'failed')),
  reason text not null default '',
  -- Which entries on the receipt this refund is for (can be none, for a part refund).
  order_item_ids uuid[] not null default '{}',
  scratch_entries boolean not null default false,
  provider_refund_id text,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index refunds_order_idx on public.refunds (order_id);
create index refunds_event_idx on public.refunds (event_id);

alter table public.refunds enable row level security;

-- The competitor who paid, and the event's organisers, can see refunds.
-- Changes only happen through the website's server (functions below).
create policy "refunds: payer or organiser reads" on public.refunds
  for select to authenticated
  using (
    public.can_manage_event(event_id)
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- Who may give refunds: the organisation's owners and the site admin (not staff).
create function public.can_refund_event(ev uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.events e where e.id = ev and public.is_org_owner(e.organisation_id)
  );
$$;

-- Step 1: check the refund is allowed and reserve it (status 'pending').
-- Never more than was paid, and never the same entry twice.
create function public.start_refund(
  p_order uuid, p_item_ids uuid[], p_amount_cents integer, p_method text,
  p_reason text, p_scratch boolean, p_user uuid
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_already integer;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null or v_order.status <> 'paid' then
    raise exception 'Only paid receipts can be refunded.';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Enter an amount to refund.';
  end if;
  if p_method not in ('manual', coalesce(v_order.payment_provider, '')) then
    raise exception 'This receipt was not paid with %.', p_method;
  end if;
  if exists (select 1 from public.refunds r where r.order_id = p_order and r.status = 'pending') then
    raise exception 'Another refund for this receipt is still being processed. Please wait a moment and try again.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_item_ids, '{}')) as x(id)
    where not exists (select 1 from public.order_items i where i.id = x.id and i.order_id = p_order)
  ) then
    raise exception 'Those entries are not on this receipt.';
  end if;
  if exists (
    select 1 from public.refunds r
    where r.order_id = p_order and r.status <> 'failed' and r.order_item_ids && coalesce(p_item_ids, '{}')
  ) then
    raise exception 'One of those entries has already been refunded.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_already
  from public.refunds where order_id = p_order and status <> 'failed';
  if v_already + p_amount_cents > coalesce(v_order.paid_amount_cents, v_order.total_cents) then
    raise exception 'That is more than is left to refund (% cents).', coalesce(v_order.paid_amount_cents, v_order.total_cents) - v_already;
  end if;

  insert into public.refunds (order_id, event_id, amount_cents, method, reason, order_item_ids, scratch_entries, created_by,
                              status, finished_at)
  values (p_order, v_order.event_id, p_amount_cents, p_method, left(coalesce(p_reason, ''), 500), coalesce(p_item_ids, '{}'),
          coalesce(p_scratch, false), p_user,
          case when p_method = 'manual' then 'refunded' else 'pending' end,
          case when p_method = 'manual' then now() end)
  returning id into v_id;

  if p_method = 'manual' and p_scratch then
    update public.entries set status = 'scratched'
    where id in (select i.entry_id from public.order_items i where i.id = any (p_item_ids) and i.entry_id is not null);
  end if;
  return v_id;
end;
$$;

-- Step 2: record what Square/PayPal said. Scratch the entries if asked.
create function public.finish_refund(p_refund uuid, p_ok boolean, p_provider_refund_id text, p_error text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_refund public.refunds%rowtype;
begin
  select * into v_refund from public.refunds where id = p_refund for update;
  if v_refund.id is null or v_refund.status <> 'pending' then
    return;
  end if;
  update public.refunds
  set status = case when p_ok then 'refunded' else 'failed' end,
      provider_refund_id = p_provider_refund_id,
      error = case when p_ok then null else left(p_error, 500) end,
      finished_at = now()
  where id = p_refund;

  if p_ok and v_refund.scratch_entries then
    update public.entries set status = 'scratched'
    where id in (select i.entry_id from public.order_items i where i.id = any (v_refund.order_item_ids) and i.entry_id is not null);
  end if;
end;
$$;

grant select on public.refunds to authenticated;
grant select, insert, update on public.refunds to service_role;
grant execute on function public.can_refund_event(uuid) to authenticated;
revoke execute on function public.start_refund(uuid, uuid[], integer, text, text, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.finish_refund(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.start_refund(uuid, uuid[], integer, text, text, boolean, uuid) to service_role;
grant execute on function public.finish_refund(uuid, boolean, text, text) to service_role;
