import crypto from "node:crypto";

export function normalizeIdea(s: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function ideaHash(idea: string, scope = "global") {
  const n = normalizeIdea(idea);
  return crypto.createHash("sha256").update(`${scope}:${n}`).digest("hex");
}

