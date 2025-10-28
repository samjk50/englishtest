export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth';

async function getAdmin() {
  const jar = await cookies();
  const tok = jar.get('access_token')?.value;
  if (!tok) return null;
  try {
    const u = await Promise.resolve(verifyAccess(tok));
    if (String(u.role).toUpperCase() !== 'ADMIN') return null;
    return u;
  } catch { return null; }
}

function pct(ok, total) {
  if (!total) return 0;
  return Math.round((ok / total) * 100);
}

export async function GET(_req, ctx) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true, country: true, city: true, createdAt: true, identityVerification: { select: { selfieUrl: true, idDocUrl: true } },
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [totalAttempts, revenueAgg, attempts] = await Promise.all([
    prisma.attempt.count({ where: { userId: id } }),
    prisma.attempt.aggregate({
      where: { userId: id, paymentStatus: 'PAID' },
      _sum: { paymentAmountCents: true },
    }),
    prisma.attempt.findMany({
      where: { userId: id },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        level: true,
        paymentAmountCents: true,
        paymentCurrencyCode: true,
        items: {
          select: {
            isCorrect: true,
            question: { select: { tag: true } }, // tag = A1..C2 in your schema today
          },
        },
      },
    }),
  ]);

  const totalRevenueCents = revenueAgg._sum.paymentAmountCents || 0;

  const history = attempts.map(a => {
    // Build % by tag (A1..C2)
    const sums = new Map(); // tag -> {ok,total}
    for (const it of a.items || []) {
      const tag = it.question?.tag || 'Unknown';
      const entry = sums.get(tag) || { ok: 0, total: 0 };
      entry.total += 1;
      if (it.isCorrect === true) entry.ok += 1;
      sums.set(tag, entry);
    }
    const sections = [...sums.entries()].map(([tag, { ok, total }]) => ({
      tag, percent: pct(ok, total),
    })).sort((a, b) => a.tag.localeCompare(b.tag));

    return {
      id: a.id,
      date: a.startedAt,
      status: a.status,
      result: a.level || null,
      amountCents: a.paymentAmountCents || 0,
      currencyCode: a.paymentCurrencyCode || 'USD',
      sections, // [{tag:'A1', percent:38}, ...]
    };
  });

  return NextResponse.json({
    user,
    totals: {
      totalAttempts,
      totalRevenueCents,
    },
    attempts: history,
  });
}
