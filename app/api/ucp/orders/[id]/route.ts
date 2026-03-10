import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const supabase = getSupabase();

    const { data: session, error } = await supabase
      .from('ucp_sessions')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      order_id: session.order_id,
      status: session.status,
      line_items: session.line_items,
      total_amount: session.total_amount,
      currency: session.currency,
      buyer: session.buyer,
      estimated_delivery: '3-5 business days',
      created_at: session.created_at,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
