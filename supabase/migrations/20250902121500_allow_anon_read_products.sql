alter table if exists public.products enable row level security;

drop policy if exists "Anon can read live products" on public.products;
create policy "Anon can read live products" on public.products
for select
to anon
using (is_live = true and is_archived = false);
