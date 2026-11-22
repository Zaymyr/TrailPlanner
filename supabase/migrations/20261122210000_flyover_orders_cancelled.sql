-- Organizer flyover orders: the admin can cancel an order (Admin › Publications › Survols). A
-- cancelled order is never processed by the cron again; it can be resumed from the admin (back to
-- paid or scripted). The refund itself stays a Stripe dashboard action.
-- Additive: the status check gains 'cancelled'; RLS and grants unchanged (service role only).

begin;

alter table public.flyover_video_orders drop constraint if exists flyover_video_orders_status_check;
alter table public.flyover_video_orders
  add constraint flyover_video_orders_status_check
  check (status in ('pending_payment', 'paid', 'scripted', 'rendering', 'ready', 'failed', 'expired', 'refunded', 'cancelled'));

commit;
