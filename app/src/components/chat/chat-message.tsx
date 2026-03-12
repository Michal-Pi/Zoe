"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  toolInvocations?: {
    toolName: string;
    state: string;
    result?: unknown;
  }[];
}

export function ChatMessage({
  role,
  content,
  toolInvocations,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-display font-bold mt-0.5">
          Z
        </div>
      )}

      <div className={cn("max-w-[80%] space-y-2", isUser && "flex flex-col items-end")}>
        {/* Tool invocation cards */}
        {toolInvocations?.map((invocation, i) => (
          <ToolCard key={i} invocation={invocation} />
        ))}

        {/* Message content */}
        {content && (
          <div
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            <div className="whitespace-pre-wrap prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{content}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({
  invocation,
}: {
  invocation: {
    toolName: string;
    state: string;
    result?: unknown;
  };
}) {
  const toolLabels: Record<string, string> = {
    search_signals: "Searching signals",
    get_todays_meetings: "Getting today's meetings",
    get_top_activities: "Getting top activities",
    get_top_email_signals: "Finding top email",
    generate_meeting_brief: "Generating meeting brief",
    draft_email: "Drafting email",
    send_email: "Sending email",
    draft_slack_message: "Drafting Slack message",
    send_slack_message: "Sending Slack message",
  };

  const label = toolLabels[invocation.toolName] ?? invocation.toolName;
  const isLoading = invocation.state !== "result";
  const resultObject =
    invocation.result && typeof invocation.result === "object"
      ? (invocation.result as Record<string, unknown>)
      : null;
  const resultText =
    typeof resultObject?.message === "string"
      ? resultObject.message
      : typeof resultObject?.note === "string"
        ? resultObject.note
        : typeof resultObject?.error === "string"
          ? resultObject.error
          : null;

  return (
    <Card className="border-border/50">
      <CardContent className="px-3 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ToolIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
            {isLoading && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
            {!isLoading && (
              <CheckIcon className="h-3.5 w-3.5 text-score-low" aria-hidden="true" />
            )}
          </div>
          {!isLoading && resultText ? (
            <p className="text-xs text-foreground">{resultText}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ToolIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2L14 6L6 14H2V10L10 2Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8L6.5 11.5L13 5" />
    </svg>
  );
}
