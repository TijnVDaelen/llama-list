import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const bundled = fileURLToPath(new URL('../../../work/stripe-cli/node_modules/.bin/stripe', import.meta.url));
const stripe = process.env.STRIPE_CLI_PATH || (existsSync(bundled) ? bundled : 'stripe');
let failed = false;
function check(ok, message) { console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`); if (!ok) failed = true; }
function cli(args) {
  const result = spawnSync(stripe, ['projects', ...args, '--json'], { encoding: 'utf8', env: process.env });
  if (result.error) throw new Error('Stripe CLI is unavailable. Install @stripe/cli or set STRIPE_CLI_PATH.');
  const data = JSON.parse(result.stdout);
  if (!data.ok) throw new Error(data.error?.message || 'Stripe Projects command failed.');
  return data.data;
}
async function get(url, headers) {
  const result = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!result.ok) throw new Error(`Service returned HTTP ${result.status}`);
  return result.json();
}
try {
  const status = cli(['status']);
  check(status.project.name === 'llama-list', 'Stripe project is llama-list');
  for (const [provider, plan] of [['Supabase', 'free'], ['Vercel', 'hobby']]) {
    check(status.providers.some(p => p.name === provider && p.status === 'complete'), `${provider} linked through Stripe Projects`);
    check(status.plans.some(p => p.provider === provider && p.service_id === plan && p.status === 'complete'), `${provider} ${plan} plan active`);
    check(status.services.some(s => s.provider === provider && s.service_id === 'project' && s.status === 'complete'), `${provider} app resource provisioned`);
  }
  // Credential retrieval is tested, but values are never printed.
  const pulled = cli(['env', '--pull']);
  check(pulled.resources_synced === 4 && pulled.unmapped_entries.length === 0, 'Stripe credentials sync for all four resources');
  const spend = cli(['spend', '--duration', '1m']);
  console.log(spend.months.length === 0 ? 'INFO Stripe reports no charge entries this month' : 'INFO Stripe reports charge entries; inspect stripe projects spend');
  const settings = await get(process.env.SUPABASE_PROJECT_URL + '/auth/v1/settings', { apikey: process.env.SUPABASE_PUBLISHABLE_KEY });
  check(settings.external?.email === true && settings.disable_signup !== true, 'Supabase email/password auth available');
  check(settings.mailer_autoconfirm === false, 'Signup email confirmation enabled');
  const query = `?teamId=${process.env.VERCEL_ORG_ID}`;
  const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  const project = await get(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}${query}`, headers);
  check(project.name === 'llama-list', 'Vercel hosts the correct project');
  const deployments = await get(`https://api.vercel.com/v6/deployments${query}&projectId=${process.env.VERCEL_PROJECT_ID}&target=production&limit=1`, headers);
  check(deployments.deployments[0]?.state === 'READY', 'Latest production deployment ready');
  const remote = await get(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/env${query}&decrypt=true`, headers);
  const publicVars = remote.envs.filter(e => e.target?.includes('production'));
  check(publicVars.some(e => e.key === 'VITE_SUPABASE_URL' && e.value === process.env.SUPABASE_PROJECT_URL), 'Production uses this Supabase project');
  check(publicVars.some(e => e.key === 'VITE_SUPABASE_ANON_KEY' && e.value === process.env.SUPABASE_PUBLISHABLE_KEY), 'Production uses the synced public auth key');
  check(!publicVars.some(e => /DB_PASS|DB_URL|POOLER|SERVICE_ROLE|VERCEL_TOKEN/.test(e.key)), 'No private database or deployment credentials in production builds');
  console.log('INFO Stripe manages infrastructure here; this app does not take payments.');
} catch (error) { check(false, error.message); }
process.exitCode = failed ? 1 : 0;
