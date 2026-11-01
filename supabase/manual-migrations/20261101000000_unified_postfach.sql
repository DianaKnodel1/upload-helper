-- Gemeinsames Postfach: Mails an Leads, Bewerber, Mitarbeiter und freie Adressen
-- in lead_messages; Signatur je Firma in lead_mail_settings.
alter table public.lead_messages add column if not exists profile_id uuid;
alter table public.lead_messages add column if not exists peer_email text;
alter table public.lead_messages add column if not exists kind text not null default 'lead';

update public.lead_messages
   set peer_email = lower(case when direction = 'in' then from_email else to_email end)
 where peer_email is null;

create index if not exists lead_messages_peer_idx on public.lead_messages (peer_email, created_at);
create index if not exists lead_messages_profile_idx on public.lead_messages (profile_id, created_at);

alter table public.lead_mail_settings add column if not exists sig_name text;
alter table public.lead_mail_settings add column if not exists sig_position text;
alter table public.lead_mail_settings add column if not exists sig_phone text;
alter table public.lead_mail_settings add column if not exists sig_website text;
alter table public.lead_mail_settings add column if not exists sig_color text;
