export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Assign/clear a manual agent for an attempt.
 * Body: { agentId: string | null }
 * - Clearing accepts: null, undefined, "", "none", "null" (case-insensitive)
 * - If setting an agent, it must be ACTIVE and currency must match attempt.paymentCurrencyCode.
 * - Audit logs ATTEMPT_AGENT_ASSIGN.
 */
export async function POST(req, context) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const raw = body?.agentId;

    // Normalize "clear" values
    const isClear =
      raw === null ||
      raw === undefined ||
      raw === '' ||
      (typeof raw === 'string' && ['none', 'null'].includes(raw.trim().toLowerCase()));

    const attempt = await prisma.attempt.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        paymentStatus: true,
        paymentCurrencyCode: true,
        agentId: true,
      },
    });
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    if (isClear) {
      const updated = await prisma.attempt.update({
        where: { id },
        data: { agentId: null },
        select: { id: true, agentId: true },
      });

      // audit (best-effort)
      prisma.auditLog?.create({
        data: {
          action: 'ATTEMPT_AGENT_ASSIGN',
          entityType: 'Attempt',
          entityId: id,
          beforeJson: JSON.stringify({ agentId: attempt.agentId }),
          afterJson: JSON.stringify({ agentId: null }),
          actorId: null, // TODO: set admin id from session
          notes: 'Manual clear',
        },
      }).catch(() => {});

      return NextResponse.json({
        ok: true,
        cleared: true,
        attemptId: updated.id,
        agentId: null,
      });
    }

    // Assigning a specific agent
    const agentId = String(raw);
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, status: true, currencyCode: true, name: true },
    });
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    if (agent.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 400 });
    }

    const paidCurrency = (attempt.paymentCurrencyCode || '').toUpperCase();
    if (!paidCurrency) {
      return NextResponse.json({ error: 'Attempt has no paid currency yet' }, { status: 400 });
    }
    if (paidCurrency !== (agent.currencyCode || '').toUpperCase()) {
      return NextResponse.json({
        error: `Currency mismatch. Attempt is ${paidCurrency}; agent is ${agent.currencyCode}`,
      }, { status: 400 });
    }

    const updated = await prisma.attempt.update({
      where: { id },
      data: { agentId: agent.id },
      select: { id: true, agentId: true },
    });

    // audit (best-effort)
    prisma.auditLog?.create({
      data: {
        action: 'ATTEMPT_AGENT_ASSIGN',
        entityType: 'Attempt',
        entityId: id,
        beforeJson: JSON.stringify({ agentId: attempt.agentId }),
        afterJson: JSON.stringify({ agentId: agent.id }),
        actorId: null, // TODO: set admin id from session
        notes: 'Manual assign',
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      cleared: false,
      attemptId: updated.id,
      agentId: updated.agentId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to assign agent' }, { status: 500 });
  }
}
