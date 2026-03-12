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
import { useDraftContext, useUpdateDraft } from "@/hooks/use-drafts";

interface DraftReviewPanelProps {
  draft: DraftReply | null;
  open: boolean;
  onClose: () => void;
  onSend: (draft: DraftReply) => Promise<void>;
  isSending?: boolean;
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
  isSending = false,
}: DraftReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const updateDraft = useUpdateDraft();
  const { data: context } = useDraftContext(draft);

  if (!draft) return null;

  const warnings: string[] = [];
  const rationale: string[] = [];

  if (
    context?.recipientDomain &&
    context?.userDomain &&
    context.recipientDomain !== context.userDomain
  ) {
    warnings.push("Recipient is outside your primary email domain.");
  }

  if (draft.draftType === "follow_up") {
    warnings.push("Follow-up drafts can set expectations; review commitments before sending.");
  }

  if ((context?.signal?.urgencyScore ?? 0) >= 80) {
    rationale.push("Source signal was classified as high urgency.");
  }

  if (context?.signal?.requiresResponse) {
    rationale.push("Zoe classified the source as requiring a response.");
  }

  if (context?.activity?.triggerDescription) {
    rationale.push(context.activity.triggerDescription);
  }

  if (context?.meeting?.decisionDensity === "high") {
    rationale.push("Related meeting has high decision density.");
  }

  if (!rationale.length) {
    rationale.push(
      draft.draftType === "follow_up"
        ? "Zoe prepared this follow-up from your meeting context."
        : "Zoe prepared this reply from the linked message context."
    );
  }

  const handleEdit = () => {
    setEditedBody(draft.editedBody ?? draft.body);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateDraft.mutate(
      {
        id: draft.id,
        updates: {
          edited_body: editedBody,
          status: "edited",
          accepted_at: null,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success("Draft updated");
        },
      }
    );
  };

  const handleApprove = () => {
    updateDraft.mutate(
      {
        id: draft.id,
        updates: {
          status: "accepted",
          accepted_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast.success("Draft approved for send");
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

  const handleApproveAndSend = async () => {
    await onSend(draft);
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
          <div className="space-y-5 py-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Approval required
              </p>
              <p className="mt-2 text-sm text-foreground">
                Review recipient, context, and tone before sending. Zoe will not send this until you confirm.
              </p>
              {draft.acceptedAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Approved {new Date(draft.acceptedAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            {warnings.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Send warnings
                </p>
                <div className="flex flex-wrap gap-2">
                  {warnings.map((warning) => (
                    <span
                      key={warning}
                      className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs text-destructive"
                    >
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Recipient
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{draft.toEmail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tone: {draft.tone}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Source
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {context?.meeting?.title ??
                    context?.activity?.title ??
                    context?.signal?.title ??
                    "Linked work context"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.draftType === "follow_up" ? "Meeting follow-up" : "Message reply"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Why Zoe drafted this
              </p>
              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                {rationale.map((item) => (
                  <p key={item} className="text-sm text-foreground">
                    {item}
                  </p>
                ))}
              </div>
            </div>

            {context?.signal || context?.meeting || context?.activity ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Context
                </p>
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                  {context?.signal ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {context.signal.title ?? "Linked signal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        From {context.signal.senderName ?? context.signal.senderEmail ?? "unknown sender"}
                        {context.signal.receivedAt
                          ? ` · ${new Date(context.signal.receivedAt).toLocaleString()}`
                          : ""}
                      </p>
                      {context.signal.snippet ? (
                        <p className="text-sm text-muted-foreground">{context.signal.snippet}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {context?.meeting ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {context.meeting.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(context.meeting.startAt).toLocaleString()}
                        {context.meeting.decisionDensity
                          ? ` · ${context.meeting.decisionDensity} density`
                          : ""}
                        {context.meeting.ownershipLoad
                          ? ` · ${context.meeting.ownershipLoad}`
                          : ""}
                      </p>
                    </div>
                  ) : null}

                  {context?.activity ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {context.activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score {context.activity.score}
                        {context.activity.horizon ? ` · ${context.activity.horizon}` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Draft body
              </p>
              {isEditing ? (
                <Textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="min-h-[300px] resize-none font-sans text-sm leading-relaxed"
                />
              ) : (
                <div className="rounded-lg border border-border bg-card p-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {displayBody}
                </div>
              )}
            </div>
          </div>
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
                disabled={updateDraft.isPending || isSending || draft.status !== "accepted"}
              >
                {isSending ? "Sending..." : "Send approved draft"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleApprove}
                disabled={
                  updateDraft.isPending || isSending || draft.status === "accepted"
                }
              >
                {draft.status === "accepted" ? "Approved" : "Approve draft"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={handleDiscard}
                disabled={updateDraft.isPending || isSending}
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
