"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { withBasePath } from "@/lib/base-path";

export default function ChatPage() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: withBasePath("/api/chat") }),
    []
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState("");
  const initialPrompt = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("prompt");
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  const bottomRef = useRef<HTMLDivElement>(null);
  const hasAutoSentRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!initialPrompt || isLoading || messages.length > 0 || hasAutoSentRef.current) return;
    hasAutoSentRef.current = true;
    sendMessage({ text: initialPrompt });
  }, [initialPrompt, isLoading, messages.length, sendMessage]);

  const onSubmit = () => {
    if (input.trim() && !isLoading) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h1 className="font-display text-lg font-semibold text-foreground">
          Chat with Zoe
        </h1>
        <p className="text-xs text-muted-foreground">
          Ask about meetings, draft replies, search your signals.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display font-bold text-lg mb-4">
                Z
              </div>
              <h2 className="font-display text-lg font-medium text-foreground">
                Hi! I&apos;m Zoe.
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                I can help you with your meetings, emails, and tasks. Try asking
                me:
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "What meetings do I have today?",
                  "What are my top priorities?",
                  "Draft a reply to the budget email",
                  "Prep me for the roadmap review",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                    onClick={() => {
                      sendMessage({ text: suggestion });
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const textContent =
              message.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text ?? "")
                .join("") ?? "";

            const tools = message.parts
              ?.filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"))
              .map((p) => {
                const part = p as Record<string, unknown>;
                return {
                  toolName: String(part.toolName ?? "unknown"),
                  state: String(part.state ?? "result"),
                  result: part.output,
                };
              });

            return (
              <ChatMessage
                key={message.id}
                role={message.role as "user" | "assistant"}
                content={textContent}
                toolInvocations={tools}
              />
            );
          })}

          {isLoading &&
            messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-display font-bold">
                  Z
                </div>
                <div className="rounded-xl bg-muted px-4 py-2.5">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        onChange={setInput}
        onSubmit={onSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
