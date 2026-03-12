"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SlackDraft } from "@/domain/drafts";

interface SlackDraftListProps {
  drafts: SlackDraft[];
  onSelect: (draft: SlackDraft) => void;
  selectedId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

const statusLabels: Record<SlackDraft["status"], string> = {
  pending: "Needs review",
  edited: "Edited",
  accepted: "Approved",
  sent: "Sent",
  discarded: "Discarded",
};

export function SlackDraftList({
  drafts,
  onSelect,
  selectedId,
  emptyTitle = "No Slack drafts in this view",
  emptyDescription = "Zoe will place Slack drafts here when they are ready for review.",
}: SlackDraftListProps) {
  if (!drafts.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="font-display text-lg font-medium text-foreground">
              {emptyTitle}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <Card
          key={draft.id}
          className={cn(
            "cursor-pointer transition-all duration-150 hover:shadow-md",
            selectedId === draft.id && "border-primary/30 shadow-md"
          )}
          onClick={() => onSelect(draft)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {draft.channelLabel ?? draft.channelId}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {draft.threadTs ? "Thread reply" : "New Slack message"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {draft.editedMessage ?? draft.message}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className="text-xs">
                  Slack
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {statusLabels[draft.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(draft.createdAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
