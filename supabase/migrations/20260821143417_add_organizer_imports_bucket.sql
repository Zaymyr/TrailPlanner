insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'organizer-imports',
	'organizer-imports',
	false,
	26214400,
	array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy "Organizers upload temporary imports"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'organizer-imports'
		and (storage.foldername(name))[1] = (select auth.uid()::text)
	);

create policy "Organizers delete temporary imports"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'organizer-imports'
		and (storage.foldername(name))[1] = (select auth.uid()::text)
	);
