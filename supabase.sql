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

-- Purabi Corner business day convention:
-- 03:00 local store time through 02:59:59 the following calendar day.
-- The reset is a query boundary. Historical rows are retained.
