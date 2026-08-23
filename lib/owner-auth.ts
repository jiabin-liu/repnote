import { env } from "cloudflare:workers";

type OwnerEnvironment = {
  OWNER_EMAIL?: string;
  OWNER_HOST?: string;
  DEV_AUTH_BYPASS?: string;
};

const ownerEnvironment = () => env as unknown as OwnerEnvironment;

export function isOwnerRequest(request: Request) {
  const { OWNER_EMAIL, OWNER_HOST, DEV_AUTH_BYPASS } = ownerEnvironment();
  if (!OWNER_EMAIL || !OWNER_HOST) return false;
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocalhost && DEV_AUTH_BYPASS === "true") return true;
  const authenticatedEmail = request.headers.get("cf-access-authenticated-user-email");
  return url.hostname.toLowerCase() === OWNER_HOST.toLowerCase()
    && authenticatedEmail?.toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export const ownerRequired = () => Response.json(
  { error: "Owner authentication required" },
  { status: 403 },
);
