import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { amount, currency, productTitle } = await req.json();

    if (!amount || typeof amount !== "number" || amount < 50) {
      return Response.json(
        { error: "Amount must be at least 50 cents" },
        { status: 400 }
      );
    }

    const body = new URLSearchParams({
      amount: String(Math.round(amount)),
      currency: (currency || "usd").toLowerCase(),
      "metadata[productTitle]": productTitle || "",
      "automatic_payment_methods[enabled]": "true",
    });

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        { error: data.error?.message || "Stripe error" },
        { status: res.status }
      );
    }

    return Response.json({ clientSecret: data.client_secret });
  } catch (err) {
    console.error("Payment intent error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
