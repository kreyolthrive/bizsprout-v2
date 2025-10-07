import { NextRequest } from 'next/server';
import { assessVagueness } from '@/lib/vagueness';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { ideaText?: string; idea?: string }));
    const ideaText = String(body?.ideaText ?? body?.idea ?? '').trim();
    if (!ideaText) {
      return new Response(JSON.stringify({ error: 'Missing idea text' }), { status: 400 });
    }

    const assessment = assessVagueness(ideaText);
    return new Response(
      JSON.stringify({ requiresSpecificity: assessment.isVague, assessment }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
    );
  } catch (err) {
    console.error('Vagueness assessment error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
