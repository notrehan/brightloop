-- Additive subscription order editor support. Existing customer/subscription data is retained.
begin;

alter table public.customers alter column email drop not null;
alter table public.customers add column if not exists address text;

alter table public.pricing_plans add column if not exists period_unit text not null default 'month' check (period_unit in ('week','month','year'));
alter table public.pricing_plans add column if not exists period_count smallint not null default 1 check (period_count between 1 and 60);
alter table public.subscriptions add column if not exists period_unit text not null default 'month' check (period_unit in ('week','month','year'));
alter table public.subscriptions add column if not exists period_count smallint not null default 1 check (period_count between 1 and 60);
update public.pricing_plans set period_unit=case interval::text when 'yearly' then 'year' else 'month' end, period_count=case interval::text when 'yearly' then 1 when 'quarterly' then 3 else 1 end where period_unit='month' and period_count=1 and interval::text in ('quarterly','yearly');
update public.subscriptions set period_unit=case interval::text when 'yearly' then 'year' else 'month' end, period_count=case interval::text when 'yearly' then 1 when 'quarterly' then 3 else 1 end where period_unit='month' and period_count=1 and interval::text in ('quarterly','yearly');

create sequence if not exists public.subscription_number_seq;
alter table public.subscriptions add column if not exists subscription_number text;
alter table public.subscriptions add column if not exists expires_at date;
alter table public.subscriptions add column if not exists payment_terms text not null default 'Due immediately';
alter table public.subscriptions add column if not exists terms text not null default '';
alter table public.subscriptions add column if not exists tax_minor bigint not null default 0 check (tax_minor >= 0);
alter table public.subscriptions add column if not exists total_minor bigint not null default 0 check (total_minor >= 0);
update public.subscriptions set subscription_number='S'||lpad(nextval('public.subscription_number_seq')::text,5,'0') where subscription_number is null;
update public.subscriptions set total_minor=amount_minor where total_minor=0 and amount_minor>0;
create unique index if not exists subscriptions_number_unique_idx on public.subscriptions(subscription_number);
alter table public.subscriptions alter column subscription_number set default ('S'||lpad(nextval('public.subscription_number_seq')::text,5,'0'));

create table if not exists public.subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  row_type text not null default 'product' check (row_type in ('product','section','note')),
  product_id uuid references public.products(id) on delete set null,
  plan_id uuid references public.pricing_plans(id) on delete set null,
  description text not null default '',
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_of_measure text not null default 'Units',
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate_percent numeric(5,2) not null default 0 check (tax_rate_percent between 0 and 100),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subscription_items_order_idx on public.subscription_items(subscription_id,sort_order);

alter table public.invoice_items add column if not exists row_type text not null default 'product' check (row_type in ('product','section','note'));
alter table public.invoice_items add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.invoice_items add column if not exists unit_of_measure text not null default 'Units';
alter table public.invoice_items add column if not exists discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100);
alter table public.invoice_items add column if not exists tax_rate_percent numeric(5,2) not null default 0 check (tax_rate_percent between 0 and 100);
alter table public.invoice_items add column if not exists tax_minor bigint not null default 0 check (tax_minor >= 0);
alter table public.invoice_items add column if not exists sort_order integer not null default 0;

alter table public.subscription_items enable row level security;
drop policy if exists subscription_items_staff on public.subscription_items;
create policy subscription_items_staff on public.subscription_items for all to authenticated
using (exists(select 1 from public.subscriptions s where s.id=subscription_id and s.business_id=(select public.current_business_id()) and (select public.is_business_staff())))
with check (exists(select 1 from public.subscriptions s where s.id=subscription_id and s.business_id=(select public.current_business_id()) and (select public.is_business_staff())));
drop policy if exists subscription_items_customer_read on public.subscription_items;
create policy subscription_items_customer_read on public.subscription_items for select to authenticated
using (exists(select 1 from public.subscriptions s join public.customers c on c.id=s.customer_id where s.id=subscription_id and c.user_id=(select auth.uid())));
grant select,insert,update,delete on public.subscription_items to authenticated;

