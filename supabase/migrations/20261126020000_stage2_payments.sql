-- Stage 2: payments (Square and PayPal), receipts, and paid cart items
-- becoming program entries.
--
-- How a payment works:
-- 1. The website starts a checkout with Square or PayPal and records it on the
--    cart (record_checkout). Changing the cart afterwards cancels that checkout.
-- 2. The competitor pays on Square's or PayPal's own page.
-- 3. The website asks Square or PayPal directly whether the money arrived and
--    for how much, then calls complete_order. Only the website's server key can
--    call these two functions; signed-in people cannot.

create sequence public.receipt_number_seq start 1001;

alter table public.orders
  add column checkout_provider text check (checkout_provider in ('square', 'paypal')),
  add column checkout_reference text,
  add column checkout_amount_cents integer,
  add column payment_provider text check (payment_provider in ('square', 'paypal')),
  add column paid_amount_cents integer,
  add column provider_receipt_url text;

-- A payment can only ever pay for one cart.
create unique index orders_payment_reference_unique
  on public.orders (payment_provider, payment_reference)
  where payment_reference is not null;

-- Changing the cart cancels any checkout that was started, so the amount paid
-- always matches what's in the cart.
create function public.clear_checkout()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.orders
  set checkout_provider = null, checkout_reference = null, checkout_amount_cents = null
  where id = coalesce(new.order_id, old.order_id) and status = 'open';
  return null;
end;
$$;

create trigger order_items_clear_checkout
  after insert or delete on public.order_items
  for each row execute function public.clear_checkout();

-- Step 1: remember which checkout belongs to this cart.
create function public.record_checkout(p_order uuid, p_provider text, p_reference text, p_amount_cents integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.orders
  set checkout_provider = p_provider, checkout_reference = p_reference, checkout_amount_cents = p_amount_cents
  where id = p_order and status = 'open' and total_cents = p_amount_cents;
  if not found then
    raise exception 'This cart has changed. Please check it and try again.';
  end if;
end;
$$;

-- Step 3: mark the cart paid and put each item into the organiser's program
-- (without an item number until the organiser numbers the program).
-- Safe to call twice for the same payment.
create function public.complete_order(p_order uuid, p_provider text, p_reference text, p_paid_cents integer, p_receipt_url text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_names text;
  v_studio text;
  v_pos integer;
  v_entry uuid;
  v_receipt text;
begin
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.status = 'paid' then
    if v_order.payment_reference = p_reference then
      return v_order.receipt_number;
    end if;
    raise exception 'This cart has already been paid';
  end if;
  if v_order.status <> 'open' then
    raise exception 'This cart was cancelled';
  end if;
  if v_order.checkout_provider is distinct from p_provider or v_order.checkout_reference is distinct from p_reference then
    raise exception 'This payment does not match the cart''s checkout';
  end if;
  if p_paid_cents <> v_order.total_cents or p_paid_cents <> v_order.checkout_amount_cents then
    raise exception 'Amount paid (%) does not match the cart total (%)', p_paid_cents, v_order.total_cents;
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'The cart is empty';
  end if;

  v_receipt := 'INS-' || nextval('public.receipt_number_seq');

  for v_item in
    select i.*, s.event_id, s.position as section_position
    from public.order_items i join public.sections s on s.id = i.section_id
    where i.order_id = p_order
    order by i.created_at
  loop
    if cardinality(v_item.dancer_ids) > 0 then
      select string_agg(d.full_name, ' & ' order by d.full_name),
             coalesce(min(nullif(d.studio_name, '')), '')
      into v_names, v_studio
      from public.dancers d where d.id = any (v_item.dancer_ids);
    else
      v_names := v_item.studio_name;
      v_studio := v_item.studio_name;
    end if;

    -- After the last item in this section; if it's empty, after the last item
    -- of any earlier section; otherwise at the very start.
    select max(e.position) into v_pos from public.entries e where e.section_id = v_item.section_id;
    if v_pos is null then
      select max(e.position) into v_pos
      from public.entries e join public.sections s on s.id = e.section_id
      where e.event_id = v_item.event_id and s.position <= v_item.section_position;
    end if;
    v_pos := coalesce(v_pos, 0) + 1;
    update public.entries set position = position + 1 where event_id = v_item.event_id and position >= v_pos;

    insert into public.entries (event_id, section_id, item_number, performer_name, studio_name, position, entered_by)
    values (v_item.event_id, v_item.section_id, null, v_names, v_studio, v_pos, v_order.user_id)
    returning id into v_entry;

    insert into public.entry_dancers (entry_id, dancer_id)
    select v_entry, unnest(v_item.dancer_ids);

    update public.order_items set entry_id = v_entry where id = v_item.id;
  end loop;

  update public.orders
  set status = 'paid',
      paid_at = now(),
      receipt_number = v_receipt,
      payment_provider = p_provider,
      payment_reference = p_reference,
      paid_amount_cents = p_paid_cents,
      provider_receipt_url = nullif(p_receipt_url, '')
  where id = p_order;

  return v_receipt;
end;
$$;

-- Only the website's server key may record checkouts and complete orders.
revoke execute on function public.record_checkout(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.complete_order(uuid, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.clear_checkout() from public, anon, authenticated;
grant execute on function public.record_checkout(uuid, text, text, integer) to service_role;
grant execute on function public.complete_order(uuid, text, text, integer, text) to service_role;
grant usage on sequence public.receipt_number_seq to service_role;
grant select, update on public.orders to service_role;
grant select, update on public.order_items to service_role;
grant select, insert, update on public.entries to service_role;
grant select, insert on public.entry_dancers to service_role;
grant select on public.dancers, public.sections, public.events to service_role;
