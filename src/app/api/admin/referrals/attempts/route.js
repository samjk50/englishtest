export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/referrals/attempts?search=&page=1&pageSize=20
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('search') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)));

    // Build WHERE without undefined keys
    const where = q
    ? {
        user: {
          is: {
            OR: [
              { fullName: { contains: q } }, // no mode on MySQL
              { email:   { contains: q } },
            ],
          },
        },
      }
    : {};

    const [total, attempts] = await Promise.all([
      prisma.attempt.count({ where }),
      prisma.attempt.findMany({
        where,
        orderBy: [
          { paidAt: 'desc' },
          { startedAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          startedAt: true,
          paidAt: true,
          paymentStatus: true,
          paymentCurrencyCode: true,
          userId: true,
          user: { select: { id: true, fullName: true, email: true } },
          // manual override agent (if any)
          agent: { select: { id: true, name: true, code: true, status: true, currencyCode: true } },
        },
      }),
    ]);

    // Map user -> default agent (if any)
    const userIds = [...new Set(attempts.map(a => a.userId))];
    const links = userIds.length
      ? await prisma.candidateAgentLink.findMany({
          where: { candidateId: { in: userIds } },
          select: {
            candidateId: true,
            agent: { select: { id: true, name: true, code: true, status: true, currencyCode: true } },
          },
        })
      : [];
    const defaultByUser = new Map(links.map(l => [l.candidateId, l.agent]));

    const items = attempts.map(a => {
      let assigned = { type: 'NONE' };

      if (a.agent) {
        // Manual override takes precedence
        assigned = { type: 'MANUAL', agentId: a.agent.id, name: a.agent.name, code: a.agent.code };
      } else {
        // Use default only if ACTIVE and currency matches paid attempt
        const def = defaultByUser.get(a.userId);
        const canUseDefault =
          def &&
          def.status === 'ACTIVE' &&
          a.paymentStatus === 'PAID' &&
          (a.paymentCurrencyCode || '').toUpperCase() === (def.currencyCode || '').toUpperCase();

        if (canUseDefault) {
          assigned = { type: 'DEFAULT', agentId: def.id, name: def.name, code: def.code };
        }
      }

      return {
        attemptId: a.id,
        candidate: { id: a.user.id, name: a.user.fullName, email: a.user.email },
        testDate: a.paidAt || a.startedAt,
        status: a.status,
        paymentStatus: a.paymentStatus,
        currency: a.paymentCurrencyCode,
        assigned,
      };
    });

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}
