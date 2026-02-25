"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";

interface ProductDrawerProps {
  product: Product | null;
  onClose: () => void;
}

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

export default function ProductDrawer({ product, onClose }: ProductDrawerProps) {
  const isOpen = !!product;
  const [isCreatingCart, setIsCreatingCart] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleBuyNow = useCallback(async () => {
    if (!product) return;

    if (product.variantId) {
      setIsCreatingCart(true);
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: product.variantId }),
        });
        const data = await res.json();
        if (res.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
      } catch {
        // fall through to fallback
      }
      setIsCreatingCart(false);
    }

    // Fallback: use static checkout URL
    if (product.checkoutUrl && product.checkoutUrl !== "#") {
      window.location.href = product.checkoutUrl;
    }
  }, [product]);

  const hasCheckout =
    product &&
    ((product.variantId) ||
      (product.checkoutUrl && product.checkoutUrl !== "#"));

  return (
    <>
      {/* Single fixed wrapper covering full viewport */}
      <div
        className={`fixed inset-0 z-50 flex items-end justify-center pointer-events-none`}
      >
        {/* Backdrop - clickable */}
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Drawer - slides up from bottom */}
        <div
          className={`relative w-full max-w-3xl bg-gray-900 rounded-t-3xl shadow-2xl
            transition-transform duration-300 ease-out pointer-events-auto
            ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
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

        {product && (
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
                <StarRating rating={product.rating} count={product.ratingCount} />
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
                disabled={!hasCheckout || isCreatingCart}
                className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all
                  ${hasCheckout && !isCreatingCart
                    ? "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isCreatingCart ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating cart...
                  </span>
                ) : hasCheckout ? (
                  "Buy Now"
                ) : (
                  "Unavailable"
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
        </div>
      </div>
    </>
  );
}
