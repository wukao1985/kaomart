import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateSessionId(): string {
  return 'chk_' + Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

interface LineItem {
  item_id: string;
  title: string;
  price: number;
  quantity: number;
}

interface Buyer {
  email: string;
  full_name: string;
}

interface CheckoutRequest {
  line_items: LineItem[];
  buyer: Buyer;
  currency?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();

    if (!body.line_items || !Array.isArray(body.line_items) || body.line_items.length === 0) {
      return NextResponse.json(
        { error: 'line_items is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!body.buyer || !body.buyer.email || !body.buyer.full_name) {
      return NextResponse.json(
        { error: 'buyer.email and buyer.full_name are required' },
        { status: 400 }
      );
    }

    const sessionId = generateSessionId();
    const currency = body.currency || 'USD';
    const totalAmount = body.line_items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const { error } = await supabase.from('ucp_sessions').insert({
      id: sessionId,
      status: 'ready_for_complete',
      line_items: body.line_items,
      buyer: body.buyer,
      currency,
      total_amount: totalAmount,
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: sessionId,
      status: 'ready_for_complete',
      currency,
      total_amount: totalAmount,
      line_items: body.line_items,
      buyer: body.buyer,
      ucp: { version: '2026-01-11' },
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
