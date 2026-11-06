alter table public.lead_messages add column if not exists delivered_at timestamptz;
alter table public.lead_messages add column if not exists opened_at timestamptz;
alter table public.lead_messages add column if not exists open_count integer not null default 0;
alter table public.lead_messages add column if not exists bounced_at timestamptz;
