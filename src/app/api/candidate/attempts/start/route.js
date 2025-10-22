export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const TAGS_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || "devsecret_change_me";

async function getUser() {
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (!token) return null;
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]} return a; }
const toStrArray = (arr) => JSON.stringify(Array.isArray(arr) ? arr : []);

export async function POST(request) {
  const user = await getUser();
  if (!user || user.role !== "CANDIDATE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkoutSessionId } = await request.json().catch(() => ({}));

  // 1) Find the EXACT awaiting attempt if cs is provided, otherwise pick the most recent awaiting paid attempt
  let attempt = null;

  if (checkoutSessionId) {
    attempt = await prisma.attempt.findFirst({
      where: {
        userId: user.sub,
        stripeSessionId: checkoutSessionId,
        paymentStatus: 'PAID',
        status: 'AWAITING_START',
      },
      select: { id: true, status: true, startedAt: true },
    });
  }

  if (!attempt) {
    attempt = await prisma.attempt.findFirst({
      where: {
        userId: user.sub,
        paymentStatus: 'PAID',
        status: 'AWAITING_START',
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      select: { id: true, status: true, startedAt: true },
    });
  }

  if (!attempt) {
    return NextResponse.json({ error: "No paid test is awaiting start." }, { status: 409 });
  }

  // If already in progress because of a double click, just return it idempotently
  if (attempt.status === 'IN_PROGRESS') {
    return NextResponse.json({ attemptId: attempt.id }, { status: 200 });
  }

  // 2) Build attempt items ONLY if none exist yet (idempotent)
  const existingItems = await prisma.attemptItem.count({ where: { attemptId: attempt.id } });
  if (existingItems === 0) {
    const settings = await prisma.testSettings.findUnique({ where: { id: 1 } });
    const crit = (() => {
      if (!settings?.criteria) return {};
      if (typeof settings.criteria === "string") { try { return JSON.parse(settings.criteria); } catch { return {}; } }
      return settings.criteria || {};
    })();

    const items = [];
    for (const tag of TAGS_ORDER) {
      const need = Number(crit[tag] || 0);
      if (!need) continue;

      const qs = await prisma.question.findMany({
        where: { tag, archived:false },
        include: { options: { orderBy: { order: "asc" } } },
      });

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

    if (items.length === 0) {
      return NextResponse.json({ error: "No questions configured." }, { status: 409 });
    }

    await prisma.attempt.update({
      where: { id: attempt.id },
      data: {
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
  }

  // 3) Mark as started
  await prisma.attempt.update({
    where: { id: attempt.id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  });

  return NextResponse.json({ attemptId: attempt.id }, { status: 200 });
}
