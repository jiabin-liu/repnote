# Agent instructions

- Read `README.md` and `technical.md` before modifying the project.
- Read `DEPLOYMENT.md` completely before configuring or deploying.
- Never commit credentials, OAuth secrets, Cloudflare tokens, Access cookies, passwords, or private deployment data.
- Keep checked-in deployment configuration sanitized and use example values rather than a deployer's real domain, email, resource IDs, or account details.
- Update relevant documentation and tests when behavior changes.
- Run `pnpm test` and `pnpm lint` before declaring implementation complete.
- Review generated database migrations before applying them.
- Do not purchase domains, apply remote migrations, deploy, or modify remote Cloudflare or Google resources unless the human explicitly authorizes that specific action.

## Continuous deployment

- `.github/workflows/deploy.yml` tests, applies remote D1 migrations, and deploys on every push to `main`. Pushing or merging to `main` therefore IS a production deploy and remote migration.
- Do ordinary work on a feature branch. Push to or merge into `main` only when the human explicitly asks to ship/deploy that change.
- Migrations under `drizzle/` run automatically against production on deploy: keep them additive and non-destructive unless the human has explicitly approved a destructive one.
- Never commit `wrangler.production.jsonc`, tokens, or personal workout data. The production config lives only in the `WRANGLER_PRODUCTION_CONFIG` repository secret.
