import { NextRequest } from 'next/server';
import { generateHealthcareValidatedPivots } from '@/lib/contextualPivots';

export async function POST(req: NextRequest) {
  try {
    const { ideaText, currentScore } = await req.json();
    if (!ideaText || typeof currentScore !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid request parameters' }), { status: 400 });
    }
    const analysis = generateHealthcareValidatedPivots(ideaText, currentScore);
    return new Response(JSON.stringify(analysis), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Healthcare pivot analysis error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
