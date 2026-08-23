import { getD1 } from "../../../db/d1";
import { readExercises } from "../../../lib/repnote-data";
import { isOwnerRequest, ownerRequired } from "../../../lib/owner-auth";

const USER_ID = "owner";

export async function GET(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    return Response.json({ exercises: await readExercises() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load exercises" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const payload = await request.json() as { id?: string; name?: string };
    const name = payload.name?.trim();
    if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
    const id = payload.id || crypto.randomUUID();
    await getD1().prepare("INSERT INTO exercises (id, user_id, name, training_frequency, is_frequent, created_at) VALUES (?, ?, ?, 0, 0, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").bind(id, USER_ID, name, new Date().toISOString()).run();
    return Response.json({ id, name, frequency: 0, isFrequent: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save exercise" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const payload = await request.json() as { id?: string; isFrequent?: boolean };
    if (!payload.id || typeof payload.isFrequent !== "boolean") return Response.json({ error: "Invalid preference" }, { status: 400 });
    await getD1().prepare("UPDATE exercises SET is_frequent = ? WHERE id = ? AND user_id = ?").bind(payload.isFrequent ? 1 : 0, payload.id, USER_ID).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update exercise" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });
    await getD1().prepare("DELETE FROM exercises WHERE id = ? AND user_id = ?").bind(id, USER_ID).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete exercise" }, { status: 500 });
  }
}
