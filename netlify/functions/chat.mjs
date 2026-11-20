// Netlify Function (v2). No dependencies.
// Env vars: GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY
// Optional: PROVIDERS (default "gemini,groq"), *_MODEL overrides, ALLOWED_ORIGINS,
//           RATE_PER_MIN (12), PROVIDER_TIMEOUT_MS (6000), TOTAL_TIMEOUT_MS (9000)

const SYSTEM = `You are the friendly helper on "Brain ka Blueprint", a psychology website by Anahat Brar for teenagers.
Explain things simply, as if to a curious 15-year-old.
Keep answers under 150 words, in 2-3 short paragraphs. No markdown headings or bullet lists.
When relevant, name the key study with its year.
Stay on psychology, the brain and wellbeing. Politely steer other topics back.
Never diagnose anyone. If someone seems distressed, respond warmly, encourage them to talk to a trusted adult or a counsellor, and mention Tele-MANAS 14416 (India, free, 24/7).`;

const e = (name) => {
  try { if (typeof Netlify !== "undefined" && Netlify.env) { const v = Netlify.env.get(name); if (v) return v; } } catch (_) {}
  return process.env[name] || "";
};
const num = (name, def) => { const n = parseInt(e(name), 10); return Number.isFinite(n) && n > 0 ? n : def; };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

const hits = new Map(); // soft per-IP rate limit (per warm instance)
function limited(ip) {
  const now = Date.now(), win = 60000, max = num("RATE_PER_MIN", 12);
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < win)) hits.delete(k);
  return arr.length > max;
}

async function post(url, headers, body, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const oaiStyle = (url, keyName, modelName, defModel, extraHeaders = {}) => ({
  key: () => e(keyName),
  run: async (msgs, ms) => {
    const d = await post(
      url,
      { authorization: "Bearer " + e(keyName), ...extraHeaders },
      {
        model: e(modelName) || defModel,
        max_tokens: 400,
        temperature: 0.7,
        messages: [{ role: "system", content: SYSTEM }, ...msgs]
      },
      ms
    );
    return d?.choices?.[0]?.message?.content || "";
  }
});

const PROVIDERS = {
  gemini: {
    key: () => e("GEMINI_API_KEY"),
    run: async (msgs, ms) => {
      const model = e("GEMINI_MODEL") || "gemini-2.5-flash";
      const d = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { "x-goog-api-key": e("GEMINI_API_KEY") },
        {
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: msgs.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          })),
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 0 }
          }
        },
        ms
      );
      return (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    }
  },
  groq: oaiStyle("https://api.groq.com/openai/v1/chat/completions", "GROQ_API_KEY", "GROQ_MODEL", "llama-3.1-8b-instant"),
  openai: oaiStyle("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", "OPENAI_MODEL", "gpt-4o-mini"),
  openrouter: oaiStyle(
    "https://openrouter.ai/api/v1/chat/completions",
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
    "meta-llama/llama-3.3-70b-instruct:free"
  ),
  anthropic: {
    key: () => e("ANTHROPIC_API_KEY"),
    run: async (msgs, ms) => {
      const d = await post(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": e("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" },
        {
          model: e("ANTHROPIC_MODEL") || "claude-haiku-4-5",
          max_tokens: 400,
          system: SYSTEM,
          messages: msgs
        },
        ms
      );
      return (d?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    }
  }
};

function sanitize(raw) {
  if (!Array.isArray(raw)) return null;
  let m = raw
    .filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim())
    .map((x) => ({ role: x.role, content: x.content.trim().slice(0, 1000) }))
    .slice(-8);
  while (m.length && m[0].role !== "user") m.shift();
  if (!m.length || m[m.length - 1].role !== "user") return null;
  return m;
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Origin check: same host, or listed in ALLOWED_ORIGINS
  const origin = req.headers.get("origin");
  if (origin) {
    let ok = false;
    try {
      const oh = new URL(origin).host;
      const self = new URL(req.url).host;
      const extra = e("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
      ok = oh === self || extra.includes(origin) || extra.includes(oh);
    } catch (_) {}
    if (!ok) return json({ error: "Forbidden" }, 403);
  }

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many requests" }, 429);

  let text;
  try { text = await req.text(); } catch (_) { return json({ error: "Bad request" }, 400); }
  if (text.length > 20000) return json({ error: "Payload too large" }, 413);

  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ error: "Bad JSON" }, 400); }

  const msgs = sanitize(body?.messages);
  if (!msgs) return json({ error: "Invalid messages" }, 400);

  const order = (e("PROVIDERS") || "gemini,groq").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const perCall = num("PROVIDER_TIMEOUT_MS", 6000);
  const deadline = Date.now() + num("TOTAL_TIMEOUT_MS", 9000);

  for (const name of order) {
    const p = PROVIDERS[name];
    if (!p || !p.key()) continue;
    const left = deadline - Date.now();
    if (left < 800) break;
    try {
      const out = (await p.run(msgs, Math.min(perCall, left))).trim();
      if (out) return json({ text: out, provider: name });
    } catch (err) {
      console.log("provider failed:", name, String(err && err.message || err));
    }
  }
  return json({ error: "All providers failed" }, 502);
};