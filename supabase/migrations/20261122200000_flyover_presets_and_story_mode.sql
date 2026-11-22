-- Organizer flyover orders: clearly different basemaps and the organizer's choice of story mode.
--   * map_preset accepts the new presets "outdoors" (Mapbox Outdoors topo map) and "night"
--     (night satellite, orange route); "relief" and "cinema" stay valid for existing orders.
--   * story_mode: "highlights" (Temps forts) or "full" (Parcours complet), chosen on /survol. Null
--     for older orders, which keep the distance rule (up to 60 km full, beyond highlights).
-- Additive: existing rows stay valid; RLS and grants unchanged (service role only).

begin;

alter table public.flyover_video_orders drop constraint if exists flyover_video_orders_map_preset_check;
alter table public.flyover_video_orders
  add constraint flyover_video_orders_map_preset_check
  check (map_preset in ('signature', 'satellite', 'outdoors', 'night', 'relief', 'cinema'));

alter table public.flyover_video_orders
  add column story_mode text check (story_mode is null or story_mode in ('highlights', 'full'));

commit;
