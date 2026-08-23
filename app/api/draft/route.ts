import { getD1 } from "../../../db/d1";
import { readWorkouts } from "../../../lib/repnote-data";
import { isOwnerRequest, ownerRequired } from "../../../lib/owner-auth";
import { deleteWorkoutContentStatements, type InputWorkout, upsertWorkoutStatements } from "../../../lib/workout-write";

const USER_ID = "owner";

export async function GET(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const drafts = await readWorkouts({ status: "draft" });
    return Response.json({ draft: drafts[0] ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load draft" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const payload = await request.json() as InputWorkout;
    if (!payload.id || !Array.isArray(payload.exercises)) return Response.json({ error: "Invalid draft" }, { status: 400 });
    const db = getD1();
    const existing = await db.prepare("SELECT status FROM workouts WHERE id = ? AND user_id = ?").bind(payload.id, USER_ID).first<{ status: string }>();
    if (existing?.status === "completed") return Response.json({ error: "A completed workout already uses this ID" }, { status: 409 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id WHERE w.user_id = ? AND w.status = 'draft' AND w.id <> ?)").bind(USER_ID, payload.id),
      db.prepare("DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ? AND status = 'draft' AND id <> ?)").bind(USER_ID, payload.id),
      db.prepare("DELETE FROM workouts WHERE user_id = ? AND status = 'draft' AND id <> ?").bind(USER_ID, payload.id),
      ...upsertWorkoutStatements(db, payload, "draft", now),
    ]);
    return Response.json({ ok: true, updatedAt: now });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save draft" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });
    const db = getD1();
    await db.batch([
      ...deleteWorkoutContentStatements(db, id),
      db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ? AND status = 'draft'").bind(id, USER_ID),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete draft" }, { status: 500 });
  }
}
