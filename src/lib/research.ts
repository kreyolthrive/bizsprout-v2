// src/lib/research.ts
// Minimal wrappers for Perplexity and an LLM to produce structured outputs.
import type { RegulatoryFinding } from "@/types/validation";

export async function askPerplexity(prompt: string): Promise<string | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 8000);
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar-pro",
        temperature: 0.2,
        return_citations: true,
        messages: [
          { role: "system", content: "You are a legal research assistant. Provide concise, cited summaries." },
          { role: "user", content: prompt },
        ],
      }),
      signal: ac.signal as any,
    } as any);
    clearTimeout(to);
    if (!resp.ok) return null;
    const data: unknown = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim?.() || "";
    const cites = data?.citations || data?.choices?.[0]?.message?.citations || data?.choices?.[0]?.citations || [];
    const src = Array.isArray(cites) ? cites.map((c: unknown) => (typeof c === "string" ? c : c?.url || c?.source)).filter(Boolean) : [];
    return [text, src.length ? "\n\nSources:\n- " + src.join("\n- ") : ""].join("");
  } catch { return null; }
}

export async function askLLMStructured(prompt: string): Promise<{ findings: RegulatoryFinding[] }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const findings: RegulatoryFinding[] = [];
  const sys = `You are a compliance analyst. Output strict JSON with key \"findings\": RegulatoryFinding[].`;
  const req = async (url: string, body: unknown, headers: unknown) => {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 12000);
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) return null;
      const j: unknown = await r.json();
      return j;
    } catch { return null; }
  };
  // Try OpenAI first
  if (openaiKey) {
    const data = await req("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [ { role: "system", content: sys }, { role: "user", content: prompt + "\nReturn ONLY JSON." } ],
    }, { "content-type": "application/json", Authorization: `Bearer ${openaiKey}` });
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = safeJson(text);
    if (parsed?.findings) return { findings: parsed.findings as RegulatoryFinding[] };
  }
  // Fallback to Anthropic
  if (anthropicKey) {
    const data = await req("https://api.anthropic.com/v1/messages", {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 600,
      temperature: 0.2,
      system: sys,
      messages: [{ role: "user", content: prompt + "\nReturn ONLY JSON." }],
    }, { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" });
    const text = data?.content?.[0]?.text || data?.content?.[0]?.content || "";
    const parsed = safeJson(text);
    if (parsed?.findings) return { findings: parsed.findings as RegulatoryFinding[] };
  }
  // Final fallback: heuristic empty list
  return { findings };
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const m = text?.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

