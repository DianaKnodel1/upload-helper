-- Eigene Vorlagen für den Landing-Baukasten (Admin-only).
create table if not exists public.landing_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  sections jsonb not null default '[]'::jsonb,
  style jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.landing_templates to authenticated;
grant all on public.landing_templates to service_role;

alter table public.landing_templates enable row level security;

drop policy if exists "admins manage landing templates" on public.landing_templates;
create policy "admins manage landing templates"
  on public.landing_templates
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
