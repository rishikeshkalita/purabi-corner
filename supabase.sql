create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  profit_margin numeric(12,2) not null default 0 check (profit_margin >= 0),
  image_url text
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  timestamp timestamptz not null default now(),
  price_charged numeric(12,2) not null check (price_charged >= 0),
  profit_recorded numeric(12,2) not null default 0 check (profit_recorded >= 0)
);

create index if not exists sales_timestamp_idx on sales(timestamp desc);
create index if not exists sales_product_timestamp_idx on sales(product_id, timestamp desc);

alter table products enable row level security;
alter table sales enable row level security;

create policy "public read products" on products for select using (true);
create policy "public manage products" on products for all using (true) with check (true);
create policy "public read sales" on sales for select using (true);
create policy "public manage sales" on sales for all using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/*'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/*'];

create policy "public product image uploads" on storage.objects for insert with check (bucket_id='product-images');
create policy "public product image updates" on storage.objects for update using (bucket_id='product-images') with check (bucket_id='product-images');
create policy "public product image deletes" on storage.objects for delete using (bucket_id='product-images');

create or replace function public.delete_latest_sale(p_product_id uuid,p_business_day_start timestamptz,p_business_day_end timestamptz)
returns uuid language plpgsql security invoker set search_path=public as $$
declare deleted_id uuid;
begin
 delete from public.sales where id=(select id from public.sales where product_id=p_product_id and timestamp>=p_business_day_start and timestamp<p_business_day_end order by timestamp desc,id desc limit 1) returning id into deleted_id;
 return deleted_id;
end;
$$;
grant execute on function public.delete_latest_sale(uuid,timestamptz,timestamptz) to anon,authenticated;

-- Business day: 03:00 local store time through 02:59:59 next day. Historical rows are retained.
