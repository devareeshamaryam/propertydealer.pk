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

const ALLOWED = new Set(["search_listings", "market_prices", "material_rates", "construction_cost", "find_agents", "society_info"]);

/*
 * Per visitor: 20 a minute and 300 a day — far more than a person clicking
 * through the chat, far too few to scrape the site through it.
 */
const usage = new Map<string, { min: number; n: number; day: string; d: number }>();
function allowed(ip: string): boolean {
  const min = Math.floor(Date.now() / 60_000);
  const day = new Date().toISOString().slice(0, 10);
  let u = usage.get(ip);
  if (!u || u.day !== day) {
    if (usage.size > 50_000) usage.clear();
    u = { min, n: 0, day, d: 0 };
    usage.set(ip, u);
  }
  if (u.min !== min) {
    u.min = min;
    u.n = 0;
  }
  u.n += 1;
  u.d += 1;
  return u.n <= 20 && u.d <= 300;
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
