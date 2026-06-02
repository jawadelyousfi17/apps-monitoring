import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/apps/:id?token=...  body: { name?, regenerateKey? } (admin)
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req, req.nextUrl.searchParams)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { name?: string; regenerateKey?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const data: { name?: string; apiKey?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.regenerateKey) data.apiKey = generateApiKey();

  if (Object.keys(data).length === 0) {
    return Response.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }

  try {
    const app = await prisma.app.update({ where: { id }, data });
    return Response.json({ ok: true, app });
  } catch {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }
}

// DELETE /api/apps/:id?token=...  → removes app + cascades events/sessions (admin)
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req, req.nextUrl.searchParams)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await prisma.app.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }
}
