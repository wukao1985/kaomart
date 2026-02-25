"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";

interface ProductDrawerProps {
  product: Product | null;
  onClose: () => void;
}

type View = "detail" | "checkout";

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
  const [view, setView] = useState<View>("detail");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // Reset view when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setView("detail");
      setIframeLoading(true);
      setIframeError(false);
    }
  }, [isOpen]);

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

  const handleCheckoutClick = useCallback(() => {
    if (!product?.checkoutUrl || product.checkoutUrl === "#") return;
    setView("checkout");
  }, [product]);

  const handleBackClick = useCallback(() => {
    setView("detail");
    setIframeLoading(true);
    setIframeError(false);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeLoading(false);
    setIframeError(true);
  }, []);

  const handleOpenInBrowser = useCallback(() => {
    if (product?.checkoutUrl && product.checkoutUrl !== "#") {
      window.location.href = product.checkoutUrl;
    }
  }, [product]);

  const isCheckoutView = view === "checkout" && product?.checkoutUrl && product.checkoutUrl !== "#";

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
            ${isOpen ? 'translate-y-0' : 'translate-y-full'}
            ${isCheckoutView ? 'h-[90vh] flex flex-col' : ''}`}
        >
        {/* Drag handle - only show in detail view */}
        {!isCheckoutView && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Top bar - Detail view: close button, Checkout view: back + title */}
        {isCheckoutView ? (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Back</span>
            </button>
            <h3 className="text-sm font-semibold text-white">Checkout</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-lg transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-lg transition-colors"
          >
            ×
          </button>
        )}

        {product && (
          <div className={`${isCheckoutView ? "flex-1 flex flex-col overflow-hidden" : "px-5 pb-8 pt-2 overflow-y-auto"}`}>
            {isCheckoutView ? (
              // Checkout View
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Iframe container */}
                <div className="flex-1 relative">
                  {iframeLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-400">Loading checkout...</p>
                    </div>
                  )}
                  <iframe
                    src={product.checkoutUrl}
                    title="Checkout"
                    className="w-full h-full border-0"
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    allow="payment"
                  />
                </div>

                {/* Always-visible fallback bar */}
                <div className="flex-none px-4 py-3 border-t border-gray-800 bg-gray-900">
                  <p className="text-center text-sm text-gray-400">
                    Not loading?{" "}
                    <button
                      onClick={handleOpenInBrowser}
                      className="text-emerald-400 underline hover:text-emerald-300 transition-colors"
                    >
                      Open checkout in browser
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              // Product Detail View
              <>
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
                    onClick={handleCheckoutClick}
                    disabled={!product.checkoutUrl || product.checkoutUrl === "#"}
                    className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all
                      ${product.checkoutUrl && product.checkoutUrl !== "#"
                        ? "bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40"
                        : "bg-gray-700 text-gray-500 cursor-not-allowed"
                      }`}
                  >
                    {product.checkoutUrl && product.checkoutUrl !== "#"
                      ? "🛒 Buy Now"
                      : "Unavailable"}
                  </button>
                </div>

                {/* Merchant note */}
                {product.vendor && (
                  <p className="text-center text-xs text-gray-600 mt-3">
                    Sold by {product.vendor} · Powered by Shopify
                  </p>
                )}
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </>
  );
}
