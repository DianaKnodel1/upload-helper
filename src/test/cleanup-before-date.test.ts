// @vitest-environment node
import { readFileSync, mkdtempSync, chmodSync, chownSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Uses a disposable PostgreSQL instance, never the portal database.
const sql = readFileSync('scripts/cleanup-before-date.sh', 'utf8')
  .split('cat <<SQL\n')[1]?.split('\nSQL')[0]
  ?.replaceAll('$CUTOFF', '2026-08-01').replaceAll('$FINISH', 'COMMIT')
  .replaceAll('\\$', '$');
const dir = mkdtempSync(`${tmpdir()}/cleanup-pg-`);
const root = process.getuid?.() === 0;
function pg(command: string, args: string[]) {
  return root ? execFileSync('runuser', ['-u', 'nobody', '--', command, ...args], { encoding: 'utf8' })
    : execFileSync(command, args, { encoding: 'utf8' });
}
function query(value: string) {
  return execFileSync('psql', ['-h', dir, '-p', '55439', '-U', 'cleanup_test', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', value], { encoding: 'utf8' }).trim();
}
describe('cleanup cutoff 2026-08-01 (isolated PostgreSQL)', () => {
  beforeAll(() => {
    if (root) { chownSync(dir, 65534, 65534); chmodSync(dir, 0o700); }
    pg('initdb', ['-D', `${dir}/data`, '-A', 'trust', '-U', 'cleanup_test']);
    pg('pg_ctl', ['-D', `${dir}/data`, '-l', `${dir}/server.log`, '-o', `-k ${dir} -p 55439 -h ''`, '-w', 'start']);
  });
  afterAll(() => {
    try { pg('pg_ctl', ['-D', `${dir}/data`, '-m', 'immediate', '-w', 'stop']); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('deletes old accounts and old chats, preserves August chats, linked identities and admins, and rolls back previews', () => {
    if (!sql) throw new Error('Cleanup SQL block missing');
    query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.tenants(id uuid PRIMARY KEY);
      CREATE TABLE public.applications(id uuid PRIMARY KEY, created_at timestamptz);
      CREATE TABLE public.profiles(user_id uuid PRIMARY KEY, created_at timestamptz, application_id uuid);
      CREATE TABLE public.user_roles(user_id uuid, role text);
      CREATE TABLE public.chat_conversations(id uuid PRIMARY KEY, user_id uuid);
      CREATE TABLE public.chat_messages(id int PRIMARY KEY, sender_id uuid, receiver_id uuid, conversation_id uuid REFERENCES public.chat_conversations(id), created_at timestamptz);
      CREATE TABLE storage.objects(owner uuid, name text);
      INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid FROM generate_series(1,5) i;
      INSERT INTO public.profiles SELECT id, CASE WHEN id::text LIKE '%000003' THEN '2026-08-01'::timestamptz ELSE '2026-07-31'::timestamptz END, NULL FROM auth.users;
      INSERT INTO public.user_roles SELECT id, CASE WHEN id::text LIKE '%000004' THEN 'admin' ELSE 'user' END FROM auth.users;
      INSERT INTO public.applications VALUES ('00000000-0000-0000-0000-000000000011','2026-07-31'),('00000000-0000-0000-0000-000000000012','2026-08-01');
      UPDATE public.profiles SET application_id='00000000-0000-0000-0000-000000000012' WHERE user_id::text LIKE '%000005';
      INSERT INTO public.chat_conversations SELECT id,id FROM auth.users;
      INSERT INTO public.chat_messages VALUES
      (1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','2026-07-31 23:59:59+00'),
      (2,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','2026-08-01 00:00:00+00');`);
    query(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    expect(query('SELECT count(*) FROM auth.users')).toBe('5');
    expect(query('SELECT count(*) FROM public.chat_messages')).toBe('2');
    query(sql);
    expect(query('SELECT id FROM public.chat_messages ORDER BY id')).toBe('2');
    expect(query('SELECT count(*) FROM auth.users')).toBe('4');
    expect(query("SELECT count(*) FROM public.profiles WHERE user_id::text LIKE '%000002'")).toBe('1');
    expect(query("SELECT count(*) FROM public.profiles WHERE user_id::text LIKE '%000003'")).toBe('1');
    expect(query("SELECT count(*) FROM public.profiles WHERE user_id::text LIKE '%000004'")).toBe('1');
    expect(query("SELECT count(*) FROM public.profiles WHERE user_id::text LIKE '%000005'")).toBe('1');
    expect(query('SELECT id FROM public.applications')).toBe('00000000-0000-0000-0000-000000000012');
    expect(query('SELECT count(*) FROM public.chat_messages m JOIN public.chat_conversations c ON c.id=m.conversation_id JOIN public.profiles p ON p.user_id=c.user_id')).toBe('1');
  });
});