const base=`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}`;
const query=`?teamId=${process.env.VERCEL_ORG_ID}`;
const headers={Authorization:`Bearer ${process.env.VERCEL_TOKEN}`,'Content-Type':'application/json'};
async function api(path,method,body){const r=await fetch(path,{method,headers,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error?.message||`Vercel API ${r.status}`);return d;}
await api(base+query,'PATCH',{framework:'vite',buildCommand:'npm run build',outputDirectory:'dist',ssoProtection:null});
await api(base+'/env'+query+'&upsert=true','POST',[
 {key:'VITE_SUPABASE_URL',value:process.env.SUPABASE_PROJECT_URL,type:'plain',target:['production','preview','development']},
 {key:'VITE_SUPABASE_ANON_KEY',value:process.env.SUPABASE_PUBLISHABLE_KEY,type:'plain',target:['production','preview','development']}
]);
console.log('Hosting configured. Only the public Supabase URL and publishable key are available to builds.');
