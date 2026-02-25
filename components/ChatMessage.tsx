"use client";

import { Product } from "@/lib/types";
import ProductCard from "./ProductCard";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  productResults?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export default function ChatMessage({
  role,
  content,
  productResults,
  onSelectProduct,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] md:max-w-[70%] ${isUser ? "order-1" : "order-1"}`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              K
            </div>
            <span className="text-xs text-gray-400 font-medium">KaoMart</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-emerald-600 text-white rounded-br-md"
              : "bg-gray-800 text-gray-100 rounded-bl-md"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        </div>
        {productResults && productResults.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {productResults.map((product, i) => (
              <ProductCard
                key={product.id || i}
                product={product}
                onSelect={onSelectProduct || (() => {})}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
