-- Affiliate offers and redirects remain available, but their obsolete engagement
-- telemetry and admin reporting are removed together.
drop function if exists public.get_admin_affiliate_metrics(date, date, text);

drop table if exists public.affiliate_events;
drop table if exists public.affiliate_click_events;

drop type if exists public.affiliate_event_type;
