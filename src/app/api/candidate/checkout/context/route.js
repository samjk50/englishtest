export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { REGION_LIST } from '@/lib/stripe/Pricing';
import { verifyAccess } from '@/lib/auth'; // returns { sub, ... }

export async function GET() {
  try {
    // Next 13/14/15 App Router: cookies() is async – must await
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // works whether verifyAccess is sync or async
    const user = await Promise.resolve(verifyAccess(token));

    // If candidateId is UNIQUE in your schema, you can keep findUnique.
    // Using findFirst makes it resilient either way.
    const link = await prisma.candidateAgentLink.findFirst({
      where: { candidateId: user.sub },
      select: {
        agent: {
          select: { id: true, name: true, currencyCode: true, status: true },
        },
      },
    });

    const agent =
      link?.agent && link.agent.status === 'ACTIVE'
        ? link.agent
        : null;

    return NextResponse.json({
      hasAgent: !!agent,
      agent: agent
        ? { id: agent.id, name: agent.name, currencyCode: agent.currencyCode }
        : null,
      regions: REGION_LIST,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load context' }, { status: 500 });
  }
}
