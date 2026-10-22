import { getD1 } from "../../../db/d1";
import { isOwnerRequest, ownerRequired } from "../../../lib/owner-auth";

const USER_ID = "owner";
// Two image slots share this route: ?slot=background (default) and ?slot=button (the "new workout" button picture).
const SLOT_KEYS: Record<string, string> = { background: "background_image", button: "button_image" };
const keyFor = (request: Request) => SLOT_KEYS[new URL(request.url).searchParams.get("slot") ?? "background"];
// A resized phone photo as a JPEG/PNG/WebP data URL; D1 values are capped at ~2 MB.
const MAX_DATA_URL_LENGTH = 1_800_000;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

type SettingRow = { value: string; updated_at: string };
const readSetting = (key: string) => getD1().prepare("SELECT value, updated_at FROM app_settings WHERE user_id = ? AND key = ?").bind(USER_ID, key).first<SettingRow>();

// GET /api/background?slot=…          -> the image bytes (404 when none is set)
// GET /api/background?meta=1   -> { updatedAt } or { updatedAt: null }
export async function GET(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const key = keyFor(request);
    if (!key) return Response.json({ error: "Unknown image slot" }, { status: 400 });
    const row = await readSetting(key);
    if (new URL(request.url).searchParams.has("meta")) return Response.json({ updatedAt: row?.updated_at ?? null });
    const match = row?.value.match(DATA_URL);
    if (!row || !match) return new Response(null, { status: 404 });
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    return new Response(bytes, { headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load background" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const key = keyFor(request);
    if (!key) return Response.json({ error: "Unknown image slot" }, { status: 400 });
    const { dataUrl } = await request.json() as { dataUrl?: string };
    if (!dataUrl || dataUrl.length > MAX_DATA_URL_LENGTH || !DATA_URL.test(dataUrl)) return Response.json({ error: "Expected a JPEG, PNG, or WebP image under about 1.3 MB" }, { status: 400 });
    const updatedAt = new Date().toISOString();
    await getD1().prepare("INSERT INTO app_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(USER_ID, key, dataUrl, updatedAt).run();
    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save background" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isOwnerRequest(request)) return ownerRequired();
    const key = keyFor(request);
    if (!key) return Response.json({ error: "Unknown image slot" }, { status: 400 });
    await getD1().prepare("DELETE FROM app_settings WHERE user_id = ? AND key = ?").bind(USER_ID, key).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to remove background" }, { status: 500 });
  }
}
