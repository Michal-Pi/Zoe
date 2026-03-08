"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DraftReply } from "@/domain/drafts";

interface DraftListProps {
  drafts: DraftReply[];
  onSelect: (draft: DraftReply) => void;
  selectedId?: string | null;
}

const typeLabels: Record<DraftReply["draftType"], string> = {
  reply: "Reply",
  follow_up: "Follow-up",
};

export function DraftList({ drafts, onSelect, selectedId }: DraftListProps) {
  if (!drafts.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="font-display text-lg font-medium text-foreground">
              No pending drafts
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Zoe will generate drafts for emails that need your response.
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
                  {draft.subject}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  To: {draft.toEmail}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {draft.editedBody ?? draft.body}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className="text-xs">
                  {typeLabels[draft.draftType]}
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
