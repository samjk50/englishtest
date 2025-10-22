export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const TAGS_FALLBACK = ["A1","A2","B1","B2","C1","C2"];
const SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'devsecret_change_me';

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]} return a; }
const toStrArray = (arr) => JSON.stringify(Array.isArray(arr) ? arr : []);
function parseCriteria(settings) {
  if (!settings?.criteria) return {};
  if (typeof settings.criteria === "string") {
    try { return JSON.parse(settings.criteria); } catch { return {}; }
  }
  return settings.criteria || {};
}

export async function POST(req) {
  const jar = await cookies();
  const token = jar.get('access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let user;
  try { user = jwt.verify(token, SECRET); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { stripeSessionId } = await req.json().catch(() => ({}));
  if (!stripeSessionId) return NextResponse.json({ error: 'Missing stripeSessionId' }, { status: 400 });

  // Find the attempt by session; this relies on Attempt.stripeSessionId being unique
  const attempt = await prisma.attempt.findUnique({
    where: { stripeSessionId },
    select: { id: true, userId: true, status: true, paymentStatus: true }
  });

  if (!attempt) {
    // Webhook may not have landed yet; let client retry
    return NextResponse.json({ error: 'NOT_READY' }, { status: 409 });
  }

  if (attempt.userId !== user.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (attempt.status === 'IN_PROGRESS') {
    // Already started — resume
    return NextResponse.json({ attemptId: attempt.id }, { status: 200 });
  }

  if (attempt.paymentStatus !== 'PAID' || attempt.status !== 'AWAITING_START') {
    return NextResponse.json({ error: 'Invalid attempt state' }, { status: 409 });
  }

  // Build items based on criteria
  const settings = await prisma.testSettings.findUnique({ where: { id: 1 } });
  const crit = parseCriteria(settings);
  const TAGS = TAGS_FALLBACK;

  const questionGroups = await Promise.all(
    TAGS.map(tag =>
      prisma.question.findMany({
        where: { tag, archived:false },
        include: { options: { orderBy: { order: 'asc' } } },
      }).then(rows => [tag, rows])
    )
  );
  const byTag = Object.fromEntries(questionGroups);

  const items = [];
  for (const tag of TAGS) {
    const need = Number(crit[tag] || 0);
    if (!need) continue;

    const qs = byTag[tag] || [];
    const chosen = shuffle(qs).slice(0, Math.min(need, qs.length));
    for (const q of chosen) {
      const optionIds = q.options.map(o => o.id);
      const correctOptionIds = q.options.filter(o => o.isCorrect).map(o => o.id);
      items.push({
        questionId: q.id,
        allowMultiple: q.allowMultiple,
        optionIds: toStrArray(optionIds),
        correctOptionIds: toStrArray(correctOptionIds),
      });
    }
  }
  if (!items.length) {
    return NextResponse.json({ error: 'No questions configured.' }, { status: 409 });
  }

  await prisma.attempt.update({
    where: { stripeSessionId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      items: {
        create: items.map((it, i) => ({
          questionId: it.questionId,
          allowMultiple: it.allowMultiple,
          optionIds: it.optionIds,
          correctOptionIds: it.correctOptionIds,
          order: i,
        })),
      },
    },
  });

  return NextResponse.json({ attemptId: attempt.id }, { status: 200 });
}
