-- Brightloop Subscriptions MVP reset + install.
-- WARNING: this permanently deletes Brightloop app data in the public schema
-- (businesses, customers, plans, subscriptions, invoices, payments, etc.).
-- It does not delete Supabase Auth users or Storage objects.

begin;

drop trigger if exists brightloop_auth_user_created on auth.users;
drop function if exists public.handle_brightloop_auth_user() cascade;
drop function if exists public.current_business_id() cascade;
drop function if exists public.is_business_staff() cascade;
drop function if exists public.run_billing_cycle(boolean) cascade;
drop function if exists public.simulate_invoice_payment(uuid, boolean) cascade;
drop function if exists public.customer_start_subscription(uuid) cascade;
drop function if exists public.customer_manage_subscription(uuid, text) cascade;

drop table if exists public.activity_logs cascade;
drop table if exists public.invoice_items cascade;
drop table if exists public.payments cascade;
drop table if exists public.invoices cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.pricing_plans cascade;
drop table if exists public.products cascade;
drop table if exists public.customers cascade;
drop table if exists public.profiles cascade;
drop table if exists public.businesses cascade;

drop type if exists public.member_role cascade;
drop type if exists public.billing_interval cascade;
drop type if exists public.subscription_status cascade;
drop type if exists public.invoice_status cascade;
drop type if exists public.payment_status cascade;

create extension if not exists pgcrypto;

create type public.member_role as enum ('admin', 'staff', 'customer');
create type public.billing_interval as enum ('monthly', 'quarterly', 'yearly');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired');
create type public.invoice_status as enum ('open', 'paid', 'overdue', 'void');
create type public.payment_status as enum ('succeeded', 'failed');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.member_role not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);
create index profiles_business_role_idx on public.profiles(business_id, role);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  company text,
  phone text,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);
create index customers_business_name_idx on public.customers(business_id, name);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  description text not null default '',
  amount_minor bigint not null check (amount_minor >= 0),
  interval public.billing_interval not null default 'monthly',
  trial_days integer not null default 0 check (trial_days >= 0),
  enabled boolean not null default true,
  recommended boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, product_id, name)
);
create index pricing_plans_catalog_idx on public.pricing_plans(business_id, enabled);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  plan_id uuid not null references public.pricing_plans(id) on delete restrict,
  status public.subscription_status not null default 'active',
  amount_minor bigint not null check (amount_minor >= 0),
  interval public.billing_interval not null,
  started_at timestamptz not null default now(),
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  next_billing_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index subscriptions_business_status_idx on public.subscriptions(business_id, status);
create index subscriptions_due_idx on public.subscriptions(next_billing_at) where status in ('active', 'past_due');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'open',
  period_start timestamptz,
  period_end timestamptz,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, invoice_number),
  unique (subscription_id, period_start, period_end)
);
create index invoices_business_recent_idx on public.invoices(business_id, created_at desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  status public.payment_status not null,
  method text not null default 'simulated',
  is_simulated boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index payments_business_recent_idx on public.payments(business_id, created_at desc);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_business_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select p.business_id from public.profiles p where p.id = (select auth.uid()) $$;

create or replace function public.is_business_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'staff')) $$;

-- Seed the one demo business and three editable plans.
do $$
declare
  v_business uuid;
  v_product uuid;
