import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID || !process.env.VERCEL_ORG_ID) throw new Error('Run stripe projects env --pull first.');
const child=spawn('npx',['--yes','vercel@64.0.2',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,PATH:dirname(process.execPath)+':'+process.env.PATH,VERCEL_TELEMETRY_DISABLED:'1'}});
child.on('exit',code=>process.exit(code||0));
