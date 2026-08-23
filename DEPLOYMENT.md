# Repnote Cloudflare Deployment Guide

This document is the deployment contract for a clean Repnote installation. A human or coding agent should be able to follow it without access to the original private project.

## 1. What this deployment creates

The finished installation consists of:

1. One Cloudflare Worker serving the UI and application API.
2. One Cloudflare D1 database bound to the Worker as `DB`.
3. One custom hostname, such as `workout.example.com`.
4. One Cloudflare Access self-hosted application protecting the entire hostname.
5. One Google OAuth web client used by Cloudflare Access.
6. One Access Allow policy restricted to the owner's exact Gmail address.

Google authentication is terminated by Cloudflare Access. Repnote does not receive Google access tokens, does not call Gmail APIs, and does not require Gmail, Drive, Calendar, or other Google data scopes. The Worker receives only Cloudflare's authenticated email header and verifies it again before serving any application API.

Useful official references:

- [Cloudflare D1: create and bind a database](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Wrangler configuration and Custom Domains](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Access Google identity provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)
- [Cloudflare Access self-hosted public application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Google OAuth web-server credentials](https://developers.google.com/identity/protocols/oauth2/web-server)

## 2. Security properties that must remain true

Do not weaken these invariants during deployment:

- The custom hostname is covered in full by a Cloudflare Access application.
- The Access Allow policy includes the owner's **exact email**, not `Everyone`, all valid emails, or an unrestricted email domain.
- Google is the selected login method.
- `OWNER_EMAIL` exactly matches the email in the Access policy.
- `OWNER_HOST` exactly matches the deployed hostname without `https://` or a path.
- The D1 binding remains named `DB`.
- `DEV_AUTH_BYPASS` remains `false` in deployed configuration.
- The Google OAuth Client Secret is entered only in the Cloudflare dashboard. Never put it in this repository, Wrangler variables, `.dev.vars`, shell history, CI logs, issues, or chat messages.
- Do not add a Guest/Bypass Access policy and do not expose `/api/*` separately.
- Do not trust a client-supplied email header without Cloudflare Access in front of the hostname. The Worker check is defense in depth, not a replacement for Access.

Cloudflare Access denies users by default unless they match an Allow policy. Avoid an `Include Everyone` policy; Cloudflare explicitly documents that it allows anyone to reach the application.

## 3. Prerequisites

The deployer needs:

- Node.js `22.13.0` or newer.
- pnpm (Corepack is acceptable).
- A Cloudflare account.
- A registered domain in an active Cloudflare DNS zone. If the deployer does not own one yet, complete section 3.2 before continuing.
- Permission to create Workers, D1 databases, custom domains, and Zero Trust Access resources.
- A Google account that will own the app and sign in to it.
- Access to Google Cloud Console for creating one OAuth client.

### 3.1 Agent execution protocol and human checkpoints

This guide is designed for an agent-assisted deployment, but several steps require a human because they involve payment, account ownership, secrets, interactive authentication, or an irreversible production change.

An agent following this guide must:

1. Read the entire guide before changing local or remote state.
2. Ask the human for the deployment values in section 4; never infer an email, domain, account, or preferred hostname from unrelated context.
3. Stop at every **HUMAN ACTION REQUIRED** checkpoint and explain exactly what the human must do, what value or confirmation is needed, and how to verify completion.
4. Never ask the human to paste an OAuth Client Secret, Cloudflare token, password, session cookie, payment information, or domain-contact information into chat or a tracked file.
5. Never purchase or transfer a domain, accept a price, create a billable resource, apply a remote migration, deploy to production, or change an Access policy without explicit authorization for that action.
6. Resume only after the human confirms that the checkpoint is complete. Recheck the observable state when CLI or dashboard access makes that possible.
7. Report the exact verification results at the end; do not treat a successful build as a successful deployment.

Before starting, the agent must ask the human to confirm all of the following:

- a Cloudflare account exists, its email is verified, and the human can complete interactive login;
- the intended Cloudflare account has permission to use Workers, D1, DNS, and Zero Trust;
- a Google account exists and can create or own the OAuth configuration;
- either a suitable domain is already active in Cloudflare or the human is willing to purchase/connect one;
- the exact Gmail address that should be the only allowed owner;
- the human understands that domain registration may cost money and that production mutations will require separate approvals later.

If any answer is unknown, the agent must explain and resolve that prerequisite before creating resources.

Responsibility summary:

| Task | Agent can prepare/verify | Human must do or explicitly approve |
| --- | --- | --- |
| Choose domain and hostname | Explain options and validate formatting | Choose the name; approve any purchase or transfer and price |
| Domain registration/contact | Link to the correct dashboard and verify zone status afterward | Enter contact/payment data, accept registrar terms, verify registrant email |
| Wrangler authentication | Run `wrangler whoami` after login | Complete interactive browser login and grant Cloudflare access |
| D1 creation | Run the command after authorization and record the non-secret database ID in config | Explicitly approve creation in the intended Cloudflare account |
| Google OAuth | Provide exact origins, redirect URI, scopes, and validation steps | Sign in to Google, create/select the project and OAuth client, handle the Client Secret |
| Cloudflare Access | Explain the application and exact-email policy; verify behavior | Paste the Google Client Secret into Cloudflare and confirm the policy/account choices |
| Remote migrations | Inspect SQL, run local validation, and show the planned target | Explicitly approve applying migrations to the named remote D1 database |
| Production deploy | Build, test, show target Worker/domain, and deploy after approval | Explicitly approve the production deployment |
| Login verification | Check public HTTP behavior | Complete the first Google login and test an allowed/denied account where needed |

Some dashboard steps may be automated by APIs in advanced environments. They still require explicit human authorization when they create charges, expose resources, change authentication, or mutate production data.

### 3.2 Acquire or connect a domain

Repnote requires a custom hostname such as `workout.example.com`. The deployer must own the parent domain and the domain must be active in the same Cloudflare account that will host the Worker.

There are two supported starting points.

#### Option A: the human does not own a domain yet

**STOP — HUMAN ACTION REQUIRED**

The human must purchase a domain before deployment can continue. Domain registration is a paid, contractual action and must not be performed by an agent without the human reviewing the exact domain, current registration and renewal price, registrant details, auto-renew behavior, and terms.

Recommended dashboard workflow:

1. Verify the Cloudflare account email.
2. In Cloudflare Dashboard, open **Domain Registration → Register Domains**.
3. Search for the exact desired domain and review its current availability and price.
4. Enter accurate registrant contact and payment information privately in the Cloudflare dashboard.
5. Review the registration term, renewal behavior, and agreements, then complete the purchase.
6. Open the confirmation email and complete registrant-email verification if requested. An unverified registrant email can place the domain on hold.
7. Confirm the domain appears as active in Cloudflare.

Official instructions: [Register a new domain with Cloudflare Registrar](https://developers.cloudflare.com/registrar/get-started/register-domain/).

The human should tell the agent only:

- the registered domain name;
- the chosen application hostname, such as `workout.example.com`;
- confirmation that the zone is active.

Payment details and registrant contact information are not needed by the application or agent.

#### Option B: the human already owns a domain

If the domain is already managed by Cloudflare and its zone status is **Active**, choose an unused hostname and continue.

If the domain is registered elsewhere and is not yet active in Cloudflare, the human must add the domain to Cloudflare and update the authoritative nameservers at the current registrar. Wait until Cloudflare reports the zone as **Active** before deploying. The domain does not have to be transferred to Cloudflare Registrar; it only needs to use an active Cloudflare DNS zone for this deployment.

Official overview: [Manage domains with Cloudflare](https://developers.cloudflare.com/fundamentals/manage-domains/).

**Checkpoint confirmation:** The agent must obtain and restate the final `APP_DOMAIN` and confirm that the parent zone is active before creating production resources.

### 3.3 Prepare the local environment and authenticate Wrangler

Check local tools:

```bash
node --version
pnpm --version
```

Install dependencies from the repository root:

```bash
pnpm install
```

**STOP — HUMAN ACTION REQUIRED**

The human must confirm which Cloudflare account should receive the deployment. Start interactive Wrangler authentication, let the human complete the browser login and authorization privately, then use `whoami` to show the account identity for confirmation:

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Do not create or paste a broad Cloudflare API token into source files. Interactive Wrangler login is the simplest setup for a one-owner deployment.

## 4. Choose deployment values

Decide these values before editing files:

| Name | Example | Rules |
| --- | --- | --- |
| `APP_DOMAIN` | `workout.example.com` | Must be inside a Cloudflare-managed zone. |
| `OWNER_EMAIL` | `owner@gmail.com` | Exact Google account allowed to sign in. |
| `D1_DATABASE_NAME` | `repnote` | Keep `repnote` if using the included package script. |
| `WORKER_NAME` | `repnote` | Must be unique enough within the Cloudflare account. |
| `ACCESS_TEAM_NAME` | `my-team` | Produces `my-team.cloudflareaccess.com`. |

These are configuration values, not secrets. The Google Client Secret is a secret and is not one of these values.

## 5. Create the D1 database

**STOP — HUMAN APPROVAL REQUIRED**

Before running the command, the agent must state the authenticated Cloudflare account, proposed database name, and that this creates a remote resource. Continue only after the human approves that target.

Create the production database:

```bash
pnpm exec wrangler d1 create repnote
```

Wrangler prints a D1 UUID and a configuration block. Save the UUID as `D1_DATABASE_ID`. If Wrangler asks whether it should edit the config automatically, either answer `No` and edit manually or carefully review its edit so the binding remains `DB`.

Open `wrangler.jsonc` and replace all placeholders:

```jsonc
{
  "name": "repnote",
  "routes": [
    {
      "pattern": "workout.example.com",
      "custom_domain": true
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "repnote",
      "database_id": "YOUR_REAL_D1_UUID",
      "migrations_dir": "drizzle"
    }
  ],
  "vars": {
    "OWNER_EMAIL": "owner@gmail.com",
    "OWNER_HOST": "workout.example.com",
    "DEV_AUTH_BYPASS": "false"
  }
}
```

Required replacements:

- Replace `workout.example.com` in both `routes[0].pattern` and `OWNER_HOST`.
- Replace `you@gmail.com` with the exact owner email.
- Replace the all-zero database UUID with the UUID returned by D1 creation.
- Optionally change the Worker name, but keep it consistent in operational documentation.

Do not change the binding from `DB`; application code imports that exact binding.

## 6. Apply migrations and seed exercises

First validate the migrations against a local D1 database:

```bash
pnpm exec wrangler d1 migrations apply repnote --local
```

After local validation, the agent must inspect every pending SQL migration and summarize the tables, schema changes, seed data, and any destructive statements.

**STOP — HUMAN APPROVAL REQUIRED**

The agent must show the exact remote D1 database name and pending migration list. Apply remote migrations only after the human explicitly approves this production data change.

Then apply them to the remote database:

```bash
pnpm exec wrangler d1 migrations apply repnote --remote
```

Confirm when Wrangler prompts. Wrangler records applied migrations in its D1 migrations table and applies each migration atomically.

The final `0004_seed_exercises.sql` migration inserts 49 exercise names with `INSERT OR IGNORE`. It contains no personal workouts. Verify the remote seed:

```bash
pnpm exec wrangler d1 execute repnote --remote --command "SELECT COUNT(*) AS exercise_count FROM exercises WHERE user_id = 'owner';"
```

Expected result:

```text
exercise_count = 49
```

Also verify that no workout data was distributed:

```bash
pnpm exec wrangler d1 execute repnote --remote --command "SELECT COUNT(*) AS workout_count FROM workouts;"
```

Expected result for a clean installation:

```text
workout_count = 0
```

## 7. Set up a Cloudflare Zero Trust team

**STOP — HUMAN ACTION REQUIRED**

The human must complete any first-time Zero Trust account onboarding, review any plan selection, and choose the team name. The agent should not select a paid plan or accept organization terms on the human's behalf.

In Cloudflare Dashboard:

1. Open **Zero Trust**.
2. Complete the initial Zero Trust onboarding if the account has not used it before.
3. Choose an Access team name.
4. Find the resulting team domain under the Zero Trust team settings. It will look like:

   ```text
   https://my-team.cloudflareaccess.com
   ```

Record the team-name portion. The exact team domain is needed for Google OAuth configuration.

## 8. Create the Google OAuth application

Follow Cloudflare's [official Google identity-provider guide](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/). The important values are repeated here to prevent redirect mistakes.

**STOP — HUMAN ACTION REQUIRED**

The human must sign in to Google Cloud Console and own the project and OAuth client. The agent may provide field values and inspect non-secret configuration, but the human must handle account selection, consent, and the Client Secret privately.

### 8.1 Create or select a Google Cloud project

1. Sign in to Google Cloud Console with the intended owner account.
2. Create a dedicated project, for example `Repnote Auth`, or select an existing project dedicated to authentication.
3. Open **Google Auth Platform** / **APIs & Services**.

No paid Google API and no Gmail API is required for basic identity login.

### 8.2 Configure the consent screen

1. Start Google Auth Platform setup.
2. App name: `Repnote` (or your fork's name).
3. User support email: the owner's email.
4. Audience: **External** for a normal consumer Gmail account.
5. Contact email: the owner's email.
6. Request only the basic identity scopes required by Cloudflare (`openid`, profile, and email). Do not add Gmail, Drive, or Calendar scopes.
7. If the app remains in **Testing**, add the owner Gmail address as a test user.

For a single-owner installation, Testing plus an explicit test user is sufficient. If the deployer later allows many unrelated Google users, they should review Google's production/publishing requirements rather than widening Access first.

### 8.3 Create the OAuth client

Create a client with application type **Web application**.

Assuming the Access team domain is `https://my-team.cloudflareaccess.com`, configure:

Authorized JavaScript origin:

```text
https://my-team.cloudflareaccess.com
```

Authorized redirect URI:

```text
https://my-team.cloudflareaccess.com/cdn-cgi/access/callback
```

The redirect URI must match exactly, including scheme and path. Do not use the Repnote application domain as the Google redirect URI; Google redirects back to Cloudflare Access.

After creation, Google displays:

- OAuth Client ID
- OAuth Client Secret

Keep the secret in a password manager until it is entered into Cloudflare. Do not download or commit a `client_secret.json` file into this repository.

**Checkpoint confirmation:** The human should confirm only that the OAuth client exists and that the Client ID and Client Secret are available privately. The secret itself must not be sent to the agent or pasted into chat.

## 9. Add Google as the Cloudflare Access identity provider

**STOP — HUMAN ACTION REQUIRED**

The human must paste the Google Client Secret directly from their password manager or Google Cloud into the Cloudflare dashboard. Do not place the secret in a terminal command, repository file, screenshot, issue, or chat message.

In Cloudflare Dashboard:

1. Go to **Zero Trust → Integrations → Identity providers**.
2. Select **Add new identity provider**.
3. Choose **Google**.
4. Paste the Google OAuth Client ID into the App ID / Client ID field.
5. Paste the Google OAuth Client Secret into the Client Secret field.
6. Optionally enable PKCE.
7. Save.
8. Use Cloudflare's **Test** action for the new Google provider.
9. Confirm Google returns the exact intended owner email.

The OAuth secret now lives in Cloudflare's managed identity-provider configuration, not in the Worker.

## 10. Create the Access application and exact-email policy

**STOP — HUMAN CONFIRMATION REQUIRED**

Before saving, the human must review the hostname, exact allowed email, selected Google identity provider, policy action, and session duration. This policy controls who can access all workout data.

In Cloudflare Dashboard:

1. Go to **Zero Trust → Access controls → Applications**.
2. Select **Create new application**.
3. Choose **Self-hosted and private**.
4. Add a public hostname equal to `APP_DOMAIN`, for example `workout.example.com`.
5. Do not add a public path exception. The application must cover the root and all paths, including `/api/*` and static assets.
6. Add an Access policy:
   - Policy name: `Allow Repnote owner`
   - Action: **Allow**
   - Include selector: **Emails**
   - Value: the exact `OWNER_EMAIL`
7. If the UI offers a login-method requirement, require the Google identity provider created above.
8. Choose a suitable session duration.
9. Save the policy and application.

Do **not** configure any of these:

- `Include Everyone`
- `Include all valid emails`
- A broad `Emails ending in @gmail.com` rule
- A `Bypass` policy
- One-time PIN as an unrestricted Include rule
- A separate public API application

Cloudflare Access should be the only public entry gate. Application API handlers also require both the configured hostname and Cloudflare's `cf-access-authenticated-user-email` header to match the owner.

## 11. Build and deploy

Run the repository tests before deployment:

```bash
pnpm test
```

The agent must report the test result and show the final Worker name, custom hostname, D1 database name/ID, and Access-protection status.

**STOP — HUMAN APPROVAL REQUIRED**

Deploy only after the human explicitly approves this production target. A previous approval to edit code or create D1 does not automatically authorize deployment.

Deploy:

```bash
pnpm deploy:cloudflare
```

Wrangler builds the vinext application, uploads static assets, deploys the Worker, attaches the D1 binding, and configures the custom domain declared in `wrangler.jsonc`. Cloudflare Custom Domains handle the required DNS record and certificate for a domain in the account's active zone.

Record the Worker version ID printed by Wrangler in the deployment log or release notes. Do not record credentials.

## 12. Production verification

Run these checks in order.

### 12.1 Access gate

From a signed-out terminal:

```bash
curl -sS -o /dev/null -D - https://workout.example.com/
```

Expected: an HTTP redirect (normally `302`) to a Cloudflare Access login URL.

Trying to forge the application header should still be stopped by Access before the Worker:

```bash
curl -sS -o /dev/null -D - \
  -H 'cf-access-authenticated-user-email: owner@gmail.com' \
  https://workout.example.com/api/workouts
```

Expected: Cloudflare Access login redirect, not workout JSON.

### 12.2 Google login

**STOP — HUMAN ACTION REQUIRED**

The human must complete the first Google sign-in in a browser. Passwords, MFA codes, OAuth consent, and Cloudflare session cookies must remain private. The agent may guide the process and verify the resulting page, but must not request these credentials.

1. Open the app domain in a private browser window.
2. Select Google.
3. Sign in with the exact owner account.
4. Confirm the Workouts page loads.
5. Sign out or use another Google account and confirm it is denied by the Access policy.

### 12.3 Seed data

Open **Manage exercises** from the Workouts menu. Confirm:

- 49 exercises appear.
- Bench Press, Deadlift, Pull-Up, Row, and Squat are marked frequent.
- Frequencies begin at zero.

### 12.4 Draft persistence

1. Create a new workout.
2. Add an exercise and a set.
3. Wait at least one second for autosave.
4. Reload the browser.
5. Confirm the create button indicates a resumable workout and that opening it restores the draft.

Optional D1 verification:

```bash
pnpm exec wrangler d1 execute repnote --remote --command "SELECT id, status, workout_date, updated_at FROM workouts ORDER BY updated_at DESC LIMIT 5;"
```

The unfinished row should have `status = 'draft'`.

### 12.5 Atomic completion

1. Finish and save the draft.
2. Confirm it appears in the Workouts list immediately.
3. Refresh and confirm it remains present.
4. Query D1 again and confirm the row has `status = 'completed'`.
5. Confirm no `draft` row remains for that session.

### 12.6 RM Calculator

1. Open the RM tab.
2. Enter a weight and a rep count from 1–15.
3. Confirm NSCA, Brzycki, and Epley columns populate.
4. Switch between LBS and KG.
5. Confirm the page scrolls on a mobile browser.

## 13. Local development

Copy the example local variables:

```bash
cp .dev.vars.example .dev.vars
```

Apply local migrations:

```bash
pnpm exec wrangler d1 migrations apply repnote --local
```

Start the app:

```bash
pnpm dev
```

The example sets `DEV_AUTH_BYPASS=true`. The server accepts that bypass only if the request URL hostname is exactly `localhost` or `127.0.0.1`. A deployed hostname still requires Cloudflare Access even if someone accidentally sets that variable to true. Production should nevertheless keep it explicitly set to `false`.

Do not commit `.dev.vars`; it is ignored by Git.

## 14. API surface

These endpoints exist only for the authenticated web app. There is no CLI API and no service-token flow.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/workouts` | Read completed workouts. |
| `POST` | `/api/workouts` | Complete/create/update a workout and rebuild frequency/PR data. |
| `DELETE` | `/api/workouts?id=...` | Delete a completed workout and rebuild derived data. |
| `GET` | `/api/draft` | Read the current D1 draft. |
| `PUT` | `/api/draft` | Autosave the current draft. |
| `DELETE` | `/api/draft?id=...` | Explicitly discard the draft. |
| `GET` | `/api/exercises` | Read the exercise library. |
| `POST` | `/api/exercises` | Add an exercise. |
| `PATCH` | `/api/exercises` | Change the frequent flag. |
| `DELETE` | `/api/exercises?id=...` | Legacy administrative endpoint; not exposed in the UI. |

Every endpoint requires the owner check. Requests should normally originate from a browser session already authenticated by Cloudflare Access.

## 15. Database model

Core tables:

- `workouts`: one row per draft or completed workout.
- `workout_exercises`: ordered exercise instances inside a workout.
- `workout_sets`: ordered weight/reps/note sets inside an exercise instance.
- `exercises`: reusable exercise library with frequency and frequent flag.
- `workout_pr_highlights`: persisted true 1RM PR events for Bench Press, Squat, and Deadlift.

Important behavior:

- Drafts and completed workouts share `workouts`.
- `status` is either `draft` or `completed`.
- Editing a completed workout creates a separate draft with `draft_of_workout_id` pointing to the original.
- Completing is one D1 batch: remove the draft if necessary, upsert the completed workout, recalculate exercise frequency, and rebuild PR highlights.
- A failed completion response does not clear the editor.
- Exercise frequency counts distinct workout dates, not sets.
- PR highlights only consider completed sets with `reps = 1` and positive weight for the three canonical exercise names.

## 16. Updating schema and deploying future versions

After changing `db/schema.ts`:

```bash
pnpm db:generate
```

Review generated SQL. Never apply an unreviewed destructive migration to production.

Then:

```bash
pnpm exec wrangler d1 migrations apply repnote --local
pnpm test
pnpm exec wrangler d1 migrations apply repnote --remote
pnpm deploy:cloudflare
```

Apply remote database migrations before deploying code that requires the new columns.

The seed migration is also represented in Drizzle's journal with an unchanged schema snapshot, so future `drizzle-kit generate` runs continue at the next migration number without colliding with it.

## 17. Backup and rollback guidance

Before a risky schema or data operation, use Cloudflare's D1 backup/export facilities appropriate to the account plan. At minimum, inspect the migration and record the current Worker version ID.

Worker rollback does not automatically roll back D1 schema changes. A database rollback requires a separately reviewed forward migration or restoration from a D1 backup. Never run destructive SQL against a database selected through an unresolved shell variable.

## 18. Troubleshooting

### Google `redirect_uri_mismatch`

The Google authorized redirect URI must be exactly:

```text
https://YOUR_TEAM_NAME.cloudflareaccess.com/cdn-cgi/access/callback
```

Check the scheme, team name, hostname, path, and absence of a trailing slash.

### Google user is denied after successful login

Check all three values for an exact, case-insensitive email match:

1. Google account email.
2. Access policy Include Email value.
3. `OWNER_EMAIL` in `wrangler.jsonc`.

Also verify the Google account is a test user if the consent app is in Testing.

### UI loads but APIs return `403`

Check:

- The request is reaching the exact `OWNER_HOST`.
- The Access application covers the entire hostname.
- Google is the active identity provider.
- Cloudflare injects `cf-access-authenticated-user-email`.
- `OWNER_HOST` contains only the hostname, with no protocol or path.
- The Worker was redeployed after configuration changes.

### `D1 binding DB is unavailable`

Confirm the binding is named `DB`, the database UUID is real, and the current Worker version has the D1 binding attached.

### Empty exercise library

List and apply migrations:

```bash
pnpm exec wrangler d1 migrations list repnote --remote
pnpm exec wrangler d1 migrations apply repnote --remote
```

Confirm `0004_seed_exercises.sql` was applied and query the exercise count.

### Build works locally but custom domain fails

Confirm the hostname is inside an active zone in the same Cloudflare account, the `routes` entry uses `custom_domain: true`, and DNS/certificate provisioning has completed.

## 19. Final agent handoff checklist

An agent should not declare deployment complete until all boxes are true:

- [ ] Human chose the registered domain and application hostname.
- [ ] Domain registration/contact/payment steps were completed privately by the human where required.
- [ ] Registrant email is verified and the Cloudflare zone status is Active.
- [ ] `wrangler whoami` matches the Cloudflare account confirmed by the human.
- [ ] Human explicitly approved D1 creation, remote migrations, and production deployment.
- [ ] `wrangler.jsonc` contains no example hostname, email, or all-zero D1 UUID.
- [ ] D1 binding is exactly `DB`.
- [ ] Remote migrations applied successfully.
- [ ] Remote exercise count is 49.
- [ ] Remote workout count was zero before first user test.
- [ ] Google OAuth redirect uses the Cloudflare Access team callback.
- [ ] Google Client Secret exists only in Cloudflare's IdP configuration/password manager.
- [ ] Access application covers the full app hostname.
- [ ] Allow policy contains only the exact owner email.
- [ ] No Guest or Bypass policy exists.
- [ ] `DEV_AUTH_BYPASS` is `false` in production.
- [ ] `pnpm test` passes.
- [ ] Deployment prints a successful Worker version ID.
- [ ] Signed-out request redirects to Cloudflare Access.
- [ ] Forged email header does not bypass Access.
- [ ] Owner Google login succeeds.
- [ ] Another Google account is denied.
- [ ] Draft survives reload.
- [ ] Completed workout survives refresh.
- [ ] RM Calculator works on desktop and mobile.

Once these checks pass, the deployment is complete.
