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
  const fallbackContent =
    !isUser && !content.trim()
      ? buildFallbackAssistantText(toolInvocations)
      : null;
  const displayContent = content || fallbackContent || "";

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

        {displayContent && (
          <div
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            <div className="whitespace-pre-wrap prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{displayContent}</div>
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
          {presentation.preview ? (
            presentation.previewKind === "email" ? (
              <EmailDraftPreviewCard
                subject={presentation.title}
                to={presentation.meta.find((item) => item.startsWith("To ")) ?? null}
                body={presentation.preview}
              />
            ) : (
              <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Draft preview
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                  {presentation.preview}
                </p>
              </div>
            )
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
      preview: null as string | null,
      previewKind: null as null | "email" | "text",
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
          preview: null,
          previewKind: null,
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
          preview: null,
          previewKind: null,
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
        preview: null,
        previewKind: null,
        tone: "default" as const,
      };
    }

    case "get_email_thread_context": {
      const signal =
        result?.signal && typeof result.signal === "object"
          ? (result.signal as Record<string, unknown>)
          : null;
      const relatedSignals = Array.isArray(result?.relatedSignals)
        ? (result.relatedSignals as Record<string, unknown>[])
        : [];

      if (invocation.state === "input-available" || invocation.state === "input-streaming") {
        return {
          label: "Reviewing thread context",
          title: "Pulling email thread context",
          description: "Zoe is reviewing the selected email and nearby thread messages.",
          meta: [] as string[],
          action: null,
          preview: null,
          previewKind: null,
          tone: "default" as const,
        };
      }

      if (!signal) {
        return {
          label: "Reviewing thread context",
          title: "Thread context unavailable",
          description:
            typeof result?.error === "string"
              ? result.error
              : "I could not load enough thread context for this email.",
          meta: [] as string[],
          action: null,
          preview: null,
          previewKind: null,
          tone: typeof result?.error === "string" ? ("error" as const) : ("default" as const),
        };
      }

      return {
        label: "Reviewed thread context",
        title: String(signal.title ?? "Selected email"),
        description:
          typeof result?.message === "string"
            ? result.message
            : typeof signal.snippet === "string"
              ? signal.snippet
              : null,
        meta: [
          signal.sender_name || signal.sender_email
            ? `From ${String(signal.sender_name ?? signal.sender_email)}`
            : null,
          relatedSignals.length > 0 ? `${relatedSignals.length} related thread emails` : null,
        ].filter(Boolean) as string[],
        action: null,
        preview: typeof signal.body === "string" ? signal.body.slice(0, 240) : null,
        previewKind: "text" as const,
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
          preview: null,
          previewKind: null,
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
          preview: typeof result.body_preview === "string" ? result.body_preview : null,
          previewKind: "email" as const,
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
          preview: null,
          previewKind: null,
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
          preview: typeof result.message === "string" ? result.message.slice(0, 240) : null,
          previewKind: "text" as const,
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
    preview: null as string | null,
    previewKind: null as null | "email" | "text",
    tone:
      typeof result?.error === "string" ? ("error" as const) : ("default" as const),
  };
}

function buildFallbackAssistantText(
  toolInvocations:
    | {
        toolName: string;
        state: string;
        input?: unknown;
        result?: unknown;
        errorText?: string;
      }[]
    | undefined
) {
  if (!toolInvocations?.length) return null;

  const lastCompleted = [...toolInvocations]
    .reverse()
    .find(
      (invocation) =>
        invocation.state === "output-available" ||
        invocation.state === "output-error"
    );

  if (!lastCompleted) return null;

  const result =
    lastCompleted.result && typeof lastCompleted.result === "object"
      ? (lastCompleted.result as Record<string, unknown>)
      : null;

  if (lastCompleted.toolName === "draft_email" && result?.status === "draft_saved") {
    const subject =
      typeof result.subject === "string" ? result.subject : "your draft";
    return `I saved a draft reply for "${subject}" in Drafts. Review it before sending.`;
  }

  if (
    lastCompleted.toolName === "draft_slack_message" &&
    result?.status === "draft_saved"
  ) {
    return "I saved a Slack draft in Drafts. Review it before sending.";
  }

  if (typeof result?.message === "string") return result.message;
  if (typeof result?.note === "string") return result.note;
  if (typeof result?.error === "string") return result.error;
  if (lastCompleted.errorText) return lastCompleted.errorText;

  return null;
}

function EmailDraftPreviewCard({
  subject,
  to,
  body,
}: {
  subject: string | null;
  to: string | null;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3 shadow-sm">
      <div className="space-y-1 border-b border-border/60 pb-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Draft email
        </p>
        <p className="text-sm font-medium text-foreground">
          {subject || "Untitled draft"}
        </p>
        {to ? <p className="text-xs text-muted-foreground">{to}</p> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">{body}</p>
    </div>
  );
}

function getToolLabel(toolName: string) {
  const toolLabels: Record<string, string> = {
    search_signals: "Searching signals",
    get_todays_meetings: "Getting today's meetings",
    get_top_activities: "Getting top activities",
    get_top_email_signals: "Reviewing emails",
    get_email_thread_context: "Reviewing thread context",
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
