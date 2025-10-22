export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth'; // returns { sub, role, ... }

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

export async function GET(req, context) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;   // ✅ Next 15: await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // paging
  const url = new URL(req.url);
  const aPage = Math.max(1, Number(url.searchParams.get('attemptsPage') || 1));
  const aSize = Math.min(50, Math.max(1, Number(url.searchParams.get('attemptsPageSize') || 10)));
  const pPage = Math.max(1, Number(url.searchParams.get('payoutsPage') || 1));
  const pSize = Math.min(50, Math.max(1, Number(url.searchParams.get('payoutsPageSize') || 10)));

  // agent
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      commissionPercent: true,
      currencyCode: true,
      status: true,
      createdAt: true,
    },
  });
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const agentCurrency = (agent.currencyCode || '').toUpperCase();

  // all candidates for this agent (for DEFAULT attribution)
  const links = await prisma.candidateAgentLink.findMany({
    where: { agentId: id },
    select: { candidateId: true },
  });
  const candidateIds = links.map((x) => x.candidateId);

  // WHERE for PAID attempts attributed to this agent, in agent currency:
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

  // counts, lists (paged), payouts (paged), and totals for commission
  const [attemptTotal, attempts, payoutsTotal, payouts, sumAgg, paidTests] = await Promise.all([
    prisma.attempt.count({ where: wherePaidForAgent }),
    prisma.attempt.findMany({
      where: wherePaidForAgent,
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      skip: (aPage - 1) * aSize,
      take: aSize,
      select: {
        id: true,
        userId: true,
        status: true,
        paidAt: true,
        paymentAmountCents: true,
        paymentCurrencyCode: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.agentPayout.count({ where: { agentId: id } }),
    prisma.agentPayout.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      skip: (pPage - 1) * pSize,
      take: pSize,
      select: {
        id: true,
        amountCents: true,
        notes: true,
        createdAt: true,
        paidOnDate: true,
      },
    }),
    // Sum of ALL matching attempts (not just current page)
    prisma.attempt.aggregate({
      where: wherePaidForAgent,
      _sum: { paymentAmountCents: true },
    }),
    // You separately computed count, but keeping this for clarity
    prisma.attempt.count({ where: wherePaidForAgent }),
  ]);

  // commission from ALL paid attempts attributed to this agent
  const totalAmountCents = sumAgg._sum.paymentAmountCents || 0;
  const commissionEarnedCents = moneyFloor(agent.commissionPercent, totalAmountCents);

  // payouts total
  const allPaidAgg = await prisma.agentPayout.aggregate({
    where: { agentId: id },
    _sum: { amountCents: true },
  });
  const commissionPaidCents = allPaidAgg._sum.amountCents || 0;
  const outstandingCents = Math.max(0, commissionEarnedCents - commissionPaidCents);

  const attemptRows = attempts.map((a) => ({
    id: a.id,
    candidate: { name: a.user?.fullName || '—', email: a.user?.email || '' },
    date: a.paidAt || null,
    amountCents: a.paymentAmountCents || 0,
    currencyCode: a.paymentCurrencyCode || agentCurrency,
    status: a.status,
  }));

  return NextResponse.json({
    agent,
    metrics: {
      commissionEarnedCents,
      commissionPaidCents,
      outstandingCents,
      paidTests, // total count across all matching attempts
      currencyCode: agentCurrency,
    },
    attempts: {
      items: attemptRows,
      page: aPage,
      pageSize: aSize,
      total: attemptTotal,
      totalPages: Math.max(1, Math.ceil(attemptTotal / aSize)),
    },
    payouts: {
      items: payouts,
      page: pPage,
      pageSize: pSize,
      total: payoutsTotal,
      totalPages: Math.max(1, Math.ceil(payoutsTotal / pSize)),
    },
  });
}
