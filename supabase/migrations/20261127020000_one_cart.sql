-- One cart for several competitions.
-- Each competition still has its own cart row (so each organiser sees only
-- their own entries and gets their own receipt number), but the competitor
-- can pay for all their carts in one Square/PayPal payment: a "checkout group".
-- The group is named after its first cart (checkout_group = that cart's id).

alter table public.orders
  add column checkout_group uuid,
  add column checkout_group_cents integer;

create index orders_checkout_group_idx on public.orders (checkout_group) where checkout_group is not null;

-- One payment can now pay for several carts (one per competition).
drop index public.orders_payment_reference_unique;

-- Changing any cart in a group cancels the whole group's checkout, so the
-- amount paid always matches everything that was in the carts.
create or replace function public.clear_checkout()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_group uuid;
begin
  select o.checkout_group into v_group from public.orders o where o.id = coalesce(new.order_id, old.order_id);
  update public.orders
  set checkout_provider = null, checkout_reference = null, checkout_amount_cents = null,
      checkout_group = null, checkout_group_cents = null
  where status = 'open'
    and (id = coalesce(new.order_id, old.order_id) or (v_group is not null and checkout_group = v_group));
  return null;
end;
$$;

-- Step 1: remember that one checkout pays for these carts.
create function public.record_checkout_group(p_orders uuid[], p_provider text, p_reference text, p_amount_cents integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count integer;
  v_users integer;
  v_total integer;
begin
  if cardinality(p_orders) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  select count(*), count(distinct o.user_id), coalesce(sum(o.total_cents), 0)
  into v_count, v_users, v_total
  from public.orders o
  where o.id = any (p_orders) and o.status = 'open'
    and exists (select 1 from public.order_items i where i.order_id = o.id);
  if v_count <> cardinality(p_orders) or v_users <> 1 or v_total <> p_amount_cents then
    raise exception 'This cart has changed. Please check it and try again.';
  end if;

  update public.orders
  set checkout_provider = p_provider, checkout_reference = p_reference, checkout_amount_cents = total_cents,
      checkout_group = p_orders[1], checkout_group_cents = p_amount_cents
  where id = any (p_orders);
end;
$$;

-- Step 3: once Square/PayPal confirm the payment, mark every cart in the group
-- paid (each gets its own receipt number). Safe to call twice.
create function public.complete_checkout_group(p_group uuid, p_provider text, p_reference text, p_paid_cents integer, p_receipt_url text)
returns text[]
language plpgsql
security definer set search_path = ''
as $$
declare
  v_order record;
  v_open_total integer;
  v_open_count integer;
  v_group_cents integer;
  v_receipts text[] := '{}';
begin
  -- Lock the group's carts.
  perform 1 from public.orders where checkout_group = p_group or id = p_group for update;

  select count(*), coalesce(sum(total_cents), 0), max(checkout_group_cents)
  into v_open_count, v_open_total, v_group_cents
  from public.orders
  where checkout_group = p_group and status = 'open'
    and checkout_provider = p_provider and checkout_reference = p_reference;

  if v_open_count > 0 and (p_paid_cents <> v_group_cents or v_open_total <> v_group_cents) then
    raise exception 'Amount paid (%) does not match the cart total (%)', p_paid_cents, v_open_total;
  end if;

  for v_order in
    select id, total_cents, status from public.orders
    where (checkout_group = p_group and checkout_provider = p_provider and checkout_reference = p_reference)
       or (status = 'paid' and payment_provider = p_provider and payment_reference = p_reference)
    order by created_at
  loop
    v_receipts := v_receipts || public.complete_order(v_order.id, p_provider, p_reference, v_order.total_cents, p_receipt_url);
  end loop;

  if cardinality(v_receipts) = 0 then
    raise exception 'This payment does not match the cart''s checkout';
  end if;
  return v_receipts;
end;
$$;

revoke execute on function public.record_checkout_group(uuid[], text, text, integer) from public, anon, authenticated;
revoke execute on function public.complete_checkout_group(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_checkout_group(uuid[], text, text, integer) to service_role;
grant execute on function public.complete_checkout_group(uuid, text, text, integer, text) to service_role;
