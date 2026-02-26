import { NextRequest } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { amount, currency, productTitle } = await req.json();

    if (!amount || typeof amount !== "number" || amount < 50) {
      return Response.json(
        { error: "Amount must be at least 50 cents" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: (currency || "USD").toLowerCase(),
      metadata: { productTitle: productTitle || "" },
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe PaymentIntent error:", err);
    return Response.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
