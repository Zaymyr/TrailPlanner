insert into storage.buckets (id, name, public)
values ('race-gpx', 'race-gpx', false)
on conflict (id) do nothing;
