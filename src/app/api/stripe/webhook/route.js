export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/Stripe';

// Read raw body for Stripe signature verification (App Router)
async function readRawBody(req) {
  return await req.text();
}

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  let event;

  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;

      const candidateId = session.client_reference_id; // set in /api/candidate/checkout
      const currency = (session.currency || '').toUpperCase();
      const amountTotal = Number(session.amount_total) || 0; // int cents
      const stripeSessionId = session.id;
      const stripePaymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null;
      const region = session.metadata?.region || null;

      if (!candidateId || !stripeSessionId) {
        console.warn('Webhook missing candidateId or sessionId', { candidateId, stripeSessionId });
        return NextResponse.json({ received: true });
      }

      // Idempotency by session
      const exists = await prisma.attempt.findUnique({ where: { stripeSessionId }, select: { id: true } });
      if (exists) return NextResponse.json({ received: true });

      await prisma.attempt.create({
        data: {
          user: { connect: { id: candidateId } },
          status: 'AWAITING_START',
          region,
          paymentCurrencyCode: currency || null,
          paymentAmountCents: amountTotal,
          paidAt: new Date(),
          paymentStatus: 'PAID',
          stripeSessionId,
          stripePaymentId,
        },
      });
    }

    // Acknowledge other events (we don't use them)
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // 500 so Stripe retries if our write failed
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
