-- Lead-Mailing (Indeed-Leads per Resend anschreiben) + Lead-Postfach.
-- APPLY MANUALLY via: bash scripts/migrate.sh

-- Globale Resend-Zugangsdaten (nur Admins/Service lesen system_settings).
alter table public.system_settings
  add column if not exists resend_api_key text,
  add column if not exists resend_webhook_secret text;

-- Lead-Felder an der Bewerbung.
alter table public.applications
  add column if not exists lead_source text,
  add column if not exists lead_mail_status text
    check (lead_mail_status is null or lead_mail_status in ('pending','sent','failed','bounced','unsubscribed','replied')),
  add column if not exists lead_mail_sent_at timestamptz,
  add column if not exists lead_mail_error text,
  add column if not exists lead_import_id uuid;

create index if not exists applications_lead_pending_idx
  on public.applications (tenant_id, created_at)
  where lead_mail_status = 'pending';
create index if not exists applications_lead_email_idx
  on public.applications (lower(email)) where lead_source is not null;

-- Versand-Einstellungen je Firma.
create table if not exists public.lead_mail_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  active boolean not null default false,
  sender_email text,
  sender_name text,
  subject text,
  body text,
  homepage_url text,
  calendly_url text,
  daily_limit integer not null default 50 check (daily_limit between 1 and 2000),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lead_mail_settings to authenticated;
grant all on public.lead_mail_settings to service_role;
alter table public.lead_mail_settings enable row level security;
drop policy if exists "admins manage lead_mail_settings" on public.lead_mail_settings;
create policy "admins manage lead_mail_settings" on public.lead_mail_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Importläufe (CSV).
create table if not exists public.lead_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  file_name text,
  total integer not null default 0,
  imported integer not null default 0,
  skipped integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lead_imports to authenticated;
grant all on public.lead_imports to service_role;
alter table public.lead_imports enable row level security;
drop policy if exists "admins manage lead_imports" on public.lead_imports;
create policy "admins manage lead_imports" on public.lead_imports
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Mailverlauf (gesendet + Antworten der Bewerber).
create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  direction text not null check (direction in ('out','in')),
  from_email text,
  to_email text,
  subject text,
  body_text text,
  provider_id text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lead_messages_app_idx on public.lead_messages (application_id, created_at);
create index if not exists lead_messages_open_idx on public.lead_messages (created_at desc) where direction = 'in' and handled = false;
create unique index if not exists lead_messages_provider_uniq on public.lead_messages (provider_id, direction) where provider_id is not null;
grant select, insert, update, delete on public.lead_messages to authenticated;
grant all on public.lead_messages to service_role;
alter table public.lead_messages enable row level security;
drop policy if exists "admins manage lead_messages" on public.lead_messages;
create policy "admins manage lead_messages" on public.lead_messages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
