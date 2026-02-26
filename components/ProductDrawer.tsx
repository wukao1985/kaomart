"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface ProductDrawerProps {
  product: Product | null;
  onClose: () => void;
}

type DrawerView = "detail" | "checkout" | "success";

function StarRating({ rating, count }: { rating: number; count?: number }) {
  const stars = [];
  const rounded = Math.round(rating * 2) / 2;
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={
          i <= rounded
            ? "text-yellow-400"
            : i - 0.5 === rounded
            ? "text-yellow-400 opacity-50"
            : "text-gray-600"
        }
      >
        ★
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-base">
      {stars}
      {count ? (
        <span className="text-gray-400 text-sm ml-1">({count})</span>
      ) : null}
    </span>
  );
}

function CheckoutForm({
  product,
  onSuccess,
  onBack,
}: {
  product: Product;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setPaymentError(error.message || "Payment failed");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  const priceDisplay = `${product.currency === "USD" ? "$" : product.currency}${product.price}`;

  return (
    <div className="px-5 pb-8 pt-2">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>←</span> Back
        </button>
        <h3 className="text-sm font-semibold text-white">Checkout</h3>
        <div className="w-12" /> {/* spacer for centering */}
      </div>

      {/* Product summary */}
      <div className="flex items-center gap-3 mb-4">
        {product.image && (
          <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-white flex-shrink-0">
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-contain p-1"
              sizes="64px"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white font-medium truncate">
            {product.title}
          </p>
          <p className="text-sm text-emerald-400 font-bold">{priceDisplay}</p>
        </div>
      </div>

      <div className="border-t border-gray-700 mb-5" />

      {/* Stripe Payment Form */}
      <form onSubmit={handleSubmit}>
        <PaymentElement />

        {paymentError && (
          <p className="text-red-400 text-sm mt-3">{paymentError}</p>
        )}

        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className={`w-full mt-5 py-3.5 rounded-2xl text-sm font-bold transition-all
            ${
              !stripe || isProcessing
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40"
            }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processing...
            </span>
          ) : (
            `Pay ${priceDisplay}`
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-3">
          Test card: 4242 4242 4242 4242 · Any future date · Any CVC
        </p>
      </form>
    </div>
  );
}

export default function ProductDrawer({
  product,
  onClose,
}: ProductDrawerProps) {
  const isOpen = !!product;
  const [view, setView] = useState<DrawerView>("detail");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);

  // Reset state when drawer closes or product changes
  useEffect(() => {
    if (!isOpen) {
      setView("detail");
      setClientSecret(null);
      setIsLoadingIntent(false);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBuyNow = useCallback(async () => {
    if (!product) return;
    setIsLoadingIntent(true);

    try {
      const amount = Math.round(parseFloat(product.price) * 100);
      const res = await fetch("/api/payment/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: product.currency || "USD",
          productTitle: product.title,
        }),
      });
      const data = await res.json();
      if (res.ok && data.clientSecret) {
        setClientSecret(data.clientSecret);
        setView("checkout");
      }
    } catch {
      // keep on detail view if intent creation fails
    }
    setIsLoadingIntent(false);
  }, [product]);

  const handlePaymentSuccess = useCallback(() => {
    setView("success");
  }, []);

  const handleContinueShopping = useCallback(() => {
    setView("detail");
    setClientSecret(null);
    onClose();
  }, [onClose]);

  const stripeAppearance = {
    theme: "night" as const,
    variables: {
      colorPrimary: "#10b981",
      colorBackground: "#1f2937",
      colorText: "#f9fafb",
      borderRadius: "12px",
    },
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        {/* Backdrop */}
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Drawer */}
        <div
          className={`relative w-full max-w-3xl bg-gray-900 rounded-t-3xl shadow-2xl
            transition-transform duration-300 ease-out pointer-events-auto
            ${isOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-lg transition-colors"
          >
            ×
          </button>

          {product && view === "detail" && (
            <div className="px-5 pb-8 pt-2 overflow-y-auto">
              {/* Product image */}
              {product.image && (
                <div className="relative h-52 w-full rounded-2xl overflow-hidden bg-white mb-4">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    className="object-contain p-4"
                    sizes="(max-width: 768px) 100vw, 700px"
                    unoptimized
                  />
                </div>
              )}

              {/* Vendor */}
              {product.vendor && (
                <p className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1">
                  {product.vendor}
                </p>
              )}

              {/* Title */}
              <h2 className="text-lg font-bold text-white leading-snug mb-2">
                {product.title}
              </h2>

              {/* Rating */}
              {product.rating > 0 && (
                <div className="mb-3">
                  <StarRating
                    rating={product.rating}
                    count={product.ratingCount}
                  />
                </div>
              )}

              {/* Description */}
              {product.description && (
                <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-4">
                  {product.description}
                </p>
              )}

              {/* Price + CTA */}
              <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-800">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Price</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {product.currency === "USD" ? "$" : product.currency}
                    {product.price}
                  </p>
                </div>

                <button
                  onClick={handleBuyNow}
                  disabled={isLoadingIntent}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all
                    ${
                      !isLoadingIntent
                        ? "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  {isLoadingIntent ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    "Buy Now"
                  )}
                </button>
              </div>

              {/* Merchant note */}
              {product.vendor && (
                <p className="text-center text-xs text-gray-600 mt-3">
                  Sold by {product.vendor} · Powered by Shopify
                </p>
              )}
            </div>
          )}

          {product && view === "checkout" && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: stripeAppearance }}
            >
              <CheckoutForm
                product={product}
                onSuccess={handlePaymentSuccess}
                onBack={() => {
                  setView("detail");
                  setClientSecret(null);
                }}
              />
            </Elements>
          )}

          {product && view === "success" && (
            <div className="px-5 pb-8 pt-2 text-center">
              <div className="text-6xl mb-4 mt-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">
                Order Confirmed!
              </h2>
              <p className="text-sm text-gray-400 mb-1">{product.title}</p>
              <p className="text-lg font-bold text-emerald-400 mb-6">
                {product.currency === "USD" ? "$" : product.currency}
                {product.price}
              </p>
              <button
                onClick={handleContinueShopping}
                className="w-full py-3.5 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40 transition-all"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
