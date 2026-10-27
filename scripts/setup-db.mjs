import pg from 'pg';
import { readFile } from 'node:fs/promises';
const connectionString = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('Supabase database credentials are missing. Run stripe projects env --pull.');
const parsed = new URL(connectionString);
if (process.env.SUPABASE_DB_PASS) parsed.password = process.env.SUPABASE_DB_PASS;
parsed.searchParams.delete('sslmode');
// The shared pooler uses Supabase's private CA. Supply the dashboard CA for verification.
const ca = process.env.SUPABASE_CA_CERT;
const client = new pg.Client({connectionString:parsed.toString(),ssl:ca?{rejectUnauthorized:true,ca}:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
try {
  await client.connect();
  const existing = await client.query("select to_regclass('public.tasks') as name");
  if (!existing.rows[0].name) await client.query(await readFile(new URL('../supabase/schemas/tasks.sql', import.meta.url),'utf8'));
  const result=await client.query("select relrowsecurity as rls from pg_class where oid='public.tasks'::regclass");
  const policies=await client.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename='tasks'");
  if (!result.rows[0].rls || policies.rows[0].count!==4) throw new Error('Task isolation checks failed.');
  console.log('Task schema ready: RLS enabled, four ownership policies verified.');
  await client.query("notify pgrst, 'reload schema'");
} finally {await client.end();}