create or replace function public.run_billing_cycle(p_force boolean default true)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid := (select public.current_business_id()); s record; v_invoice uuid; v_number text;
  v_early boolean; v_bill_start timestamptz; v_bill_end timestamptz; v_count integer:=0;
begin
  if not (select public.is_business_staff()) then raise exception 'Administrator or staff access required.' using errcode='42501'; end if;
  for s in select x.* from public.subscriptions x where x.business_id=v_business and x.status in ('trialing','active','past_due') and x.next_billing_at is not null
    and ((x.status='active' and (p_force or x.next_billing_at<=now())) or (x.status in ('trialing','past_due') and x.next_billing_at<=now()))
    and not exists(select 1 from public.invoices i where i.subscription_id=x.id and i.status in ('open','overdue')) order by x.next_billing_at for update
  loop
    if s.expires_at is not null and s.expires_at<=current_date then update public.subscriptions set status='expired',updated_at=now() where id=s.id; continue; end if;
    v_early:=p_force and s.next_billing_at>now();
    if v_early and not exists(select 1 from public.invoices i where i.subscription_id=s.id and i.period_start=s.period_start and i.period_end=s.period_end) then
      v_bill_start:=s.period_start; v_bill_end:=s.period_end;
    else
      v_bill_start:=s.period_end;
      v_bill_end:=s.period_end+case s.period_unit when 'week' then make_interval(weeks=>s.period_count) when 'year' then make_interval(years=>s.period_count) else make_interval(months=>s.period_count) end;
      if s.expires_at is not null then v_bill_end:=least(v_bill_end,s.expires_at::timestamptz); end if;
    end if;
    if v_bill_end<=v_bill_start then update public.subscriptions set status='expired',updated_at=now() where id=s.id; continue; end if;
    v_number:='INV-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into public.invoices(business_id,customer_id,subscription_id,invoice_number,status,period_start,period_end,subtotal_minor,total_minor,due_at)
    values(v_business,s.customer_id,s.id,v_number,'open',v_bill_start,v_bill_end,s.amount_minor,coalesce(s.total_minor,s.amount_minor),now()+interval '7 days')
    on conflict(subscription_id,period_start,period_end) do nothing returning id into v_invoice;
    if v_invoice is null then
      if not v_early then update public.subscriptions set status='active',period_start=v_bill_start,period_end=v_bill_end,next_billing_at=v_bill_end,updated_at=now() where id=s.id; end if;
      continue;
    end if;
    if exists(select 1 from public.subscription_items si where si.subscription_id=s.id) then
      insert into public.invoice_items(invoice_id,row_type,product_id,description,quantity,unit_of_measure,unit_amount_minor,discount_percent,tax_rate_percent,amount_minor,tax_minor,sort_order)
      select v_invoice,si.row_type,si.product_id,si.description,si.quantity,si.unit_of_measure,si.unit_price_minor,si.discount_percent,si.tax_rate_percent,si.subtotal_minor,si.tax_minor,si.sort_order
      from public.subscription_items si where si.subscription_id=s.id order by si.sort_order;
    else
      insert into public.invoice_items(invoice_id,description,quantity,unit_amount_minor,amount_minor,product_id)
      select v_invoice,p.name,1,s.amount_minor,s.amount_minor,s.product_id from public.products p where p.id=s.product_id;
    end if;
    insert into public.activity_logs(business_id,customer_id,subscription_id,event_type,description) values(v_business,s.customer_id,s.id,'invoice.created','Invoice '||v_number||' created.');
    update public.subscriptions set status='active',period_start=v_bill_start,period_end=v_bill_end,next_billing_at=v_bill_end,updated_at=now() where id=s.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
grant execute on function public.run_billing_cycle(boolean) to authenticated;

