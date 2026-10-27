# Llama List

Open https://llama-list.vercel.app

Small scope: sign in, add a task, rename it, complete or reopen it, and delete it. One list. No sample tasks. Existing tasks are kept. Tasks live in Supabase and return when you sign in from another browser. The list refreshes when you return to the tab and every 30 seconds while it is visible.

## Confirm the app works

1. Open the app. Use **Create an account** if you have not registered yet.
2. Sign up with **tijn@onehorizon.ai**, choose your password, and click the confirmation link in your email. Then sign in.
3. Add a task called **My check**. Rename it, tick it complete, and refresh the page. The name and completion state should remain.
4. Sign out and sign in again. The task should return. Signing in from another browser should show the same task.
5. Click **Delete**, then **Cancel** to keep it. Click **Delete** again, then **Delete task** to remove it. Refresh: it should remain gone.

The free Supabase email sender delivers only to organization team members, including the owner email above. It allows two emails per hour. Wider signup needs custom SMTP; it is outside this personal app's scope. Email confirmation stays enabled. [Supabase email limits](https://supabase.com/docs/guides/auth/auth-smtp).

## Confirm Stripe Projects works

Stripe provisioned the infrastructure. This app does not accept payments or have a checkout.

| Provider | Service | Active plan |
| --- | --- | --- |
| Supabase | Database and auth | Free |
| Vercel | Web hosting | Hobby (free) |

Open a terminal in this folder and run:

```sh
npm run check:services
```

The command checks that the project and both providers are linked, the free plans and resources are active, credentials can be pulled, Supabase auth responds, the latest production deployment is ready, and production has the matching public Supabase URL/key. It prints `PASS` or `FAIL` for each check and prints no secrets. It also queries Stripe's current-month spend; no charge entries were reported when checked on 14 October 2026.

For a visual check, open [Stripe Projects](https://dashboard.stripe.com/projects), choose **llama-list**, and confirm that Supabase and Vercel are listed. The local CLI check is the source of truth for plans and resource status. [Stripe Projects reference](https://docs.stripe.com/projects).

The checker uses the Stripe CLI on your PATH, or `STRIPE_CLI_PATH` if your CLI is installed elsewhere. On another machine, install the official Stripe CLI/plugin, link the existing project, and run `stripe projects env --pull`. Both `.projects/state.json` (provider/resource metadata) and `.projects/state.local.json` (project/account identifiers) are committed so Stripe's leaderboard can identify the project and validate the stack. Credentials, `.env`, the vault and CLI cache are excluded from Git.

## Development and verification

Use Node 22.12+ (tested with Node 24). Stripe owns `.projects/` and `.env`; do not edit those files manually or commit credentials.

```sh
npm ci
npm run dev
npm run build
npm test
node --env-file=.env scripts/test-database.mjs
node --env-file=.env scripts/test-api.mjs
```

The tests check task validation, stable sorting, owner CRUD, denial of guest/cross-account access, password login, separate-session persistence, refresh, and sign-out. Database fixtures roll back. API fixtures are removed afterward. Only use the integration scripts against this app's database.

The live browser was tested with a disposable QA account for sign-in, add, rename, cancel edit, complete/reopen, reload persistence, cancel delete, and sign-out. Actual deletion and cross-account access were checked through the API. Confirmation email delivery must be verified by the owner when registering; the QA account did not send email.

Only the public Supabase URL and publishable key enter the frontend build. Passwords and Vercel tokens stay local. RLS enforces task ownership. The database scripts use an encrypted shared-pooler connection; supply `SUPABASE_CA_CERT` from Supabase Database Settings for certificate verification.

## Deployment

```sh
node --env-file=.env scripts/vercel.mjs deploy --prod -y
```

Supabase's authentication return URL is `https://llama-list.vercel.app`. Vercel builds receive only the two public Supabase variables. Provider usage limits still apply. No paid service was added.
