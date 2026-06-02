import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/apps?token=...  → list apps (admin)
export async function GET(req: NextRequest) {
  if (!isAdmin(req, req.nextUrl.searchParams)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const apps = await prisma.app.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, apiKey: true, createdAt: true },
  });
  return Response.json({ ok: true, apps });
}

// POST /api/apps?token=...  body: { name, slug }  → create app + api key (admin)
export async function POST(req: NextRequest) {
  if (!isAdmin(req, req.nextUrl.searchParams)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!name || !slug) {
    return Response.json(
      { ok: false, error: "name and slug required" },
      { status: 400 },
    );
  }

  const existing = await prisma.app.findUnique({ where: { slug } });
  if (existing) {
    return Response.json({ ok: false, error: "slug taken" }, { status: 409 });
  }

  const app = await prisma.app.create({
    data: { name, slug, apiKey: generateApiKey() },
  });
  return Response.json({ ok: true, app }, { status: 201 });
}
