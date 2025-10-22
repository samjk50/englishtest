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

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d); } catch { return null; }
}

export async function GET(req) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('search') || '').trim();
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));

  const whereUser = {
    role: 'CANDIDATE',
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } }, // remove mode on MySQL
            { email:   { contains: q } },
          ],
        }
      : {}),
  };

  // page of candidates
  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereUser }),
    prisma.user.findMany({
      where: whereUser,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  const ids = users.map(u => u.id);
  if (ids.length === 0) {
    return NextResponse.json({ items: [], page, pageSize, total, totalPages: 1 });
  }

  // attempts count
  const byCount = await prisma.attempt.groupBy({
    by: ['userId'],
    where: { userId: { in: ids } },
    _count: { _all: true },
  });
  const attemptsCount = new Map(byCount.map(r => [r.userId, r._count._all]));

  // revenue per user (PAID)
  const byRevenue = await prisma.attempt.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, paymentStatus: 'PAID' },
    _sum: { paymentAmountCents: true },
  });
  const revenueByUser = new Map(byRevenue.map(r => [r.userId, r._sum.paymentAmountCents || 0]));

  // latest SUBMITTED result + completed date
  const latestSubmitted = await prisma.attempt.findMany({
    where: { userId: { in: ids }, status: 'SUBMITTED' },
    orderBy: [{ finishedAt: 'desc' }, { paidAt: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, userId: true, level: true, finishedAt: true, paidAt: true },
  });
  const lastByUser = new Map();
  for (const a of latestSubmitted) {
    if (!lastByUser.has(a.userId)) {
      lastByUser.set(a.userId, a);
    }
  }

  const items = users.map(u => {
    const last = lastByUser.get(u.id);
    return {
      id: u.id,
      name: u.fullName || '—',
      email: u.email,
      attempts: attemptsCount.get(u.id) || 0,
      lastResult: last?.level || null,
      revenueCents: revenueByUser.get(u.id) || 0,
      lastCompletedAt: fmtDate(last?.finishedAt || last?.paidAt),
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
