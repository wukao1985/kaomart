import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function generateOrderId(): string {
  return 'km_' + Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

interface CompleteRequest {
  payment: {
    handler_id: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const body: CompleteRequest = await request.json();

    if (!body.payment?.handler_id) {
      return NextResponse.json(
        { error: 'payment.handler_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const stripe = getStripe();

    const { data: session, error: fetchError } = await supabase
      .from('ucp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Checkout session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Checkout session already completed' },
        { status: 409 }
      );
    }

    const amountInCents = Math.round(session.total_amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: session.currency.toLowerCase(),
      metadata: {
        session_id: sessionId,
        buyer_email: session.buyer?.email,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    const orderId = generateOrderId();

    const { error: updateError } = await supabase
      .from('ucp_sessions')
      .update({
        status: 'completed',
        order_id: orderId,
        payment_intent_id: paymentIntent.id,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: orderId,
      status: 'completed',
      estimated_delivery: '3-5 business days',
      ucp: { version: '2026-01-11' },
    });
  } catch (error) {
    console.error('Complete checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
