import { NextRequest } from 'next/server';
import { comprehensiveIdeaValidation } from '@/lib/coherence';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { ideaText?: string; idea?: string }));
    const ideaText = String(body?.ideaText ?? body?.idea ?? '').trim();
    if (!ideaText) return new Response(JSON.stringify({ error: 'Missing idea text' }), { status: 400 });
    const out = comprehensiveIdeaValidation(ideaText);
    return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
