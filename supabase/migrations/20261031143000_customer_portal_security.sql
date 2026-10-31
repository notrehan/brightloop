-- Customer portal permissions and a customer-scoped simulated payment RPC.
-- Additive only: does not drop tables, columns, rows, or existing policies.

begin;

-- Customers must still be able to identify the product and plan on an existing
-- subscription after a staff member archives the product or disables the plan.
create policy products_customer_existing_subscription_read
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.subscriptions s
    join public.customers c on c.id = s.customer_id
    where s.product_id = products.id
      and s.business_id = (select public.current_business_id())
      and c.user_id = (select auth.uid())
  )
);

create policy plans_customer_existing_subscription_read
on public.pricing_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.subscriptions s
    join public.customers c on c.id = s.customer_id
    where s.plan_id = pricing_plans.id
      and s.business_id = (select public.current_business_id())
      and c.user_id = (select auth.uid())
  )
);

-- Customer-facing demo payment. The customer ID is derived exclusively from
-- auth.uid(); a browser-provided invoice ID is never trusted as ownership proof.
create or replace function public.customer_simulate_invoice_payment(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_customer_id uuid;
  v_business_id uuid;
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;

  select c.id, c.business_id
    into v_customer_id, v_business_id
  from public.customers c
  join public.profiles p on p.id = c.user_id
  where c.user_id = v_user
    and p.id = v_user
    and p.role = 'customer'
    and p.business_id = c.business_id;

  if v_customer_id is null then
    raise exception 'Customer account required.' using errcode = '42501';
  end if;

  select i.*
    into v_invoice
  from public.invoices i
  where i.id = p_invoice_id
    and i.customer_id = v_customer_id
    and i.business_id = v_business_id
  for update;

  if not found then
    raise exception 'Invoice not found.' using errcode = 'P0002';
  end if;

  if v_invoice.status not in ('open', 'overdue') or v_invoice.total_minor <= 0 then
    raise exception 'This invoice is not eligible for payment.' using errcode = '22023';
  end if;

  -- The invoice row lock serializes customer and staff payment attempts.
  -- The status check above plus this defensive check prevent a second success.
  if exists (
    select 1
    from public.payments p
    where p.invoice_id = v_invoice.id
      and p.status = 'succeeded'::public.payment_status
  ) then
    raise exception 'A successful payment is already recorded for this invoice.'
      using errcode = '23505';
  end if;

  insert into public.payments (
    business_id,
    customer_id,
    invoice_id,
    amount_minor,
    status,
    method,
    is_simulated,
    note
  ) values (
    v_business_id,
    v_customer_id,
    v_invoice.id,
    v_invoice.total_minor,
    'succeeded'::public.payment_status,
    'simulated',
    true,
    'Customer portal simulated payment'
  ) returning id into v_payment_id;

  update public.invoices
  set status = 'paid'::public.invoice_status
  where id = v_invoice.id
    and business_id = v_business_id
    and customer_id = v_customer_id;

  if v_invoice.subscription_id is not null then
    update public.subscriptions
    set status = 'active'::public.subscription_status,
        updated_at = now()
    where id = v_invoice.subscription_id
      and business_id = v_business_id
      and customer_id = v_customer_id;
  end if;

  insert into public.activity_logs (
    business_id,
    customer_id,
    subscription_id,
    event_type,
    description
  ) values (
    v_business_id,
    v_customer_id,
    v_invoice.subscription_id,
    'payment.succeeded',
    'Customer completed a simulated invoice payment.'
  );

  return v_payment_id;
end;
$$;

revoke all on function public.customer_simulate_invoice_payment(uuid) from public, anon;
grant execute on function public.customer_simulate_invoice_payment(uuid) to authenticated;

commit;
