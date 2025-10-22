export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function truncDiv100(n) {
  return Math.trunc(n / 100);
}

async function computeAgentMetrics(agent) {
  const agentId = agent.id;
  const currency = (agent.currencyCode || '').toUpperCase();

  const links = await prisma.candidateAgentLink.findMany({
    where: { agentId },
    select: { candidateId: true },
  });
  const userIds = links.map(l => l.candidateId);
  const referrals = userIds.length;

  const payoutAgg = await prisma.agentPayout.aggregate({
    where: { agentId },
    _sum: { amountCents: true },
  });
  const commissionPaidCents = payoutAgg._sum.amountCents || 0;

  const manualAttempts = await prisma.attempt.findMany({
    where: {
      agentId,
      paymentStatus: 'PAID',
      paymentCurrencyCode: currency,
    },
    select: { paymentAmountCents: true },
  });

  const defaultAttempts = userIds.length
    ? await prisma.attempt.findMany({
        where: {
          agentId: null,
          userId: { in: userIds },
          paymentStatus: 'PAID',
          paymentCurrencyCode: currency,
        },
        select: { paymentAmountCents: true },
      })
    : [];

  const paidTests = manualAttempts.length + defaultAttempts.length;

  const totalAmountCents =
    manualAttempts.reduce((s, a) => s + (a.paymentAmountCents || 0), 0) +
    defaultAttempts.reduce((s, a) => s + (a.paymentAmountCents || 0), 0);

  const commissionEarnedCents = truncDiv100(totalAmountCents * (agent.commissionPercent || 0));
  const outstandingCents = Math.max(0, commissionEarnedCents - commissionPaidCents);

  return {
    referrals,
    paidTests,
    commissionEarnedCents,
    commissionPaidCents,
    outstandingCents,
  };
}

export async function GET(_req, context) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, code: true,
        commissionPercent: true, currencyCode: true, status: true,
        createdAt: true, updatedAt: true,
        payouts: {
          select: {
            id: true, amountCents: true, currencyCode: true,
            notes: true, paidOnDate: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!agent) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const kpis = await computeAgentMetrics(agent);

    return NextResponse.json({
      ...agent,
      referrals: kpis.referrals,
      paidTests: kpis.paidTests,
      commissionEarnedCents: kpis.commissionEarnedCents,
      commissionPaidCents: kpis.commissionPaidCents,
      outstandingCents: kpis.outstandingCents,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch agent.' }, { status: 500 });
  }
}

export async function PATCH(req, context) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  try {
    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.email !== undefined) data.email = String(body.email).toLowerCase();
    if (body.commissionPercent !== undefined) {
      const pct = Number(body.commissionPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: 'Commission percent must be between 0 and 100.' }, { status: 400 });
      }
      data.commissionPercent = pct;
    }
    if (body.currencyCode !== undefined) data.currencyCode = String(body.currencyCode).toUpperCase();
    if (body.status !== undefined) data.status = String(body.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await prisma.agent.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, code: true,
        commissionPercent: true, currencyCode: true, status: true,
        createdAt: true, updatedAt: true,
      },
    });

    prisma.auditLog?.create({
      data: {
        action: 'AGENT_UPDATE',
        entityType: 'Agent',
        entityId: updated.id,
        beforeJson: JSON.stringify(existing),
        afterJson: JSON.stringify(updated),
        actorId: null,
      },
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists.' }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to update agent.' }, { status: 500 });
  }
}

export async function DELETE(_req, context) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  try {
    const existing = await prisma.agent.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    await prisma.agent.delete({ where: { id } });

    prisma.auditLog?.create({
      data: {
        action: 'AGENT_DELETE',
        entityType: 'Agent',
        entityId: id,
        beforeJson: JSON.stringify(existing),
        afterJson: null,
        actorId: null,
      },
    }).catch(() => {});

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to delete agent.' }, { status: 500 });
  }
}
