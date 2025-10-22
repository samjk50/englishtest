export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/Stripe";
import { REGION_TO_PRICE, REGION_TO_CURRENCY } from "@/lib/stripe/Pricing";
import { verifyAccess } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const region = body?.region;

    const priceId = region ? REGION_TO_PRICE[region] : undefined;
    const chosenCurrency = region ? REGION_TO_CURRENCY[region] : undefined;

    if (!region || !priceId || !chosenCurrency) {
      return NextResponse.json({ error: "Invalid region" }, { status: 400 });
    }

    // ✅ cookies() must be awaited in App Router
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value || "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // works whether verifyAccess is sync or async
    const user = await Promise.resolve(verifyAccess(token));
    const candidateId = user.sub;

    // If candidateId is UNIQUE in your schema you can use findUnique; findFirst is resilient either way
    const link = await prisma.candidateAgentLink.findFirst({
      where: { candidateId },
      select: {
        agent: { select: { id: true, name: true, currencyCode: true, status: true } },
      },
    });

    // Enforce agent currency if the candidate is linked and agent is ACTIVE
    if (link?.agent && link.agent.status === "ACTIVE") {
      const required = link.agent.currencyCode;
      if (required !== chosenCurrency) {
        return NextResponse.json(
          { error: `Your agent requires payment in ${required}.` },
          { status: 400 }
        );
      }

      // Optional: if your pricing map doesn't include this currency yet, fail fast
      const supportedCurrencies = new Set(Object.values(REGION_TO_CURRENCY));
      if (!supportedCurrencies.has(required)) {
        return NextResponse.json(
          { error: `Payments in ${required} are not available yet. Please contact support.` },
          { status: 400 }
        );
      }
    }

    const { origin } = new URL(request.url);
    const configured = process.env.NEXT_PUBLIC_BASE_URL;
    const base = configured?.startsWith("http") ? configured : origin;

    const success = `${base}/candidate/instructions?cs={CHECKOUT_SESSION_ID}`;
    const cancel  = `${base}/candidate/checkout`;
    
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: success,
      cancel_url: cancel,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: candidateId,
      metadata: {
        candidateId,
        region: String(region),
        selectedCurrency: chosenCurrency,
        agentId: link?.agent?.id || "",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
