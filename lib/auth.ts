import { randomBytes } from "node:crypto";

// Dashboard / admin auth. Tokens live in DASHBOARD_TOKEN (comma-separated).
export function adminTokens(): string[] {
  return (process.env.DASHBOARD_TOKEN ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function isAdmin(req: Request, searchParams?: URLSearchParams): boolean {
  const tokens = adminTokens();
  if (tokens.length === 0) return false;

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const qp = searchParams?.get("token") ?? null;
  const provided = bearer ?? qp;
  return provided != null && tokens.includes(provided);
}

// Generate an app ingest key, e.g. "app_3f9c1a...".
export function generateApiKey(): string {
  return "app_" + randomBytes(24).toString("hex");
}
