import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("ships only Workouts and RM primary tabs", async () => {
  const [page, calculator] = await Promise.all([
    read("app/page.tsx"),
    read("app/rm/RmCalculator.tsx"),
  ]);

  assert.match(page, /<RepnoteApp \/>/);
  assert.match(page, />Workouts\{draft && <i \/>\}<\/button>/);
  assert.match(page, /<Calculator aria-hidden="true" \/>RM<\/button>/);
  assert.match(page, /<RmCalculator embedded \/>/);
  assert.doesNotMatch(page, /Insights|BigThreeInsights|TrendingUp/);
  assert.doesNotMatch(page + calculator, /Guest|guest|isGuest/);
});

test("contains no Guest, CLI, docs, or v1 route trees", async () => {
  await assert.rejects(access(new URL("app/guest", root)));
  await assert.rejects(access(new URL("app/v1", root)));
  await assert.rejects(access(new URL("app/docs", root)));
  await assert.rejects(access(new URL("lib/cli-auth.ts", root)));
  const appRoutes = await readdir(new URL("app/api", root));
  assert.deepEqual(appRoutes.sort(), ["draft", "exercises", "workouts"]);
});

test("uses configurable Cloudflare Access owner authentication", async () => {
  const [auth, wrangler, workouts, exercises, draft] = await Promise.all([
    read("lib/owner-auth.ts"),
    read("wrangler.jsonc"),
    read("app/api/workouts/route.ts"),
    read("app/api/exercises/route.ts"),
    read("app/api/draft/route.ts"),
  ]);

  assert.match(auth, /cf-access-authenticated-user-email/);
  assert.match(auth, /OWNER_EMAIL/);
  assert.match(auth, /OWNER_HOST/);
  assert.match(auth, /isLocalhost && DEV_AUTH_BYPASS === "true"/);
  assert.match(wrangler, /"DEV_AUTH_BYPASS": "false"/);
  assert.match(wrangler, /"binding": "DB"/);
  for (const route of [workouts, exercises, draft]) {
    assert.match(route, /isOwnerRequest\(request\)/);
    assert.match(route, /ownerRequired\(\)/);
  }
});

test("ships a sanitized 49-exercise seed and no workouts", async () => {
  const seed = await read("drizzle/0004_seed_exercises.sql");
  const rows = seed.match(/\('exercise-[^\n]+/g) ?? [];
  assert.equal(rows.length, 49);
  for (const name of ["Bench Press", "Squat", "Deadlift", "Pull-Up", "Row", "Panda Pull", "Single-Arm Snatch"]) {
    assert.match(seed, new RegExp(`'${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  }
  assert.equal((seed.match(/, 0, 1, '2026/g) ?? []).length, 5);
  assert.doesNotMatch(seed, /INSERT[^;]+workouts/i);
});

test("persists drafts in D1 and computes derived data from completed workouts", async () => {
  const [schema, data, writer, pr, page] = await Promise.all([
    read("db/schema.ts"),
    read("lib/repnote-data.ts"),
    read("lib/workout-write.ts"),
    read("lib/pr-highlights.ts"),
    read("app/page.tsx"),
  ]);

  assert.match(schema, /status: text\("status"/);
  assert.match(schema, /draftOfWorkoutId: text\("draft_of_workout_id"\)/);
  assert.match(data, /options\.status \?\? "completed"/);
  assert.match(writer, /w\.status = 'completed'/);
  assert.match(pr, /w\.status = 'completed'/);
  assert.match(page, /fetch\("\/api\/draft"/);
  assert.match(page, /window\.addEventListener\("online", retry\)/);
  assert.doesNotMatch(page, /localStorage\.setItem\("repnote-draft-v1"/);
});

test("contains a complete deployment handoff without embedded credentials", async () => {
  const [guide, readme, wrangler, packageJson] = await Promise.all([
    read("DEPLOYMENT.md"),
    read("README.md"),
    read("wrangler.jsonc"),
    read("package.json"),
  ]);

  for (const topic of [
    "Agent execution protocol and human checkpoints",
    "Acquire or connect a domain",
    "Create the D1 database",
    "Apply migrations and seed exercises",
    "Create the Google OAuth application",
    "Add Google as the Cloudflare Access identity provider",
    "Create the Access application and exact-email policy",
    "Production verification",
    "Final agent handoff checklist",
  ]) assert.match(guide, new RegExp(topic));

  assert.match(guide, /cloudflareaccess\.com\/cdn-cgi\/access\/callback/);
  assert.match(guide, /cf-access-authenticated-user-email/);
  assert.match(guide, /STOP — HUMAN ACTION REQUIRED/);
  assert.match(guide, /STOP — HUMAN APPROVAL REQUIRED/);
  assert.match(guide, /Register a new domain with Cloudflare Registrar/);
  assert.match(guide, /zone status is Active/);
  assert.match(readme, /No personal workout records/);
  assert.doesNotMatch(packageJson, /"jose"/);
  assert.match(wrangler, /workout\.example\.com/);
  assert.match(wrangler, /00000000-0000-0000-0000-000000000000/);
  assert.doesNotMatch(guide + readme + wrangler, /client_secret\s*[:=]\s*[A-Za-z0-9_-]{16,}/i);
});
