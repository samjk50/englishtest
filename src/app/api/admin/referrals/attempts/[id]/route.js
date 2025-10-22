export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/admin/referrals/attempts/:id  { agentId: "..." | null }
export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const desired = body?.agentId ?? null;

    const attempt = await prisma.attempt.findUnique({
      where: { id },
      select: {
        id: true,
        agentId: true,
        paymentStatus: true,
        paymentCurrencyCode: true,
      },
    });
    if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (attempt.paymentStatus !== 'PAID' || !attempt.paymentCurrencyCode) {
      return NextResponse.json(
        { error: 'Attempt is not eligible. Must be PAID with a currency.' },
        { status: 400 }
      );
    }

    let newAgentId = null;

    if (desired) {
      const agent = await prisma.agent.findUnique({
        where: { id: desired },
        select: { id: true, status: true, currencyCode: true },
      });
      if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      if (agent.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Agent is not active' }, { status: 400 });
      }
      if ((agent.currencyCode || '').toUpperCase() !== (attempt.paymentCurrencyCode || '').toUpperCase()) {
        return NextResponse.json(
          { error: `Currency mismatch. Attempt is ${attempt.paymentCurrencyCode}.` },
          { status: 400 }
        );
      }
      newAgentId = agent.id;
    }

    const updated = await prisma.attempt.update({
      where: { id },
      data: { agentId: newAgentId },
      select: { id: true, agentId: true },
    });

    // Audit
    prisma.auditLog?.create({
      data: {
        action: desired ? 'ATTEMPT_AGENT_OVERRIDE' : 'ATTEMPT_AGENT_CLEAR',
        entityType: 'Attempt',
        entityId: id,
        beforeJson: JSON.stringify({ agentId: attempt.agentId }),
        afterJson: JSON.stringify({ agentId: updated.agentId }),
        actorId: null, // TODO: admin id/email
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, attemptId: updated.id, agentId: updated.agentId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update attempt' }, { status: 500 });
  }
}
