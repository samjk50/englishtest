export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * List eligible agents for a given attempt.
 * Rules:
 *  - Attempt must exist.
 *  - If the attempt has a paymentCurrencyCode, only return ACTIVE agents with the same currency.
 *  - Also return which agent is currently selected (manual) and which is the candidate's default.
 */
export async function GET(_req, context) {
  try {
    // ⬇️ Next 15 dynamic APIs: await params
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const attempt = await prisma.attempt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        paymentCurrencyCode: true,
        agent: { select: { id: true } }, // current manual override (if any)
      },
    });
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    const paidCurrency = (attempt.paymentCurrencyCode || '').toUpperCase();

    // Only show ACTIVE agents in the PAID currency (when known)
    const agents = paidCurrency
      ? await prisma.agent.findMany({
          where: { status: 'ACTIVE', currencyCode: paidCurrency },
          select: { id: true, name: true, code: true, currencyCode: true, status: true },
          orderBy: { name: 'asc' },
        })
      : [];

    // Candidate default link (if any)
    const defaultLink = await prisma.candidateAgentLink.findUnique({
      where: { candidateId: attempt.userId },
      select: { agent: { select: { id: true } } },
    });

    const manualId = attempt.agent?.id || null;
    const defaultId = defaultLink?.agent?.id || null;

    const items = agents.map(a => ({
      id: a.id,
      name: a.name,
      code: a.code,
      currencyCode: a.currencyCode,
      isManualSelected: manualId === a.id,
      isCandidateDefault: defaultId === a.id,
    }));

    return NextResponse.json({
      items,
      manualId,
      defaultId,
      currency: paidCurrency,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load eligible agents' }, { status: 500 });
  }
}
