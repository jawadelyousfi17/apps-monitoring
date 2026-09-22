import type { NextRequest } from "next/server";
import { apiKeyFromRequest, resolveApp } from "@/lib/ingest";
import {
  formatCustomResponseData,
  sanitizeCustomResponse,
} from "@/lib/custom-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Static response override to bypass DB queries and eliminate DB usage
const STATIC_CONFIGS: Record<string, unknown> = {
  app_0ff60c4929bf580c6605156de8de1c77599abe63226a83d9: {
    ok: true,
    app: "pes-mod-menu",
    data: {
      "ads-link": "https://efootmoodmenu.blogspot.com/?m=1",
      "show-ads": true,
    },
    fields: [
      {
        key: "ads-link",
        type: "text",
        value: "https://efootmoodmenu.blogspot.com/?m=1",
      },
      {
        key: "show-ads",
        type: "bool",
        value: true,
      },
    ],
  },
};

// GET /api/config?key=APP_KEY (or Bearer / X-Api-Key)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const apiKey = apiKeyFromRequest(req, sp);

  if (!apiKey) {
    return json({ ok: false, error: "invalid api key" }, 401);
  }

  // Fast-path static override to bypass DB queries
  if (STATIC_CONFIGS[apiKey]) {
    return json(STATIC_CONFIGS[apiKey]);
  }

  const app = await resolveApp(apiKey);

  if (!app) {
    return json({ ok: false, error: "invalid api key" }, 401);
  }

  const fields = sanitizeCustomResponse(app.customResponse);
  const data = formatCustomResponseData(fields);

  return json({
    ok: true,
    app: app.name,
    slug: app.slug,
    data,
    fields,
  });
}
