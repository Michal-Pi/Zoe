"use client";

import Link from "next/link";
import type { DraftSuggestion } from "@/domain/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { withBasePath } from "@/lib/base-path";

interface DraftSuggestionsSectionProps {
  suggestions: DraftSuggestion[];
  loading?: boolean;
  hasEmail: boolean;
}

export function DraftSuggestionsSection({
  suggestions,
  loading,
  hasEmail,
}: DraftSuggestionsSectionProps) {
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Needs Reply
        </h2>
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <Card key={item}>
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (!hasEmail) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Needs Reply
        </h2>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Connect Google to see the most important emails worth drafting.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!suggestions.length) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Needs Reply
        </h2>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Zoe has not found any clear reply-worthy emails right now.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Needs Reply
        </h2>
        <p className="text-sm text-muted-foreground">
          Draft only when you choose to. These are the highest-priority emails Zoe thinks deserve attention.
        </p>
      </div>
      <div className="space-y-3">
        {suggestions.map((suggestion, index) => {
          const sender = suggestion.senderName ?? suggestion.senderEmail ?? "Unknown sender";
          const prompt = `Draft a reply to this email: "${suggestion.title ?? "(no subject)"}" from ${sender}. Signal ID: ${suggestion.id}`;
          return (
            <Card key={suggestion.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {suggestion.title ?? "(no subject)"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      From {sender}
                      {suggestion.receivedAt
                        ? ` · ${new Date(suggestion.receivedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="font-mono text-sm text-foreground">
                      {suggestion.urgencyScore != null
                        ? Math.round(suggestion.urgencyScore)
                        : "--"}
                    </p>
                  </div>
                </div>
                {suggestion.snippet ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {suggestion.snippet}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={withBasePath(`/chat?prompt=${encodeURIComponent(prompt)}`)}>
                      Draft in Chat
                    </Link>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
