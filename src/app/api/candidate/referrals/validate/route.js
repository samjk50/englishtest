export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CODE_RE = /^AGENT[A-Z0-9]{6}$/;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const raw = (body.code || '').toString().trim().toUpperCase();

  if (!CODE_RE.test(raw)) {
    return NextResponse.json({ valid: false });
  }

  try {
    const agent = await prisma.agent.findFirst({
      where: { code: raw, status: 'ACTIVE' },
      select: { id: true, name: true }
    });
    if (!agent) return NextResponse.json({ valid: false });

    return NextResponse.json({ valid: true, agent });
  } catch (e) {
    console.error(e);
    // Soft-fail as invalid to avoid leaking errors to users
    return NextResponse.json({ valid: false });
  }
}
