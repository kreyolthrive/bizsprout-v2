import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const oai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const claude = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export type ChatMsg = { role: 'system'|'user'|'assistant'; content: string };

export async function chatAny(messages: ChatMsg[], model?: string, temperature = 0.3) {
  if (model?.startsWith('claude') && claude) {
    const r = await claude.messages.create({
      model: (model as any) || 'claude-3.5-sonnet',
      max_tokens: 1200,
      temperature,
      messages
    });
    const first = r.content[0] as any;
    return first?.text ?? JSON.stringify(r.content);
  }
  if (oai) {
    const r = await oai.chat.completions.create({
      model: (model as any) || 'gpt-4o-mini',
      temperature,
      messages
    });
    return r.choices[0]?.message?.content ?? '';
  }
  // Fallback if no providers configured
  return JSON.stringify({
    target_market: '',
    value_prop: 'Demo mode: no AI keys set',
    scores: { Urgent: 5 },
    status: 'NEEDS_WORK',
    highlights: ['Add API keys for real scoring.'],
    risks: ['No AI provider configured.']
  });
}
