-- Bild-Speicher für den Landing-Baukasten: Bucket „landing-media".
-- Bilder werden im Baukasten (Admin) direkt hochgeladen und per öffentlicher
-- https-URL in die Abschnitte (sections JSON) eingefügt. Der Landing-Server
-- lädt sie einfach per URL — keine Sync-Änderung nötig.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media',
  'landing-media',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Daten-API-Zugriff (Storage-REST geht über PostgREST).
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- Idempotent: Policies ggf. neu anlegen (Rollen liegen in public.user_roles,
-- geprüft über public.has_role — profiles hat KEINE role-Spalte).
drop policy if exists "landing-media public read" on storage.objects;
drop policy if exists "landing-media admin insert" on storage.objects;
drop policy if exists "landing-media admin update" on storage.objects;
drop policy if exists "landing-media admin delete" on storage.objects;

-- Jeder darf Landing-Bilder lesen (öffentlich ausgelieferte Seiten).
create policy "landing-media public read"
on storage.objects for select
using (bucket_id = 'landing-media');

-- Hochladen nur für Portal-Admins.
create policy "landing-media admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'landing-media'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

create policy "landing-media admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'landing-media'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'landing-media'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

create policy "landing-media admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'landing-media'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);
