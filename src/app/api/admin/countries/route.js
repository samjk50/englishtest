export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccess } from '@/lib/auth';

async function getAdmin() {
  const jar = await cookies();
  const token = jar.get('access_token')?.value;
  if (!token) return null;
  try {
    const u = await Promise.resolve(verifyAccess(token));
    if (String(u.role).toUpperCase() !== 'ADMIN') return null;
    return u;
  } catch { return null; }
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.user.findMany({
    where: { role: 'CANDIDATE', country: { not: null } },
    select: { country: true },
    distinct: ['country'],
  });
  const countries = rows
    .map((r) => r.country)
    .filter(Boolean)
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ countries });
}
