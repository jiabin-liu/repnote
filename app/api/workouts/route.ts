import { getD1 } from "../../../db/d1";
import { readWorkouts } from "../../../lib/repnote-data";
import { isOwnerRequest, ownerRequired } from "../../../lib/owner-auth";
import { rebuildPrHighlightsStatements } from "../../../lib/pr-highlights";
import { deleteWorkoutContentStatements, recalculateExerciseFrequencyStatement, type InputWorkout, upsertWorkoutStatements } from "../../../lib/workout-write";

const USER_ID = "owner";

export async function GET(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    return Response.json({ workouts: await readWorkouts({}) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load workouts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const payload = await request.json() as InputWorkout;
    if (!payload.id || !Array.isArray(payload.exercises)) return Response.json({ error: "Invalid workout" }, { status: 400 });
    const db = getD1();
    const now = new Date().toISOString();
    const statements = payload.draftId && payload.draftId !== payload.id ? [
      ...deleteWorkoutContentStatements(db, payload.draftId),
      db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ? AND status = 'draft'").bind(payload.draftId, USER_ID),
      ...upsertWorkoutStatements(db, payload, "completed", now),
    ] : upsertWorkoutStatements(db, payload, "completed", now);
    statements.push(
      recalculateExerciseFrequencyStatement(db),
      ...rebuildPrHighlightsStatements(db, now),
    );
    await db.batch(statements);
    const workout = (await readWorkouts({})).find((item) => item.id === payload.id) ?? null;
    return Response.json({ ok: true, workout });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save workout" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });
    const db = getD1();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM workout_sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)").bind(id),
      db.prepare("DELETE FROM workout_exercises WHERE workout_id = ?").bind(id),
      db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ?").bind(id, USER_ID),
      recalculateExerciseFrequencyStatement(db),
      ...rebuildPrHighlightsStatements(db, now),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete workout" }, { status: 500 });
  }
}
