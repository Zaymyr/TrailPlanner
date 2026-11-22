-- Organizer flyover video orders (/survol): a standalone paid product, independent of the race
-- catalog. An organizer uploads a GPX, names the race, optionally lists aid stations, chooses a map
-- preset and an elevation exaggeration, and pays through Stripe Checkout:
--   * collab (29.99 EUR): the reel is published on the Pace Yourself Instagram account at the
--     chosen slot, with the organizer's account invited as collaborator;
--   * download (59.99 EUR): the MP4 is downloadable from the order page.
-- The cron route /api/cron/flyover-orders then writes the text, voices it and renders it on the
-- existing Cloud Run job, and emails the organizer when the video is ready.
--
-- Service role only (RLS on, no client policy), like video_render_jobs. The GPX lives in the private
-- race-gpx bucket under flyover/<order id>.gpx.
--
-- Existing objects: video_render_jobs.race_id becomes nullable (a flyover render has no catalog
-- race) and gains flyover_order_id, one of the two being required; social_posts gains
-- collaborators (Instagram usernames invited on the reel, empty for every existing row).

begin;

create or replace function public.set_flyover_video_orders_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_flyover_video_orders_updated_at() from public, anon, authenticated;

create table public.flyover_video_orders (
  id uuid primary key default gen_random_uuid(),
  offer text not null check (offer in ('collab', 'download')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency = 'eur'),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'scripted', 'rendering', 'ready', 'failed', 'expired', 'refunded')),
  race_name text not null check (char_length(btrim(race_name)) between 2 and 120),
  race_date date,
  contact_email text not null check (char_length(contact_email) between 3 and 320 and contact_email like '%@%'),
  -- Instagram username without "@"; required by the collab offer.
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  map_preset text not null check (map_preset in ('signature', 'satellite', 'relief', 'cinema')),
  terrain_exaggeration real not null default 1.8 check (terrain_exaggeration between 1 and 3),
  -- Collab only: Paris wall time "YYYY-MM-DDTHH:mm" of the Instagram publication.
  publish_local text check (publish_local is null or publish_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  -- [{ id uuid, name, km }], ids fixed at order time so every step tells the same stations.
  aid_stations jsonb not null default '[]'::jsonb check (jsonb_typeof(aid_stations) = 'array' and jsonb_array_length(aid_stations) <= 40),
  gpx_storage_path text not null check (char_length(gpx_storage_path) between 1 and 300),
  distance_km real not null check (distance_km > 0),
  elevation_gain_m real,
  elevation_loss_m real,
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  -- Pipeline: reel text and settings handed from the text step to the render step.
  work jsonb check (work is null or jsonb_typeof(work) = 'object'),
  attempts integer not null default 0 check (attempts >= 0),
  error text check (error is null or char_length(error) <= 1000),
  locked_until timestamptz,
  render_job_id uuid,
  social_post_id uuid references public.social_posts(id) on delete set null,
  ready_at timestamptz,
  paid_email_sent_at timestamptz,
  ready_email_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flyover_video_orders_collab_fields check (
    offer <> 'collab' or (instagram_handle is not null and publish_local is not null)
  )
);

create unique index flyover_video_orders_checkout_session_uidx
  on public.flyover_video_orders (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index flyover_video_orders_status_idx on public.flyover_video_orders (status, paid_at);
create index flyover_video_orders_payment_intent_idx on public.flyover_video_orders (stripe_payment_intent_id);
create index flyover_video_orders_social_post_idx on public.flyover_video_orders (social_post_id);

create trigger set_flyover_video_orders_updated_at
before update on public.flyover_video_orders
for each row execute function public.set_flyover_video_orders_updated_at();

alter table public.flyover_video_orders enable row level security;
revoke all on table public.flyover_video_orders from public, anon, authenticated;
grant select, insert, update, delete on table public.flyover_video_orders to service_role;

-- Renders of an order: no catalog race.
alter table public.video_render_jobs alter column race_id drop not null;
alter table public.video_render_jobs
  add column flyover_order_id uuid references public.flyover_video_orders(id) on delete set null;
alter table public.video_render_jobs
  add constraint video_render_jobs_race_or_flyover check (race_id is not null or flyover_order_id is not null);
create index video_render_jobs_flyover_order_idx on public.video_render_jobs (flyover_order_id);

alter table public.flyover_video_orders
  add constraint flyover_video_orders_render_job_fkey
  foreign key (render_job_id) references public.video_render_jobs(id) on delete set null;
create index flyover_video_orders_render_job_idx on public.flyover_video_orders (render_job_id);

-- Instagram collaborators of a reel (usernames, at most 3 per the Graph API).
alter table public.social_posts
  add column collaborators text[] not null default '{}'::text[];
alter table public.social_posts
  add constraint social_posts_collaborators_max check (cardinality(collaborators) <= 3);

commit;
