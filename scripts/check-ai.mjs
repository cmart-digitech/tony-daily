/**
 * Verify a configured AI provider end to end, without going through the app.
 *
 *   node scripts/check-ai.mjs
 *
 * Reads the same environment variables the app uses, sends one tiny grounded
 * prompt, and reports whether the provider answered. Prints no secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local the way Next.js would, so the script works from a plain
// shell without exporting anything by hand. Real environment variables win.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const full = path.join(projectRoot, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const PRESETS = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.6-flash",
    keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "AI_API_KEY"],
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keys: ["GROQ_API_KEY", "AI_API_KEY"],
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4-fast",
    keys: ["XAI_API_KEY", "GROK_API_KEY", "AI_API_KEY"],
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.0-flash-exp:free",
    keys: ["OPENROUTER_API_KEY", "AI_API_KEY"],
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest",
    keys: ["MISTRAL_API_KEY", "AI_API_KEY"],
  },
};

const explicit = (process.env.AI_PROVIDER || "").toLowerCase();
const id =
  explicit && PRESETS[explicit]
    ? explicit
    : Object.keys(PRESETS).find((p) =>
        PRESETS[p].keys.some((k) => k !== "AI_API_KEY" && process.env[k]),
      );

if (!id) {
  console.log("No OpenAI-compatible provider key found in the environment.");
  console.log("Set one of: GEMINI_API_KEY, GROQ_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY");
  process.exit(1);
}

const preset = PRESETS[id];
const apiKey = preset.keys.map((k) => process.env[k]).find(Boolean);
const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, "") || preset.baseUrl;
const model = process.env.AI_MODEL || preset.model;

console.log(`provider: ${id}`);
console.log(`model:    ${model}`);
console.log(`endpoint: ${baseUrl}/chat/completions`);

const started = Date.now();
const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model,
    max_tokens: 200,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Answer only from the provided sources. If they do not contain the answer, say the information is unavailable from the currently connected sources. Cite with [1].",
      },
      {
        role: "user",
        content:
          "SOURCES:\n[1] Hong Kong residential transactions rose 12 per cent in July (RTHK).\n\nQUESTION: What happened to Hong Kong residential transactions in July? Then: what was the Hang Seng Index close on that day?",
      },
    ],
  }),
});

const elapsed = Date.now() - started;
if (!res.ok) {
  const body = await res.text();
  console.log(`\nFAILED: HTTP ${res.status} in ${elapsed}ms`);
  console.log(body.slice(0, 400));
  process.exit(1);
}
const data = await res.json();
const text = data.choices?.[0]?.message?.content?.trim();
console.log(`\nOK: HTTP 200 in ${elapsed}ms\n`);
console.log(text);
console.log("\n--- grounding check ---");
console.log(`cites [1]:            ${/\[1\]/.test(text) ? "yes" : "NO"}`);
console.log(`declines the Hang Seng question: ${/unavailable|not (provided|available|contain)|no information|cannot/i.test(text) ? "yes" : "NO — check grounding"}`);