begin
  insert into public.businesses(name) values ('Brightloop Software') returning id into v_business;
  insert into public.products(business_id, name, description)
    values (v_business, 'Brightloop Workspace', 'Subscription workspace and collaboration tools.') returning id into v_product;
  insert into public.pricing_plans(business_id, product_id, name, description, amount_minor, interval, enabled, recommended)
  values
    (v_business, v_product, 'Starter', 'For small teams getting started.', 29900, 'monthly', true, false),
    (v_business, v_product, 'Pro', 'For growing teams.', 79900, 'monthly', true, true),
    (v_business, v_product, 'Business', 'For established teams.', 199900, 'monthly', true, false);

  insert into public.customers(business_id, name, email, company)
  select v_business, 'Demo Customer ' || n, 'customer' || n || '@example.test', 'Sample Company ' || n
  from generate_series(1, 8) as series(n);

  insert into public.subscriptions(business_id, customer_id, product_id, plan_id, status, amount_minor, interval, started_at, period_start, period_end, next_billing_at)
  select v_business, c.id, p.product_id, p.id,
    case n % 8 when 0 then 'past_due'::public.subscription_status when 1 then 'paused'::public.subscription_status when 2 then 'cancelled'::public.subscription_status else 'active'::public.subscription_status end,
    p.amount_minor, p.interval,
    now() - interval '31 days', now() - interval '1 month' - interval '1 day', now() - interval '1 day',
    case when n % 8 in (1,2) then null else now() - interval '1 day' end
  from generate_series(1, 12) as series(n)
  join public.customers c on c.business_id = v_business and c.email = 'customer' || (((n - 1) % 8) + 1) || '@example.test'
  join public.pricing_plans p on p.business_id = v_business and p.name = case n % 3 when 0 then 'Starter' when 1 then 'Pro' else 'Business' end;

  insert into public.invoices(business_id, customer_id, subscription_id, invoice_number, status, period_start, period_end, subtotal_minor, total_minor, due_at)
  select v_business, s.customer_id, s.id, 'DEMO-' || lpad(row_number() over (order by s.created_at, s.id)::text, 4, '0'),
    case when row_number() over (order by s.created_at, s.id) <= 3 then 'paid'::public.invoice_status when row_number() over (order by s.created_at, s.id) = 4 then 'overdue'::public.invoice_status else 'open'::public.invoice_status end,
    s.period_start - interval '1 month', s.period_start, s.amount_minor, s.amount_minor, now() + interval '7 days'
  from public.subscriptions s where s.business_id = v_business order by s.created_at, s.id limit 6;

  insert into public.invoice_items(invoice_id, description, quantity, unit_amount_minor, amount_minor)
  select i.id, p.name || ' subscription', 1, i.subtotal_minor, i.subtotal_minor
  from public.invoices i join public.subscriptions s on s.id = i.subscription_id
  join public.products p on p.id = s.product_id where i.business_id = v_business;

  insert into public.payments(business_id, customer_id, invoice_id, amount_minor, status, note)
  select i.business_id, i.customer_id, i.id, i.total_minor,
    case when i.status = 'paid' then 'succeeded'::public.payment_status else 'failed'::public.payment_status end,
    case when i.status = 'paid' then 'Seeded demo payment' else 'Seeded failed demo payment' end
  from public.invoices i where i.business_id = v_business and i.status in ('paid', 'overdue');
end $$;

-- First existing Auth user becomes the admin; any other existing users become customers.
do $$
declare
  v_business uuid;
  v_user record;
  v_role public.member_role;
  v_has_admin boolean;
  v_name text;
begin
  select id into v_business from public.businesses order by created_at limit 1;
  select exists(select 1 from public.profiles where business_id = v_business and role = 'admin') into v_has_admin;
  for v_user in select id, email, raw_user_meta_data from auth.users order by last_sign_in_at desc nulls last, created_at loop
    if not exists(select 1 from public.profiles where id = v_user.id) then
      if not v_has_admin then v_role := 'admin'; v_has_admin := true; else v_role := 'customer'; end if;
      v_name := coalesce(nullif(v_user.raw_user_meta_data ->> 'full_name', ''), split_part(v_user.email, '@', 1));
      insert into public.profiles(id, business_id, role, full_name) values (v_user.id, v_business, v_role, v_name);
      if v_role = 'customer' and v_user.email is not null then
        insert into public.customers(business_id, user_id, name, email)
        values (v_business, v_user.id, v_name, lower(v_user.email))
        on conflict (business_id, email) do update set user_id = excluded.user_id;
      end if;
    end if;
  end loop;
end $$;

create or replace function public.handle_brightloop_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid;
  v_role public.member_role;
  v_name text;
begin
  select id into v_business from public.businesses order by created_at limit 1;
  if v_business is null then raise exception 'Brightloop setup SQL has not been installed.'; end if;
  if exists(select 1 from public.profiles where business_id = v_business and role = 'admin') then v_role := 'customer'; else v_role := 'admin'; end if;
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'member'), '@', 1));
  insert into public.profiles(id, business_id, role, full_name) values (new.id, v_business, v_role, v_name);
  if v_role = 'customer' and new.email is not null then
    insert into public.customers(business_id, user_id, name, email)
    values (v_business, new.id, v_name, lower(new.email))
    on conflict (business_id, email) do update set user_id = excluded.user_id;
  end if;
  return new;
end $$;

create trigger brightloop_auth_user_created after insert on auth.users
for each row execute function public.handle_brightloop_auth_user();

create or replace function public.run_billing_cycle(p_force boolean default true)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid := (select public.current_business_id());
  s record;
  v_invoice uuid;
  v_number text;
  v_early boolean;
  v_next timestamptz;
  v_bill_start timestamptz;
  v_bill_end timestamptz;
  v_count integer := 0;
