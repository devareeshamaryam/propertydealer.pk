import { TOOL_DEFS, runTool, toolLabel } from "@/lib/assistant/tools";
import { systemPrompt } from "@/lib/assistant/prompt";

/**
 * POST /assistant/chat — the site assistant.
 *
 * Takes the conversation, lets the model look things up with the tools in
 * lib/assistant/tools.ts (live listings, prices, rates, calculators), and
 * streams back newline-delimited JSON events as they happen:
 *
 *   {"t":"status","text":"Searching listings"}      a tool is running
 *   {"t":"cards","cards":{...}}                     listing cards to show
 *   {"t":"text","d":"…"}                            the answer, piece by piece
 *   {"t":"done"} | {"t":"error","text":"…"}
 *
 * Any OpenAI-compatible model works; set in the server environment:
 *   AI_ASSISTANT_API_KEY   (falls back to OPENAI_API_KEY)
 *   AI_ASSISTANT_MODEL     default gpt-5-nano
 *   AI_ASSISTANT_BASE_URL  default https://api.openai.com/v1 (DeepSeek: https://api.deepseek.com)
 *   AI_ASSISTANT_REASONING default minimal (GPT-5 models: minimal | low | medium)
 *   AI_ASSISTANT_DAILY_LIMIT  messages per visitor per day, default 60
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = process.env.AI_ASSISTANT_API_KEY || process.env.OPENAI_API_KEY || "";
const MODEL = process.env.AI_ASSISTANT_MODEL || "gpt-5-nano";
const BASE = (process.env.AI_ASSISTANT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const REASONING = process.env.AI_ASSISTANT_REASONING || "minimal";
const DAILY = Number(process.env.AI_ASSISTANT_DAILY_LIMIT || 60);
const isReasoningModel = /^(gpt-5|o\d)/i.test(MODEL);

/* Per-visitor daily limit (this process; enough to stop one person running up the bill). */
const usage = new Map<string, { day: string; n: number }>();
function allowed(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip);
  if (!u || u.day !== day) {
    usage.set(ip, { day, n: 1 });
    if (usage.size > 50_000) usage.delete(usage.keys().next().value as string);
    return true;
  }
  u.n += 1;
  return u.n <= DAILY;
}

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: any[]; tool_call_id?: string };

/** One streamed call to the model. Text goes to `onText` as it arrives; tool calls are collected. */
async function complete(messages: Msg[], onText: (d: string) => void, signal: AbortSignal) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    signal,
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFS,
      tool_choice: "auto",
      stream: true,
      ...(isReasoningModel ? { reasoning_effort: REASONING, max_completion_tokens: 1800 } : { max_tokens: 900, temperature: 0.4 }),
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`model ${res.status}: ${detail.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  const calls: { id: string; name: string; args: string }[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let j: any;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = j.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const tc of delta.tool_calls || []) {
        const k = tc.index ?? 0;
        calls[k] ??= { id: "", name: "", args: "" };
        if (tc.id) calls[k].id = tc.id;
        if (tc.function?.name) calls[k].name += tc.function.name;
        if (tc.function?.arguments) calls[k].args += tc.function.arguments;
      }
    }
  }
  return { text, calls: calls.filter(Boolean) };
}

export async function POST(req: Request) {
  if (!KEY) return Response.json({ error: "The assistant is not set up yet." }, { status: 503 });
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local").split(",")[0]!.trim();
  if (!allowed(ip)) return Response.json({ error: "You've reached today's limit for the assistant. Please try again tomorrow." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const history: { role: string; content: string }[] = Array.isArray(body?.messages) ? body.messages : [];
  // The last 14 turns, plain text only, each capped — enough context, a bounded bill.
  const turns: Msg[] = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-14)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  if (!turns.length || turns[turns.length - 1]!.role !== "user") return Response.json({ error: "Say something first." }, { status: 400 });

  const page = typeof body?.page === "string" ? body.page.slice(0, 200) : "";
  const messages: Msg[] = [{ role: "system", content: systemPrompt(page) }, ...turns];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const abort = new AbortController();
      req.signal.addEventListener("abort", () => abort.abort());
      try {
        // Look things up as many times as needed (at most 5 rounds), then answer.
        for (let round = 0; round < 6; round++) {
          const { text, calls } = await complete(messages, (d) => send({ t: "text", d }), abort.signal);
          if (!calls.length || round === 5) break;
          messages.push({ role: "assistant", content: text || null, tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
          const results = await Promise.all(
            calls.map(async (c) => {
              let args: any = {};
              try {
                args = JSON.parse(c.args || "{}");
              } catch {
                /* model sent broken JSON: run with nothing */
              }
              send({ t: "status", text: toolLabel(c.name, args) });
              try {
                const r = await runTool(c.name, args);
                if (r.cards) send({ t: "cards", cards: r.cards });
                return { id: c.id, content: JSON.stringify(r.forModel).slice(0, 12_000) };
              } catch (e: any) {
                return { id: c.id, content: JSON.stringify({ error: `Could not look that up right now (${String(e?.message || e).slice(0, 80)})` }) };
              }
            }),
          );
          for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
        }
        send({ t: "done" });
      } catch (e: any) {
        console.error("[assistant]", e?.message || e);
        if (!abort.signal.aborted) send({ t: "error", text: "Sorry — I couldn't answer that just now. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
