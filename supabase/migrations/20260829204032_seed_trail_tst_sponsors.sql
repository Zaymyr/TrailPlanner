insert into public.race_event_edition_sponsors (
  id,
  edition_id,
  name,
  logo_url,
  website_url,
  is_active,
  show_on_loading,
  show_in_banner,
  position,
  click_count
)
values
  (
    '7a110000-5001-4000-8000-000000000001',
    '7a110000-0000-4000-8000-000000000002',
    'Nivalis Outdoor',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/sponsors/nivalis-outdoor.png',
    'https://example.com/?sponsor=nivalis-outdoor',
    true,
    true,
    true,
    0,
    0
  ),
  (
    '7a110000-5002-4000-8000-000000000002',
    '7a110000-0000-4000-8000-000000000002',
    'Torrent Libre',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/sponsors/torrent-libre.png',
    'https://example.com/?sponsor=torrent-libre',
    true,
    true,
    true,
    1,
    0
  ),
  (
    '7a110000-5003-4000-8000-000000000003',
    '7a110000-0000-4000-8000-000000000002',
    'Refuge 1800',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/sponsors/refuge-1800.png',
    'https://example.com/?sponsor=refuge-1800',
    true,
    false,
    true,
    2,
    0
  )
on conflict (id) do update set
  edition_id = excluded.edition_id,
  name = excluded.name,
  logo_url = excluded.logo_url,
  website_url = excluded.website_url,
  is_active = excluded.is_active,
  show_on_loading = excluded.show_on_loading,
  show_in_banner = excluded.show_in_banner,
  position = excluded.position;
