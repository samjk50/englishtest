export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth';

// Treat these levels as “pass” (tweak if you later read from TestSettings.resultCriteria)
const PASS_LEVELS = new Set(['B2', 'C1', 'C2']);

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
const cents = (n) => Number.isFinite(n) ? n : 0;

export async function GET(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.max(1, toInt(url.searchParams.get('days'), 30));        // 7/30/90 etc.
  const country = (url.searchParams.get('country') || 'ALL').trim();        // 'ALL' | 'Afghanistan' | ...
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Optional user filter by country
  const userWhere = country && country !== 'ALL' ? { country } : undefined;

  // 1) Tests purchased & revenue (paidAt within window; country via related user)
  const paidWhere = {
    paymentStatus: 'PAID',
    paidAt: { gte: since },
    ...(userWhere ? { user: userWhere } : {}),
  };

  const [testsPurchased, revenueAgg] = await Promise.all([
    prisma.attempt.count({ where: paidWhere }),
    prisma.attempt.aggregate({
      where: paidWhere,
      _sum: { paymentAmountCents: true },
    }),
  ]);
  const revenueCents = cents(revenueAgg._sum.paymentAmountCents);

  // 2) Started vs Submitted (within window)
  const startedWhere = { startedAt: { gte: since }, ...(userWhere ? { user: userWhere } : {}) };
  const submittedWhere = {
    status: 'SUBMITTED',
    // consider attempts finished (or at least started) in window
    OR: [{ finishedAt: { gte: since } }, { startedAt: { gte: since } }],
    ...(userWhere ? { user: userWhere } : {}),
  };

  const [startedCount, submittedCount] = await Promise.all([
    prisma.attempt.count({ where: startedWhere }),
    prisma.attempt.count({ where: submittedWhere }),
  ]);
  const completionRatePct = pct(submittedCount, startedCount);

  // 3) Retake rate (within window): % of candidates with >= 2 attempts
  const startedInWindow = await prisma.attempt.groupBy({
    by: ['userId'],
    where: startedWhere,
    _count: { _all: true },
  });
  const totalCandidatesWithAttempts = startedInWindow.length;
  const candidatesWithRetake = startedInWindow.filter((g) => g._count._all >= 2).length;
  const retakeRatePct = pct(candidatesWithRetake, totalCandidatesWithAttempts);

  // 4) Active candidates: >=1 submitted in last N days
  const activeByUser = await prisma.attempt.groupBy({
    by: ['userId'],
    where: { status: 'SUBMITTED', finishedAt: { gte: since }, ...(userWhere ? { user: userWhere } : {}) },
    _count: { _all: true },
  });
  const activeCandidates = activeByUser.length;

  // 5) Average scores by section (A1..C2) on submitted attempts in window
  const submittedAttempts = await prisma.attempt.findMany({
    where: submittedWhere,
    select: {
      id: true,
      items: {
        select: {
          isCorrect: true,
          question: { select: { tag: true } }, // tag is A1..C2 in your schema
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
  const uniqueCandidates = await prisma.attempt.groupBy({
    by: ['userId'],
    where: startedWhere,
    _count: { _all: true },
  });

  const submittedWithLevel = await prisma.attempt.findMany({
    where: submittedWhere,
    select: { level: true },
  });
  const passN = submittedWithLevel.filter((a) => a.level && PASS_LEVELS.has(String(a.level).toUpperCase())).length;
  const overallPassRatePct = pct(passN, submittedWithLevel.length);

  const avgRevenuePerTestCents = testsPurchased > 0 ? Math.floor(revenueCents / testsPurchased) : 0;

  return NextResponse.json({
    params: { days, country, since }, // echoed for UI/debug
    kpis: {
      testsPurchased,
      revenueCents,
      completionRatePct,
      retakeRatePct,
      activeCandidates,
    },
    sectionAverages, // [{tag:'A1', avgPercent: 42}, ...]
    quickSummary: {
      totalTestsPurchased: testsPurchased,
      totalRevenueCents: revenueCents,
      avgRevenuePerTestCents,
      uniqueCandidates: uniqueCandidates.length,
      overallPassRatePct,
      candidateRetakeRatePct: retakeRatePct,
    },
  });
}
