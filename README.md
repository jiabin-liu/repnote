# Repnote

Repnote is a private, self-hosted workout journal for Cloudflare. It records workouts, general notes, exercises, sets, weight, reps, set notes, units, timestamps, drafts, exercise frequency, and true one-rep-max PRs for Bench Press, Squat, and Deadlift.

This open-source edition intentionally contains only two primary tabs:

- **Workouts** — create, autosave, finish, edit, filter, browse, and manage exercises.
- **RM Calculator** — client-side NSCA, Brzycki, and Epley reference calculations.

It intentionally does **not** include Guest mode, Insights, public workout APIs, or the original project's CLI API. No personal workout records, production resource IDs, domains, email addresses, OAuth credentials, or secrets are included.

## Stack

- React 19 and Next.js App Router syntax
- vinext/Vite for Cloudflare Workers
- Cloudflare Workers and static assets
- Cloudflare D1 (SQLite)
- Cloudflare Access with Google as the identity provider
- Drizzle schema and SQL migrations

## Included exercise library

The seed migration contains all 49 exercise names from the source application's current exercise library. Training frequencies start at zero because personal workout history is not distributed. The five default frequent exercises are Bench Press, Deadlift, Pull-Up, Row, and Squat.

## Start here

For a new Cloudflare deployment, follow [DEPLOYMENT.md](./DEPLOYMENT.md) from top to bottom. It is written so another coding agent can perform the deployment without needing context from the private project, and it marks domain purchase, interactive login, secret handling, remote migrations, and production approval as explicit human checkpoints.

For architecture, data flow, API behavior, database design, authentication, and implementation details, see [technical.md](./technical.md).

For local development after configuration:

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply repnote --local
pnpm dev
```

The development-only authentication bypass works exclusively for requests whose hostname is `localhost` or `127.0.0.1`. It cannot bypass authentication on a deployed domain.

## Commands

```bash
pnpm dev                  # local development
pnpm build                # production build
pnpm test                 # build plus repository tests
pnpm lint                 # ESLint
pnpm db:generate          # generate schema migrations after schema changes
pnpm db:migrate:remote    # apply migrations to the default database name
pnpm deploy:cloudflare    # build and deploy the Worker
```

## Data ownership

All workout data lives in the deployer's own D1 database. Drafts use the same `workouts` table as completed workouts and are distinguished by `status = 'draft' | 'completed'`. Browser local storage is only a cache for completed history/exercise-library responses and a one-time migration source for drafts created by an older build; it is not the authoritative draft store.

## License

[MIT](./LICENSE)
