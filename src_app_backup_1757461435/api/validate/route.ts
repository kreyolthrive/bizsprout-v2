import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, msg: 'validate endpoint alive' });
}

export async function POST() {
  return NextResponse.json({ ok: true, msg: 'POST received (stub)' });
}
