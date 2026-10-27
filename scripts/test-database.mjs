import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const parsed=new URL(process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL);
parsed.searchParams.delete('sslmode'); parsed.password=process.env.SUPABASE_DB_PASS;
const ca=process.env.SUPABASE_CA_CERT;
const db=new pg.Client({connectionString:parsed.toString(),ssl:ca?{rejectUnauthorized:true,ca}:{rejectUnauthorized:false}});
try {
 await db.connect();await db.query('begin');
 const a=randomUUID(),b=randomUUID();
 await db.query('insert into auth.users(id) values ($1),($2)',[a,b]);
 await db.query("insert into public.tasks(user_id,title) values ($1,'own task'),($2,'other task')",[a,b]);
 await db.query('set local role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[a]);
 assert.equal((await db.query('select * from public.tasks')).rows.length,1);
 assert.equal((await db.query("update public.tasks set title='edited' where user_id=$1 returning *",[b])).rowCount,0);
 assert.equal((await db.query("update public.tasks set completed=true where user_id=$1 returning *",[a])).rowCount,1);
 assert.equal((await db.query('delete from public.tasks where user_id=$1 returning *',[b])).rowCount,0);
 await db.query('savepoint forged_owner');
 try {await db.query("insert into public.tasks(user_id,title) values($1,'forged')",[b]);assert.fail('Foreign-owned insert succeeded');}catch(e){assert.equal(e.code,'42501');await db.query('rollback to savepoint forged_owner');}
 await db.query('savepoint reassign_owner');
 try{await db.query('update public.tasks set user_id=$1 where user_id=$2',[b,a]);assert.fail('Ownership reassignment succeeded');}catch(e){assert.equal(e.code,'42501');await db.query('rollback to savepoint reassign_owner');}
 assert.equal((await db.query("insert into public.tasks(user_id,title) values($1,'new task') returning *",[a])).rowCount,1);
 assert.equal((await db.query("delete from public.tasks where user_id=$1 and title='new task' returning *",[a])).rowCount,1);
 await db.query('reset role');await db.query('set local role anon');await db.query('savepoint guest');
 try{await db.query('select * from public.tasks');assert.fail('Guest read succeeded');}catch(e){assert.equal(e.code,'42501');await db.query('rollback to savepoint guest');}
 console.log('PASS: owner CRUD, cross-account read/update/delete isolation, forged inserts, ownership reassignment, guest denial.');
}finally{await db.query('rollback').catch(()=>{});await db.end();}
