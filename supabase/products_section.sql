-- Additive Products-section update for the existing Brightloop MVP database.
-- Safe to run once or again; this does not delete existing products or subscriptions.
begin;
alter table public.products add column if not exists product_type text not null default 'service' check (product_type in ('service','digital','goods'));
alter table public.products add column if not exists category text;
alter table public.products add column if not exists internal_reference text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists can_be_sold boolean not null default true;
alter table public.products add column if not exists can_be_purchased boolean not null default false;
alter table public.products add column if not exists recurring boolean not null default false;
alter table public.products add column if not exists list_price_minor bigint not null default 0 check (list_price_minor >= 0);
alter table public.products add column if not exists cost_minor bigint not null default 0 check (cost_minor >= 0);
alter table public.products add column if not exists image_url text;
update public.products p set recurring = true, list_price_minor = coalesce((select min(pp.amount_minor) from public.pricing_plans pp where pp.product_id=p.id and pp.enabled),0)
where exists (select 1 from public.pricing_plans pp where pp.product_id=p.id);

drop policy if exists plans_customer_read on public.pricing_plans;
create policy plans_customer_read on public.pricing_plans for select to authenticated
using (enabled and business_id=(select public.current_business_id()) and exists (
  select 1 from public.products p where p.id=product_id and p.enabled and p.can_be_sold
));

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
  if not exists(select 1 from public.products where id=v_plan.product_id and enabled and can_be_sold) then raise exception 'This product is not currently available for sale.' using errcode = '22023'; end if;
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

grant execute on function public.customer_start_subscription(uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('brightloop-products', 'brightloop-products', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists brightloop_product_images_public_read on storage.objects;
create policy brightloop_product_images_public_read on storage.objects for select to public using (bucket_id='brightloop-products');
drop policy if exists brightloop_product_images_staff_insert on storage.objects;
create policy brightloop_product_images_staff_insert on storage.objects for insert to authenticated
with check (bucket_id='brightloop-products' and (storage.foldername(name))[1]=(select public.current_business_id())::text and (select public.is_business_staff()));
drop policy if exists brightloop_product_images_staff_update on storage.objects;
create policy brightloop_product_images_staff_update on storage.objects for update to authenticated
using (bucket_id='brightloop-products' and (storage.foldername(name))[1]=(select public.current_business_id())::text and (select public.is_business_staff()))
with check (bucket_id='brightloop-products' and (storage.foldername(name))[1]=(select public.current_business_id())::text and (select public.is_business_staff()));
drop policy if exists brightloop_product_images_staff_delete on storage.objects;
create policy brightloop_product_images_staff_delete on storage.objects for delete to authenticated
using (bucket_id='brightloop-products' and (storage.foldername(name))[1]=(select public.current_business_id())::text and (select public.is_business_staff()));
commit;
