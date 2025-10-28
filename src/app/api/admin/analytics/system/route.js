export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth';

const PASS_LEVELS = new Set(['B2', 'C1', 'C2']);
const SUPPORTED_CURRENCIES = ['ALL', 'USD', 'GBP', 'INR', 'NPR', 'PKR'];

// Admin guard
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

// helpers
const toInt = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
const cents = (n) => (Number.isFinite(n) ? n : 0);

// parse start/end (YYYY-MM-DD); if absent, fallback to last N days.
// end is treated exclusive.
function parseWindow(url) {
  const startStr = url.searchParams.get('start');
  const endStr = url.searchParams.get('end');
  if (startStr && endStr) {
    const start = new Date(startStr + 'T00:00:00.000Z');
    // exclusive end
    const end = new Date(new Date(endStr + 'T00:00:00.000Z').getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }
  const days = Math.max(1, toInt(url.searchParams.get('days'), 30));
  const end = new Date(); // now exclusive
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const { start, end } = parseWindow(url);
  const country = (url.searchParams.get('country') || 'ALL').trim();
  const currencyParam = (url.searchParams.get('currency') || 'ALL').toUpperCase();
  const currency = SUPPORTED_CURRENCIES.includes(currencyParam) ? currencyParam : 'ALL';

  const userWhere = country !== 'ALL' ? { country } : undefined;
  const currencyWhere = currency !== 'ALL' ? { paymentCurrencyCode: currency } : {};

  // 0) New candidates joined (users created in window)
  const newCandidatesJoined = await prisma.user.count({
    where: { createdAt: { gte: start, lt: end }, ...(userWhere ? userWhere : {}) },
  });

  // 1) Tests purchased & revenue (paidAt in window)
  const paidWhere = {
    paymentStatus: 'PAID',
    paidAt: { gte: start, lt: end },
    ...(userWhere ? { user: userWhere } : {}),
    ...currencyWhere,
  };

  const [testsPurchased, revenueAgg] = await Promise.all([
    prisma.attempt.count({ where: paidWhere }),
    prisma.attempt.aggregate({
      where: paidWhere,
      _sum: { paymentAmountCents: true },
    }),
  ]);
  const revenueCents = cents(revenueAgg._sum.paymentAmountCents);

  // 2) Completion Rate = completed / purchased (both within window)
  const completedInWindow = await prisma.attempt.count({
    where: {
      status: 'SUBMITTED',
      finishedAt: { gte: start, lt: end },
      ...(userWhere ? { user: userWhere } : {}),
      ...currencyWhere,
    },
  });
  const completionRatePct = pct(completedInWindow, testsPurchased);

  // 3) Retake Rate = among completers in window, % with >=2 completes in window
  const submittedByUser = await prisma.attempt.groupBy({
    by: ['userId'],
    where: {
      status: 'SUBMITTED',
      finishedAt: { gte: start, lt: end },
      ...(userWhere ? { user: userWhere } : {}),
      ...currencyWhere,
    },
    _count: { _all: true },
  });
  const candidatesWithAnySubmit = submittedByUser.length;
  const candidatesWithRetake = submittedByUser.filter((g) => g._count._all >= 2).length;
  const retakeRatePct = pct(candidatesWithRetake, candidatesWithAnySubmit);

  // 4) Active Candidates = distinct users with ≥1 completed in window
  const activeCandidates = candidatesWithAnySubmit;

  // 5) Average scores by section (A1..C2) on submitted attempts in window
  const submittedAttempts = await prisma.attempt.findMany({
    where: {
      status: 'SUBMITTED',
      finishedAt: { gte: start, lt: end },
      ...(userWhere ? { user: userWhere } : {}),
      ...currencyWhere,
    },
    select: {
      id: true,
      items: {
        select: {
          isCorrect: true,
          question: { select: { tag: true } }, // A1..C2
        },
      },
    },
  });

  const buckets = new Map([
    ['A1', { ok: 0, total: 0 }],
    ['A2', { ok: 0, total: 0 }],
    ['B1', { ok: 0, total: 0 }],
    ['B2', { ok: 0, total: 0 }],
    ['C1', { ok: 0, total: 0 }],
    ['C2', { ok: 0, total: 0 }],
  ]);

  for (const a of submittedAttempts) {
    for (const it of a.items || []) {
      const tag = (it.question?.tag || '').toUpperCase();
      if (!buckets.has(tag)) continue;
      const b = buckets.get(tag);
      b.total += 1;
      if (it.isCorrect === true) b.ok += 1;
    }
  }
  const sectionAverages = [...buckets.entries()].map(([tag, { ok, total }]) => ({
    tag,
    avgPercent: pct(ok, total),
  }));

  // 6) Quick summary extras
  const [startedUsers, purchasedUsers, submittedUsers, newUsers] = await Promise.all([
    prisma.attempt.groupBy({
      by: ['userId'],
      where: { startedAt: { gte: start, lt: end }, ...(userWhere ? { user: userWhere } : {}), ...currencyWhere },
      _count: { _all: true },
    }),
    prisma.attempt.groupBy({
      by: ['userId'],
      where: paidWhere,
      _count: { _all: true },
    }),
    prisma.attempt.groupBy({
      by: ['userId'],
      where: { status: 'SUBMITTED', finishedAt: { gte: start, lt: end }, ...(userWhere ? { user: userWhere } : {}), ...currencyWhere },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: start, lt: end }, ...(userWhere ? userWhere : {}) },
      select: { id: true },
    }),
  ]);

  const uniqueSet = new Set([
    ...startedUsers.map((g) => g.userId),
    ...purchasedUsers.map((g) => g.userId),
    ...submittedUsers.map((g) => g.userId),
    ...newUsers.map((u) => u.id),
  ]);
  const uniqueCandidates = uniqueSet.size;

  // Overall pass rate (among submitted attempts in window)
  const submittedWithLevel = await prisma.attempt.findMany({
    where: { status: 'SUBMITTED', finishedAt: { gte: start, lt: end }, ...(userWhere ? { user: userWhere } : {}), ...currencyWhere },
    select: { level: true },
  });
  const passN = submittedWithLevel.filter(
    (a) => a.level && PASS_LEVELS.has(String(a.level).toUpperCase())
  ).length;
  const overallPassRatePct = pct(passN, submittedWithLevel.length);

  const avgRevenuePerTestCents =
    testsPurchased > 0 ? Math.floor(revenueCents / testsPurchased) : 0;

  return NextResponse.json({
    params: {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      country,
      currency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    },
    kpis: {
      testsPurchased,
      revenueCents,
      completionRatePct,
      retakeRatePct,
      activeCandidates,
      newCandidatesJoined,
    },
    sectionAverages,
    quickSummary: {
      totalTestsPurchased: testsPurchased,
      totalRevenueCents: revenueCents,
      avgRevenuePerTestCents,
      uniqueCandidates,
      overallPassRatePct,
      candidateRetakeRatePct: retakeRatePct,
    },
  });
}