create or replace function public.create_subscription_order(
  p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text,
  p_started_at date, p_expires_at date, p_payment_terms text, p_terms text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid := (select public.current_business_id()); v_customer uuid; v_subscription uuid;
  v_plan public.pricing_plans%rowtype; v_first_product uuid; v_started timestamptz; v_period_end timestamptz;
  v_item jsonb; v_row_type text; v_product uuid; v_item_plan uuid; v_description text;
  v_quantity numeric(12,3); v_unit_price bigint; v_discount numeric(5,2); v_tax_rate numeric(5,2);
  v_subtotal bigint; v_tax bigint; v_line_total bigint; v_subtotal_sum bigint:=0; v_tax_sum bigint:=0; v_order integer:=0;
begin
  if not (select public.is_business_staff()) then raise exception 'Administrator or staff access required.' using errcode='42501'; end if;
  if nullif(trim(p_customer_name),'') is null then raise exception 'Customer name is required.' using errcode='22023'; end if;
  if nullif(trim(p_customer_email),'') is null and nullif(trim(p_customer_phone),'') is null then raise exception 'Enter an email address or phone number.' using errcode='22023'; end if;
  if jsonb_typeof(p_lines)<>'array' then raise exception 'Add at least one product.' using errcode='22023'; end if;
  select (line->>'plan_id')::uuid into v_item_plan from jsonb_array_elements(p_lines) as t(line) where line->>'row_type'='product' limit 1;
  if v_item_plan is null then raise exception 'Add at least one product.' using errcode='22023'; end if;
  select * into v_plan from public.pricing_plans where id=v_item_plan and business_id=v_business and enabled;
  if v_plan.id is null then raise exception 'Select an available product price.' using errcode='22023'; end if;
  if p_expires_at is not null and p_expires_at <= coalesce(p_started_at,current_date) then raise exception 'Expiration must be after the start date.' using errcode='22023'; end if;
  if nullif(trim(p_customer_email),'') is not null then
    insert into public.customers(business_id,name,email,phone,address) values(v_business,trim(p_customer_name),lower(trim(p_customer_email)),nullif(trim(p_customer_phone),''),nullif(trim(p_customer_address),''))
    on conflict (business_id,email) do update set name=excluded.name,phone=coalesce(excluded.phone,public.customers.phone),address=coalesce(excluded.address,public.customers.address) returning id into v_customer;
  else
    insert into public.customers(business_id,name,email,phone,address) values(v_business,trim(p_customer_name),null,nullif(trim(p_customer_phone),''),nullif(trim(p_customer_address),'')) returning id into v_customer;
  end if;
  v_started:=coalesce(p_started_at,current_date)::timestamptz;
  v_period_end:=v_started+case v_plan.period_unit when 'week' then make_interval(weeks=>v_plan.period_count) when 'year' then make_interval(years=>v_plan.period_count) else make_interval(months=>v_plan.period_count) end;
  -- Validate selected plans and calculate line totals before writing the order.
  for v_item in select line from jsonb_array_elements(p_lines) as t(line) loop
    v_row_type:=coalesce(v_item->>'row_type','product');
    if v_row_type='product' then
      v_item_plan:=(v_item->>'plan_id')::uuid;
      select pp.product_id,pp.amount_minor,p.name into v_product,v_unit_price,v_description from public.pricing_plans pp join public.products p on p.id=pp.product_id where pp.id=v_item_plan and pp.business_id=v_business and pp.enabled and p.enabled and p.can_be_sold;
      if v_product is null then raise exception 'A selected product is no longer available.' using errcode='22023'; end if;
      if exists(select 1 from public.pricing_plans pp where pp.id=v_item_plan and (pp.period_unit<>v_plan.period_unit or pp.period_count<>v_plan.period_count)) then raise exception 'All product lines must use the same billing period.' using errcode='22023'; end if;
      v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1); v_discount:=coalesce(nullif(v_item->>'discount_percent','')::numeric,0); v_tax_rate:=coalesce(nullif(v_item->>'tax_rate_percent','')::numeric,0); v_unit_price:=coalesce(nullif(v_item->>'unit_price_minor','')::bigint,v_unit_price);
      if v_quantity<=0 or v_discount<0 or v_discount>100 or v_tax_rate<0 or v_tax_rate>100 or v_unit_price<0 then raise exception 'Check quantity, price, discount, and tax values.' using errcode='22023'; end if;
      v_subtotal:=round(v_quantity*v_unit_price*(1-v_discount/100))::bigint; v_tax:=round(v_subtotal*v_tax_rate/100)::bigint; v_subtotal_sum:=v_subtotal_sum+v_subtotal; v_tax_sum:=v_tax_sum+v_tax; if v_first_product is null then v_first_product:=v_product; end if;
    elsif v_row_type not in ('section','note') then raise exception 'Invalid subscription line type.' using errcode='22023';
    elsif v_row_type='note' and nullif(trim(v_item->>'description'),'') is null then raise exception 'Add text to each note row.' using errcode='22023'; end if;
  end loop;
  insert into public.subscriptions(business_id,customer_id,product_id,plan_id,status,amount_minor,total_minor,tax_minor,interval,period_unit,period_count,started_at,period_start,period_end,next_billing_at,expires_at,payment_terms,terms)
  values(v_business,v_customer,v_first_product,v_plan.id,'active',v_subtotal_sum,v_subtotal_sum+v_tax_sum,v_tax_sum,v_plan.interval,v_plan.period_unit,v_plan.period_count,v_started,v_started,
    case when p_expires_at is not null then least(v_period_end,p_expires_at::timestamptz) else v_period_end end,
    case when p_expires_at is not null then least(v_period_end,p_expires_at::timestamptz) else v_period_end end,p_expires_at,coalesce(nullif(trim(p_payment_terms),''),'Due immediately'),coalesce(p_terms,'')) returning id into v_subscription;
  v_order:=0;
  for v_item in select line from jsonb_array_elements(p_lines) as t(line) loop
    v_order:=v_order+1; v_row_type:=coalesce(v_item->>'row_type','product'); v_description:=nullif(trim(v_item->>'description'),'');
    if v_row_type='product' then
      v_item_plan:=(v_item->>'plan_id')::uuid;
      select pp.product_id,pp.amount_minor,p.name into v_product,v_unit_price,v_description from public.pricing_plans pp join public.products p on p.id=pp.product_id where pp.id=v_item_plan;
      v_description:=coalesce(nullif(trim(v_item->>'description'),''),v_description); v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,1); v_discount:=coalesce(nullif(v_item->>'discount_percent','')::numeric,0); v_tax_rate:=coalesce(nullif(v_item->>'tax_rate_percent','')::numeric,0); v_unit_price:=coalesce(nullif(v_item->>'unit_price_minor','')::bigint,v_unit_price);
      v_subtotal:=round(v_quantity*v_unit_price*(1-v_discount/100))::bigint; v_tax:=round(v_subtotal*v_tax_rate/100)::bigint; v_line_total:=v_subtotal+v_tax;
      insert into public.subscription_items(subscription_id,row_type,product_id,plan_id,description,quantity,unit_of_measure,unit_price_minor,discount_percent,tax_rate_percent,subtotal_minor,tax_minor,total_minor,sort_order)
      values(v_subscription,'product',v_product,v_item_plan,v_description,v_quantity,'Units',v_unit_price,v_discount,v_tax_rate,v_subtotal,v_tax,v_line_total,v_order);
    else insert into public.subscription_items(subscription_id,row_type,description,sort_order) values(v_subscription,v_row_type,coalesce(v_description,''),v_order); end if;
  end loop;
  insert into public.activity_logs(business_id,customer_id,subscription_id,event_type,description)
  values(v_business,v_customer,v_subscription,'subscription.created','Subscription '||(select subscription_number from public.subscriptions where id=v_subscription)||' created.');
  return v_subscription;
end $$;

grant execute on function public.create_subscription_order(text,text,text,text,date,date,text,text,jsonb) to authenticated;
revoke all on function public.create_subscription_order(text,text,text,text,date,date,text,text,jsonb) from public;
commit;
