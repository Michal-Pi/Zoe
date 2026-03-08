"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { DraftReply } from "@/domain/drafts";
import { useUpdateDraft } from "@/hooks/use-drafts";

interface DraftReviewPanelProps {
  draft: DraftReply | null;
  open: boolean;
  onClose: () => void;
  onSend: (draft: DraftReply) => void;
}

const toneColors: Record<DraftReply["tone"], string> = {
  professional: "bg-primary/10 text-primary",
  casual: "bg-score-low/10 text-score-low",
  direct: "bg-score-medium/10 text-score-medium",
  empathetic: "bg-accent/10 text-accent",
};

export function DraftReviewPanel({
  draft,
  open,
  onClose,
  onSend,
}: DraftReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const updateDraft = useUpdateDraft();

  if (!draft) return null;

  const handleEdit = () => {
    setEditedBody(draft.editedBody ?? draft.body);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateDraft.mutate(
      { id: draft.id, updates: { edited_body: editedBody, status: "edited" } },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success("Draft updated");
        },
      }
    );
  };

  const handleDiscard = () => {
    updateDraft.mutate(
      {
        id: draft.id,
        updates: { status: "discarded", discarded_at: new Date().toISOString() },
      },
      {
        onSuccess: () => {
          onClose();
          toast("Draft discarded");
        },
      }
    );
  };

  const handleApproveAndSend = () => {
    onSend(draft);
  };

  const displayBody = isEditing ? editedBody : (draft.editedBody ?? draft.body);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn("text-xs", toneColors[draft.tone])}
            >
              {draft.tone}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {draft.draftType === "follow_up" ? "Follow-up" : "Reply"}
            </Badge>
          </div>
          <SheetTitle className="text-base">{draft.subject}</SheetTitle>
          <SheetDescription>
            To: {draft.toEmail}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-4">
          {isEditing ? (
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="min-h-[300px] resize-none font-sans text-sm leading-relaxed"
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {displayBody}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="flex items-center gap-2 px-4 pb-4">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateDraft.isPending}
              >
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleApproveAndSend}
                disabled={updateDraft.isPending}
              >
                Approve &amp; Send
              </Button>
              <Button size="sm" variant="outline" onClick={handleEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={handleDiscard}
                disabled={updateDraft.isPending}
              >
                Discard
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
