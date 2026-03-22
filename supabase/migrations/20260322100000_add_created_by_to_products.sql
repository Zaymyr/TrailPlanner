-- Add created_by to track which user created each product
alter table public.products
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists products_created_by_idx on public.products(created_by);

-- Allow authenticated users to read products they created (regardless of is_live status)
drop policy if exists "Users can read own products" on public.products;
create policy "Users can read own products" on public.products
  for select
  to authenticated
  using (auth.uid() = created_by);
