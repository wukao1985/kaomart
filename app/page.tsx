"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { Product } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  productResults?: Product[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    async function initSession() {
      const stored = localStorage.getItem("kaomart_session_id");
      if (stored) {
        setSessionId(stored);
        return;
      }
      try {
        const res = await fetch("/api/session", { method: "POST" });
        const data = await res.json();
        localStorage.setItem("kaomart_session_id", data.sessionId);
        setSessionId(data.sessionId);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }
    initSession();
  }, []);

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
        const res = await fetch("/api/chat", {
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
    [sessionId, isLoading]
  );

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
          K
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">KaoMart</h1>
          <p className="text-xs text-gray-400">AI Shopping Assistant</p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full pt-32 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-emerald-400">K</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">
                Welcome to KaoMart
              </h2>
              <p className="text-sm text-gray-400 max-w-sm">
                Tell me what you&apos;re looking for and I&apos;ll find the best
                products for you.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              productResults={msg.productResults}
            />
          ))}
          {isLoading &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                    <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                    <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
