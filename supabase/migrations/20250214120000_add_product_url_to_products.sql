-- Add optional product URL to products
alter table if exists public.products
  add column if not exists product_url text;
