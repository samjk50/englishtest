export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAgentCode } from '@/app/utils/referral';

// ---------- helpers ----------
function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function truncDiv100(n) {
  // commission in "cents" as integer (no fractions of a cent)
  return Math.trunc(n / 100);
}

async function computeAgentMetrics(agent) {
  const agentId = agent.id;
  const currency = (agent.currencyCode || '').toUpperCase();

  // Referrals = default links (candidate->agent)
  const links = await prisma.candidateAgentLink.findMany({
    where: { agentId },
    select: { candidateId: true },
  });
  const userIds = links.map(l => l.candidateId);
  const referrals = userIds.length;

  // Payouts sum
  const payoutAgg = await prisma.agentPayout.aggregate({
    where: { agentId },
    _sum: { amountCents: true },
  });
  const commissionPaidCents = payoutAgg._sum.amountCents || 0;

  // Paid attempts with MANUAL override to this agent
  const manualAttempts = await prisma.attempt.findMany({
    where: {
      agentId,
      paymentStatus: 'PAID',
      paymentCurrencyCode: currency,
    },
    select: { paymentAmountCents: true },
  });

  // Paid attempts from DEFAULT attribution:
  //  - user is linked to this agent
  //  - attempt has no manual override
  //  - currency matches
  //  - paid
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

  // Commission = sum(amountCents) * pct / 100 (truncated to integer cents)
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

// ---------- POST (create agent) ----------
export async function POST(req) {
  // TODO: auth check (admin only)
  const body = await req.json().catch(() => ({}));
  const { name, email, commissionPercent, currencyCode, status, code: clientCode } = body || {};

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }
  const pct = toNumber(commissionPercent);
  if (pct === null || pct < 0 || pct > 100) {
    return NextResponse.json({ error: 'Commission percent must be between 0 and 100.' }, { status: 400 });
  }
  if (!currencyCode) {
    return NextResponse.json({ error: 'Currency code is required.' }, { status: 400 });
  }

  // Ensure unique code (honor preview but regenerate if collision)
  let code = (clientCode || generateAgentCode()).toUpperCase();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.agent.findUnique({ where: { code } });
    if (!exists) break;
    code = generateAgentCode().toUpperCase();
  }

  try {
    const agent = await prisma.agent.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        code,
        commissionPercent: pct,
        currencyCode: String(currencyCode).toUpperCase(),
        status: String(status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      select: {
        id: true, name: true, email: true, code: true, commissionPercent: true,
        currencyCode: true, status: true, createdAt: true, updatedAt: true,
      },
    });

    prisma.auditLog?.create({
      data: {
        action: 'AGENT_CREATE',
        entityType: 'Agent',
        entityId: agent.id,
        beforeJson: null,
        afterJson: JSON.stringify(agent),
        actorId: null,
      },
    }).catch(() => {});

    // Return with KPI zeros (no paid attempts yet)
    return NextResponse.json({
      ...agent,
      referrals: 0,
      paidTests: 0,
      commissionEarnedCents: 0,
      commissionPaidCents: 0,
      outstandingCents: 0,
    }, { status: 201 });
  } catch (e) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email or Code already exists.' }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed to create agent.' }, { status: 500 });
  }
}

// ---------- GET (list agents with live KPIs) ----------
export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, code: true,
        commissionPercent: true, currencyCode: true, status: true, createdAt: true,
        _count: { select: { candidates: true } }, // optional, not used now
      },
    });

    // Compute KPIs per agent (small N, fine to do sequentially; or Promise.all if needed)
    const results = [];
    for (const a of agents) {
      const kpis = await computeAgentMetrics(a);
      results.push({
        id: a.id,
        name: a.name,
        email: a.email,
        code: a.code,
        commissionPercent: a.commissionPercent,
        currencyCode: a.currencyCode,
        status: a.status,
        createdAt: a.createdAt,
        referrals: kpis.referrals,
        paidTests: kpis.paidTests,
        commissionEarnedCents: kpis.commissionEarnedCents,
        commissionPaidCents: kpis.commissionPaidCents,
        outstandingCents: kpis.outstandingCents,
      });
    }

    return NextResponse.json({ items: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch agents.' }, { status: 500 });
  }
}
