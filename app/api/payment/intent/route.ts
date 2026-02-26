import { NextRequest } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });
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
      { error: err instanceof Error ? err.message : "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
