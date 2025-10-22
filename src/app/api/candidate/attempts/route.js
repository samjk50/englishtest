export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'devsecret_change_me';

export async function GET(req) {
  try {
    const jar = await cookies();
    const token = jar.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let user;
    try { user = jwt.verify(token, SECRET); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));
    const skip = (page - 1) * pageSize;

    // Count + page results
    const where = { userId: user.sub };
    const [total, items] = await Promise.all([
      prisma.attempt.count({ where }),
      prisma.attempt.findMany({
        where,
        orderBy: [
          { paidAt: 'desc' },     // paid attempts first
          { startedAt: 'desc' },  // then active ones
          { issuedAt: 'desc' },   // then completed (if you set this)
          { id: 'desc' },
        ],
        skip,
        take: pageSize,
        select: {
          id: true,
          status: true,          // 'AWAITING_START' | 'IN_PROGRESS' | 'SUBMITTED'
          level: true,
          startedAt: true,       // used for display (webhook-created will be near paidAt/default)
          paidAt: true,          // available if you want to show purchase time later
        },
      })
    ]);

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
