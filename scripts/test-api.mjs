import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.SUPABASE_PROJECT_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
const u=new URL(process.env.SUPABASE_POOLER_URL);u.password=process.env.SUPABASE_DB_PASS;u.searchParams.delete('sslmode');
const ca=process.env.SUPABASE_CA_CERT;
const db=new pg.Client({connectionString:u.toString(),ssl:ca?{rejectUnauthorized:true,ca}:{rejectUnauthorized:false}});
const ids=[randomUUID(),randomUUID()],password=randomBytes(24).toString('base64url');
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=client(),b=client();
try{
 await db.connect();
 for(const id of ids){
  const email=`qa-${id}@example.invalid`;
  // Disposable, confirmed fixtures: no confirmation emails are sent.
  await db.query("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,'{}'::jsonb,now(),now(),'','','','')",[id,email,password]);
  await db.query("insert into auth.identities(user_id,provider_id,identity_data,provider,created_at,updated_at) values ($1::uuid,$1::text,jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',true),'email',now(),now())",[id,email]);
 }
 for(const [c,id] of [[a,ids[0]],[b,ids[1]]]){const r=await c.auth.signInWithPassword({email:`qa-${id}@example.invalid`,password});if(r.error)throw r.error;assert.equal(r.data.user.id,id);}
 const added=await a.from('tasks').insert({title:'API persistence check',user_id:ids[0],priority:'high',category:'Work',due_date:'2026-10-15'}).select().single();if(added.error)throw added.error;
 const id=added.data.id;
 const c=client();const signed=await c.auth.signInWithPassword({email:`qa-${ids[0]}@example.invalid`,password});if(signed.error)throw signed.error;
 const loaded=await c.from('tasks').select('*').eq('id',id).single();assert.equal(loaded.data?.title,'API persistence check');
 const other=await b.from('tasks').select('*').eq('id',id);assert.deepEqual(other.data,[]);
 const updated=await a.from('tasks').update({completed:true}).eq('id',id).select().single();assert.equal(updated.data?.completed,true);
 const forbidden=await b.from('tasks').update({title:'forbidden'}).eq('id',id).select();assert.deepEqual(forbidden.data,[]);
 const refreshed=await a.auth.refreshSession();if(refreshed.error)throw refreshed.error;assert.ok(refreshed.data.session);
 const removed=await a.from('tasks').delete().eq('id',id).select().single();assert.equal(removed.data?.id,id);
 await Promise.all([a.auth.signOut(),b.auth.signOut(),c.auth.signOut()]);
 console.log('PASS: password login, separate-session persistence, task CRUD, REST account isolation, session refresh, sign out.');
}finally{
 await db.query('delete from auth.users where id=any($1::uuid[])',[ids]).catch(()=>{});
 await db.end();
}
