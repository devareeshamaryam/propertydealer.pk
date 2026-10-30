import { runTool } from "@/lib/assistant/tools";

/**
 * POST /assistant/quick — runs one lookup straight from the chat window's
 * forms and buttons (search, prices, material rates, construction cost).
 * No model is involved, so it is instant and costs nothing.
 *
 *   { tool: "search_listings", args: {...} }  →  { card, summary }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["search_listings", "market_prices", "material_rates", "construction_cost"]);

/* Generous per-visitor limit: these are cheap, but not free for the database. */
const usage = new Map<string, { min: number; n: number }>();
function allowed(ip: string): boolean {
  const min = Math.floor(Date.now() / 60_000);
  const u = usage.get(ip);
  if (!u || u.min !== min) {
    usage.set(ip, { min, n: 1 });
    if (usage.size > 20_000) usage.clear();
    return true;
  }
  return ++u.n <= 40;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local").split(",")[0]!.trim();
  if (!allowed(ip)) return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const tool = String(body?.tool || "");
  if (!ALLOWED.has(tool)) return Response.json({ error: "Unknown request" }, { status: 400 });
  const args = body?.args && typeof body.args === "object" ? body.args : {};
  try {
    const r = await runTool(tool, args);
    return Response.json({ card: r.cards || null, data: r.forModel });
  } catch (e: any) {
    console.error("[assistant/quick]", e?.message || e);
    return Response.json({ error: "Couldn't load that right now. Please try again." }, { status: 502 });
  }
}
