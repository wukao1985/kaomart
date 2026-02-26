"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ProductPanel from "@/components/ProductPanel";
import { Product } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  productResults?: Product[];
}

interface ShoppingPageProps {
  mode: "global" | "kaomart";
  sessionStorageKey: string;
  apiRoute: string;
  placeholder: string;
  title: string;
}

export default function ShoppingPage({
  mode,
  sessionStorageKey,
  apiRoute,
  placeholder,
  title,
}: ShoppingPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize session + load history
  useEffect(() => {
    async function initSession() {
      const stored = localStorage.getItem(sessionStorageKey);
      if (stored) {
        setSessionId(stored);
        // Load existing messages
        try {
          const res = await fetch(`/api/messages?sessionId=${stored}`);
          if (res.ok) {
            const data = await res.json();
            if (data.messages && data.messages.length > 0) {
              setMessages(
                data.messages.map((m: { id: string; role: string; content: string; product_results?: Product[] }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  productResults: m.product_results || undefined,
                }))
              );
            }
          }
        } catch {
          // ignore history load failure
        }
        return;
      }
      try {
        const res = await fetch("/api/session", { method: "POST" });
        const data = await res.json();
        localStorage.setItem(sessionStorageKey, data.sessionId);
        setSessionId(data.sessionId);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }
    initSession();
  }, [sessionStorageKey]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        productResults: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const res = await fetch(apiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataLine = line.replace(/^data: /, "").trim();
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine);
              if (event.type === "text") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content += event.data;
                  }
                  return updated;
                });
              } else if (event.type === "products") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.productResults = [
                      ...(last.productResults || []),
                      ...event.data,
                    ];
                  }
                  return updated;
                });
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            last.content = "Something went wrong. Please try again.";
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, apiRoute]
  );

  return (
    <div className="flex h-[100dvh] bg-[#0d0d0d]">
      {/* Left: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e1e]">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors text-lg"
          >
            ←
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
              K
            </div>
            <h1 className="text-sm font-semibold text-white">{title}</h1>
          </div>
          <span
            className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
              mode === "global"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {mode}
          </span>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full pt-32 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-600/10 flex items-center justify-center mb-4">
                  <span className="text-xl font-bold text-emerald-400">K</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-200 mb-2">
                  {title}
                </h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  {mode === "global"
                    ? "Search products across millions of Shopify stores worldwide."
                    : "Browse products from the KaoMart store catalog."}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                productResults={msg.productResults}
                onSelectProduct={setSelectedProduct}
              />
            ))}
            {isLoading &&
              messages[messages.length - 1]?.role === "assistant" &&
              messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e1e] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
                      <div className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
                      <div className="typing-dot w-2 h-2 bg-gray-500 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Input */}
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={placeholder}
          />
        </div>
      </div>

      {/* Right: Product Panel */}
      <ProductPanel
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
