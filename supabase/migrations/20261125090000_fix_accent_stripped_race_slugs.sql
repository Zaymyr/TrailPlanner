-- Three public race slugs were generated without stripping accents, so the
-- accented letters became hyphens (« Païens » -> « pa-ens »). Rename them to
-- readable slugs. The record_race_slug_redirect trigger stores each old slug
-- in race_slug_redirects, so the old URLs answer with a permanent redirect.
-- Guarded on the old slug: re-running this migration is a no-op.

update public.races set slug = 'ultra-trail-des-paiens-glf4'
where slug = 'ultra-trail-des-pa-ens-glf4';

update public.races set slug = 'ultra-trail-metropole-nice-cote-d-azur-100m-a788'
where slug = 'ultra-trail-m-tropole-nice-c-te-d-azur-100m-a788';

update public.races set slug = 'metis-trail-reunion-pubt'
where slug = 'm-tis-trail-reunion-pubt';

-- An import left an underscore in a format name shown as the page H1.
update public.races set name = '224km XGTV'
where id = '6054f45a-c302-4a29-a0e0-00e3a4eb7c0b' and name = '224km_XGTV';
