import { NextRequest, NextResponse } from "next/server";
import { createCart } from "@/lib/storefront";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variantId } = body;

    if (!variantId || typeof variantId !== "string") {
      return NextResponse.json(
        { error: "variantId is required" },
        { status: 400 }
      );
    }

    const { checkoutUrl } = await createCart(variantId);
    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("Cart creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create cart" },
      { status: 500 }
    );
  }
}
