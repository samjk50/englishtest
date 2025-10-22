export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth';

function parseAmountToCents(input) {
  const s = String(input ?? '').trim();
  if (!s) return NaN;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  // truncate (no rounding rule)
  return Math.floor(n * 100 + 1e-6);
}

function moneyFloor(percent, cents) {
  const pct = Number(percent) || 0;
  const base = Number(cents) || 0;
  return Math.floor((base * pct) / 100);
}

async function getAdmin() {
  const jar = await cookies();
  const token = jar.get('access_token')?.value;
  if (!token) return null;
  try {
    const u = await Promise.resolve(verifyAccess(token));
    if (String(u.role).toUpperCase() !== 'ADMIN') return null;
    return u;
  } catch {
    return null;
  }
}

export async function POST(req, context) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ Next 15: await params
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const amountCents = parseAmountToCents(body.amount ?? body.amountCents);
  const notes = typeof body.notes === 'string' && body.notes.trim()
    ? body.notes.trim().slice(0, 1000)
    : null;

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { id: true, commissionPercent: true, currencyCode: true },
  });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const agentCurrency = (agent.currencyCode || '').toUpperCase();

  // For DEFAULT attribution: which candidates are linked to this agent?
  const links = await prisma.candidateAgentLink.findMany({
    where: { agentId: id },
    select: { candidateId: true },
  });
  const candidateIds = links.map(l => l.candidateId);

  // ===== Attribution WHERE (same as View screen) =====
  // Paid attempts in agent currency that should count for this agent:
  //  - MANUAL: attempt.agentId = agent.id
  //  - DEFAULT: attempt.agentId = null AND userId in linked candidates
  const wherePaidForAgent = {
    paymentStatus: 'PAID',
    paymentCurrencyCode: agentCurrency,
    OR: [
      { agentId: id }, // manual override
      ...(candidateIds.length
        ? [{ AND: [{ agentId: null }, { userId: { in: candidateIds } }] }]
        : []),
    ],
  };

  // Sum all matching attempts -> commission earned
  const sumAgg = await prisma.attempt.aggregate({
    where: wherePaidForAgent,
    _sum: { paymentAmountCents: true },
  });
  const totalAmountCents = sumAgg._sum.paymentAmountCents || 0;
  const earnedCents = moneyFloor(agent.commissionPercent, totalAmountCents);

  // Sum all payouts so far
  const paidAgg = await prisma.agentPayout.aggregate({
    where: { agentId: id },
    _sum: { amountCents: true },
  });
  const paidCents = paidAgg._sum.amountCents || 0;

  const outstandingCents = Math.max(0, earnedCents - paidCents);

  if (amountCents > outstandingCents) {
    return NextResponse.json(
      { error: `Amount exceeds outstanding (${(outstandingCents / 100).toFixed(2)}).` },
      { status: 400 }
    );
  }

  // Create payout
  const payout = await prisma.agentPayout.create({
    data: {
      agentId: id,
      amountCents,
      notes,
      createdBy: admin.email || admin.sub || null,
      paidOnDate: new Date(),
    },
  });

  // Audit (best-effort)
  prisma.auditLog?.create({
    data: {
      action: 'AGENT_PAYOUT_CREATE',
      entityType: 'Agent',
      entityId: id,
      beforeJson: null,
      afterJson: JSON.stringify({ payout }),
      actorId: admin.sub || null,
    },
  }).catch(() => {});

  // Recompute quick metrics after payout
  const paidAgg2 = await prisma.agentPayout.aggregate({
    where: { agentId: id },
    _sum: { amountCents: true },
  });
  const paidCents2 = paidAgg2._sum.amountCents || 0;
  const outstandingCents2 = Math.max(0, earnedCents - paidCents2);

  return NextResponse.json({
    ok: true,
    payout,
    metrics: {
      commissionEarnedCents: earnedCents,
      commissionPaidCents: paidCents2,
      outstandingCents: outstandingCents2,
      currencyCode: agentCurrency,
    },
  });
}
