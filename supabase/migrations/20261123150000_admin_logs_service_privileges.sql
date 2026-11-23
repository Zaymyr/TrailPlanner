-- Admin console logs: restrict the service role to what the app needs.
-- 20261123090000 and 20261123120000 revoked every client privilege and granted the service role
-- `select, insert, delete`, but Supabase's default privileges had already given the service role
-- every privilege on these new tables (update, truncate, references, trigger), found by
-- supabase/tests/admin_audit_log_checks.sql in production. The audit journal must be append-only.
-- Idempotent; no data change.

begin;

revoke all on table public.admin_audit_log from service_role;
grant select, insert, delete on table public.admin_audit_log to service_role;

revoke all on table public.transactional_email_log from service_role;
grant select, insert, delete on table public.transactional_email_log to service_role;

commit;