begin
  if not (select public.is_business_staff()) then raise exception 'Administrator or staff access required.' using errcode = '42501'; end if;
  for s in
    select x.* from public.subscriptions x
    where x.business_id = v_business and x.status in ('trialing','active','past_due') and x.next_billing_at is not null
      and ((x.status = 'active' and (p_force or x.next_billing_at <= now())) or (x.status in ('trialing','past_due') and x.next_billing_at <= now()))
      and not exists(select 1 from public.invoices i where i.subscription_id = x.id and i.status in ('open','overdue'))
    order by x.next_billing_at for update
  loop
    v_early := p_force and s.next_billing_at > now();
    if v_early then
      v_bill_start := s.period_start;
      v_bill_end := s.period_end;
    else
      v_bill_start := s.period_end;
      v_bill_end := s.period_end + case s.interval when 'quarterly' then interval '3 months' when 'yearly' then interval '1 year' else interval '1 month' end;
    end if;
    v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.invoices(business_id, customer_id, subscription_id, invoice_number, status, period_start, period_end, subtotal_minor, total_minor, due_at)
    values (v_business, s.customer_id, s.id, v_number, 'open', v_bill_start, v_bill_end, s.amount_minor, s.amount_minor, now() + interval '7 days')
    on conflict (subscription_id, period_start, period_end) do nothing returning id into v_invoice;
    if v_invoice is null then
      if not v_early then
        update public.subscriptions set status='active', period_start=v_bill_start, period_end=v_bill_end, next_billing_at=v_bill_end, updated_at=now() where id=s.id;
      end if;
      continue;
    end if;
    insert into public.invoice_items(invoice_id, description, quantity, unit_amount_minor, amount_minor)
    select v_invoice, p.name, 1, s.amount_minor, s.amount_minor from public.products p where p.id=s.product_id;
    insert into public.activity_logs(business_id, customer_id, subscription_id, event_type, description)
    values (v_business, s.customer_id, s.id, 'invoice.created', 'Invoice ' || v_number || ' created.');
    if not v_early then
      update public.subscriptions set status='active', period_start=v_bill_start, period_end=v_bill_end, next_billing_at=v_bill_end, updated_at=now() where id=s.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.simulate_invoice_payment(p_invoice_id uuid, p_success boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid := (select public.current_business_id());
  v_invoice public.invoices%rowtype;
  v_payment uuid;
begin
  if not (select public.is_business_staff()) then raise exception 'Administrator or staff access required.' using errcode = '42501'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id and business_id=v_business for update;
  if not found then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  if v_invoice.status='paid' then raise exception 'Invoice is already paid.' using errcode = '22023'; end if;
  if v_invoice.status='void' or v_invoice.total_minor <= 0 then raise exception 'Invoice cannot be paid.' using errcode = '22023'; end if;
  insert into public.payments(business_id, customer_id, invoice_id, amount_minor, status, note)
  values (v_business, v_invoice.customer_id, v_invoice.id, v_invoice.total_minor,
    case when p_success then 'succeeded'::public.payment_status else 'failed'::public.payment_status end,
    case when p_success then 'Simulated success' else 'Simulated failure' end) returning id into v_payment;
  update public.invoices set status=case when p_success then 'paid' else 'overdue' end where id=v_invoice.id;
  if v_invoice.subscription_id is not null then
    update public.subscriptions set status=case when p_success then 'active' else 'past_due' end, updated_at=now() where id=v_invoice.subscription_id;
  end if;
  insert into public.activity_logs(business_id, customer_id, subscription_id, event_type, description)
  values (v_business, v_invoice.customer_id, v_invoice.subscription_id, case when p_success then 'payment.succeeded' else 'payment.failed' end,
    case when p_success then 'Simulated payment succeeded.' else 'Simulated payment failed.' end);
  return v_payment;
end $$;

create or replace function public.customer_start_subscription(p_plan_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_business uuid := (select public.current_business_id());
  v_customer uuid;
  v_plan public.pricing_plans%rowtype;
  v_subscription uuid;
  v_start timestamptz := now();
  v_end timestamptz;
  v_invoice uuid;
  v_number text;
begin
  if v_user is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not exists(select 1 from public.profiles where id=v_user and role='customer') then raise exception 'Customer account required.' using errcode = '42501'; end if;
  select id into v_customer from public.customers where user_id=v_user and business_id=v_business;
  select * into v_plan from public.pricing_plans where id=p_plan_id and business_id=v_business and enabled;
  if v_customer is null or v_plan.id is null then raise exception 'Customer or plan not found.' using errcode = 'P0002'; end if;
  if v_plan.trial_days > 0 then v_end := v_start + make_interval(days => v_plan.trial_days);
  else v_end := v_start + case v_plan.interval when 'quarterly' then interval '3 months' when 'yearly' then interval '1 year' else interval '1 month' end; end if;
  insert into public.subscriptions(business_id,customer_id,product_id,plan_id,status,amount_minor,interval,started_at,period_start,period_end,next_billing_at)
  values (v_business,v_customer,v_plan.product_id,v_plan.id,case when v_plan.trial_days>0 then 'trialing'::public.subscription_status else 'active'::public.subscription_status end,
    v_plan.amount_minor,v_plan.interval,v_start,v_start,v_end,v_end) returning id into v_subscription;
  if v_plan.trial_days = 0 then
    v_number := 'INV-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into public.invoices(business_id,customer_id,subscription_id,invoice_number,status,period_start,period_end,subtotal_minor,total_minor,due_at)
    values(v_business,v_customer,v_subscription,v_number,'open',v_start,v_end,v_plan.amount_minor,v_plan.amount_minor,now()+interval '7 days') returning id into v_invoice;
    insert into public.invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor)
    select v_invoice,p.name,1,v_plan.amount_minor,v_plan.amount_minor from public.products p where p.id=v_plan.product_id;
  end if;
  insert into public.activity_logs(business_id,customer_id,subscription_id,event_type,description)
  values(v_business,v_customer,v_subscription,'subscription.created','Customer started a subscription.');
  return v_subscription;
end $$;

create or replace function public.customer_manage_subscription(p_subscription_id uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_business uuid := (select public.current_business_id());
  v_sub public.subscriptions%rowtype;
begin
  select s.* into v_sub from public.subscriptions s join public.customers c on c.id=s.customer_id
  where s.id=p_subscription_id and s.business_id=v_business and c.user_id=v_user for update of s;
  if not found then raise exception 'Subscription not found.' using errcode = 'P0002'; end if;
  if p_action='pause' and v_sub.status in ('active','trialing','past_due') then update public.subscriptions set status='paused',updated_at=now() where id=v_sub.id;
  elsif p_action='resume' and v_sub.status='paused' then update public.subscriptions set status='active',next_billing_at=greatest(coalesce(next_billing_at,now()),now()),updated_at=now() where id=v_sub.id;
  elsif p_action='cancel' and v_sub.status in ('active','trialing','past_due','paused') then update public.subscriptions set status='cancelled',cancel_at_period_end=false,updated_at=now() where id=v_sub.id;
  else raise exception 'Invalid subscription action.' using errcode = '22023'; end if;
end $$;

revoke all on function public.current_business_id() from public;
revoke all on function public.is_business_staff() from public;
revoke all on function public.run_billing_cycle(boolean) from public;
revoke all on function public.simulate_invoice_payment(uuid, boolean) from public;
revoke all on function public.customer_start_subscription(uuid) from public;
revoke all on function public.customer_manage_subscription(uuid, text) from public;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.is_business_staff() to authenticated;
grant execute on function public.run_billing_cycle(boolean) to authenticated;
grant execute on function public.simulate_invoice_payment(uuid, boolean) to authenticated;
grant execute on function public.customer_start_subscription(uuid) to authenticated;
grant execute on function public.customer_manage_subscription(uuid, text) to authenticated;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;

create policy business_read on public.businesses for select to authenticated using(id=(select public.current_business_id()));
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (business_id=(select public.current_business_id()) and (select public.is_business_staff())));
create policy customers_staff on public.customers for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy customers_self_read on public.customers for select to authenticated using(user_id=(select auth.uid()));
create policy products_staff on public.products for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy products_customer_read on public.products for select to authenticated using(enabled and business_id=(select public.current_business_id()));
create policy plans_staff on public.pricing_plans for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy plans_customer_read on public.pricing_plans for select to authenticated using(enabled and business_id=(select public.current_business_id()));
create policy subscriptions_staff on public.subscriptions for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy subscriptions_customer_read on public.subscriptions for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.user_id=(select auth.uid())));
create policy invoices_staff on public.invoices for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy invoices_customer_read on public.invoices for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.user_id=(select auth.uid())));
create policy invoice_items_staff on public.invoice_items for all to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and i.business_id=(select public.current_business_id()) and (select public.is_business_staff()))) with check(exists(select 1 from public.invoices i where i.id=invoice_id and i.business_id=(select public.current_business_id()) and (select public.is_business_staff())));
create policy invoice_items_customer_read on public.invoice_items for select to authenticated using(exists(select 1 from public.invoices i join public.customers c on c.id=i.customer_id where i.id=invoice_id and c.user_id=(select auth.uid())));
create policy payments_staff on public.payments for all to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff())) with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy payments_customer_read on public.payments for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.user_id=(select auth.uid())));
create policy activity_staff on public.activity_logs for select to authenticated using(business_id=(select public.current_business_id()) and (select public.is_business_staff()));
create policy activity_staff_insert on public.activity_logs for insert to authenticated with check(business_id=(select public.current_business_id()) and (select public.is_business_staff()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.businesses, public.profiles, public.customers,
  public.products, public.pricing_plans, public.subscriptions, public.invoices,
  public.invoice_items, public.payments, public.activity_logs to authenticated;

-- Existing Auth users: most recently used account becomes the initial admin;
-- other existing accounts get customer access. Future users are auto-provisioned by trigger.
commit;
