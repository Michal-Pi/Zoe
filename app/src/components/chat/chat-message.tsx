"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  toolInvocations?: {
    toolName: string;
    state: string;
    input?: unknown;
    result?: unknown;
    errorText?: string;
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
        {toolInvocations?.map((invocation, i) => (
          <ToolCard key={i} invocation={invocation} />
        ))}

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
    input?: unknown;
    result?: unknown;
    errorText?: string;
  };
}) {
  const presentation = getToolPresentation(invocation);
  const isLoading =
    invocation.state === "input-streaming" ||
    invocation.state === "input-available";

  return (
    <Card className="border-border/50">
      <CardContent className="px-3 py-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ToolIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{presentation.label}</span>
            {isLoading && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
            {!isLoading && (
              <CheckIcon
                className={cn(
                  "h-3.5 w-3.5",
                  presentation.tone === "error" ? "text-destructive" : "text-score-low"
                )}
                aria-hidden="true"
              />
            )}
          </div>
          {presentation.title ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{presentation.title}</p>
              {presentation.description ? (
                <p className="text-xs text-muted-foreground">{presentation.description}</p>
              ) : null}
            </div>
          ) : null}
          {presentation.meta.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {presentation.meta.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          {presentation.action ? (
            <div className="pt-1">
              <Button asChild size="sm" variant="outline">
                <Link href={presentation.action.href}>{presentation.action.label}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getToolPresentation(invocation: {
  toolName: string;
  state: string;
  input?: unknown;
  result?: unknown;
  errorText?: string;
}) {
  const result =
    invocation.result && typeof invocation.result === "object"
      ? (invocation.result as Record<string, unknown>)
      : null;
  const input =
    invocation.input && typeof invocation.input === "object"
      ? (invocation.input as Record<string, unknown>)
      : null;

  if (invocation.state === "output-error") {
    return {
      label: getToolLabel(invocation.toolName),
      title: "Tool step failed",
      description: invocation.errorText ?? "The action did not complete.",
      meta: [] as string[],
      action: null as null | { href: string; label: string },
      tone: "error" as const,
    };
  }

  switch (invocation.toolName) {
    case "get_top_email_signals": {
      const emails = Array.isArray(result?.emails)
        ? (result?.emails as Record<string, unknown>[])
        : [];
      const topEmail =
        result?.topEmail && typeof result.topEmail === "object"
          ? (result.topEmail as Record<string, unknown>)
          : emails[0] ?? null;
      const limit =
        typeof input?.limit === "number" ? input.limit : undefined;

      if (invocation.state === "input-available" || invocation.state === "input-streaming") {
        return {
          label: "Reviewing emails",
          title: "Reviewing likely response-needed emails",
          description:
            limit && limit > 1
              ? `Scanning your top ${limit} likely response-needed emails.`
              : "Scanning your highest-priority email now.",
          meta: [] as string[],
          action: null,
          tone: "default" as const,
        };
      }

      if (!topEmail) {
        return {
          label: "Reviewing emails",
          title: "No clear top email found",
          description:
            typeof result?.message === "string"
              ? result.message
              : "I did not find a high-priority email that clearly needs a reply.",
          meta: [] as string[],
          action: null,
          tone: "default" as const,
        };
      }

      return {
        label: "Picked top email",
        title: String(topEmail.title ?? "Untitled email"),
        description:
          typeof result?.message === "string"
            ? result.message
            : typeof topEmail.snippet === "string"
              ? topEmail.snippet
              : null,
        meta: [
          topEmail.sender_name || topEmail.sender_email
            ? `From ${String(topEmail.sender_name ?? topEmail.sender_email)}`
            : null,
          typeof topEmail.urgency_score === "number"
            ? `Urgency ${Math.round(topEmail.urgency_score)}/100`
            : null,
        ].filter(Boolean) as string[],
        action: null,
        tone: "default" as const,
      };
    }

    case "draft_email": {
      if (invocation.state === "input-available" || invocation.state === "input-streaming") {
        return {
          label: "Drafting email",
          title: "Drafting your reply",
          description: "Zoe is turning the selected email into a reviewable draft.",
          meta: [] as string[],
          action: null,
          tone: "default" as const,
        };
      }

      if (result?.status === "draft_saved") {
        return {
          label: "Email draft ready",
          title: String(result.subject ?? "Draft saved"),
          description:
            typeof result.message === "string"
              ? result.message
              : "Review the draft before sending.",
          meta: [
            typeof result.to === "string" ? `To ${result.to}` : null,
          ].filter(Boolean) as string[],
          action: {
            href: withBasePath(
              typeof result.drafts_path === "string" ? result.drafts_path : "/drafts"
            ),
            label: "Open Drafts",
          },
          tone: "default" as const,
        };
      }

      break;
    }

    case "draft_slack_message": {
      if (invocation.state === "input-available" || invocation.state === "input-streaming") {
        return {
          label: "Drafting Slack message",
          title: "Drafting your Slack reply",
          description: "Zoe is preparing a Slack draft for review.",
          meta: [] as string[],
          action: null,
          tone: "default" as const,
        };
      }

      if (result?.status === "draft_saved") {
        return {
          label: "Slack draft ready",
          title: "Slack draft saved",
          description:
            typeof result.note === "string"
              ? result.note
              : "Review the Slack draft before sending.",
          meta: [
            typeof result.channel === "string" ? `Channel ${result.channel}` : null,
          ].filter(Boolean) as string[],
          action: {
            href: withBasePath("/drafts"),
            label: "Open Drafts",
          },
          tone: "default" as const,
        };
      }

      break;
    }
  }

  return {
    label: getToolLabel(invocation.toolName),
    title:
      typeof result?.message === "string"
        ? result.message
        : typeof result?.note === "string"
          ? result.note
          : typeof result?.error === "string"
            ? result.error
            : null,
    description: null as string | null,
    meta: [] as string[],
    action: null as null | { href: string; label: string },
    tone:
      typeof result?.error === "string" ? ("error" as const) : ("default" as const),
  };
}

function getToolLabel(toolName: string) {
  const toolLabels: Record<string, string> = {
    search_signals: "Searching signals",
    get_todays_meetings: "Getting today's meetings",
    get_top_activities: "Getting top activities",
    get_top_email_signals: "Reviewing emails",
    generate_meeting_brief: "Generating meeting brief",
    draft_email: "Drafting email",
    send_email: "Sending email",
    draft_slack_message: "Drafting Slack message",
    send_slack_message: "Sending Slack message",
  };

  return toolLabels[toolName] ?? toolName;
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
