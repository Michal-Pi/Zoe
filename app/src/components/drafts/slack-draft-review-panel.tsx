"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SlackDraft } from "@/domain/drafts";
import { useUpdateSlackDraft } from "@/hooks/use-drafts";

interface SlackDraftReviewPanelProps {
  draft: SlackDraft | null;
  open: boolean;
  onClose: () => void;
  onSend: (draft: SlackDraft) => Promise<void>;
  isSending?: boolean;
}

export function SlackDraftReviewPanel({
  draft,
  open,
  onClose,
  onSend,
  isSending = false,
}: SlackDraftReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState("");
  const updateDraft = useUpdateSlackDraft();

  if (!draft) return null;

  const warnings = [
    draft.threadTs
      ? "Thread replies are safer than channel-wide posts, but still visible to thread participants."
      : "This will post directly into a Slack channel and may be seen by many people.",
  ];

  const rationale =
    draft.reviewMetadata?.rationale?.length
      ? draft.reviewMetadata.rationale
      : [
          draft.threadTs
            ? "Zoe prepared this as a thread reply that should be reviewed before posting."
            : "Zoe prepared this as a Slack message that should be reviewed before posting.",
        ];

  const displayMessage = isEditing ? editedMessage : draft.editedMessage ?? draft.message;

  const handleEdit = () => {
    setEditedMessage(draft.editedMessage ?? draft.message);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateDraft.mutate(
      {
        id: draft.id,
        updates: {
          edited_message: editedMessage,
          status: "edited",
          accepted_at: null,
          review_metadata: null,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success("Slack draft updated");
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
          review_metadata: {
            warnings,
            rationale,
            approvedBody: draft.editedMessage ?? draft.message,
          },
        },
      },
      {
        onSuccess: () => {
          toast.success("Slack draft approved for send");
        },
      }
    );
  };

  const handleDiscard = () => {
    updateDraft.mutate(
      {
        id: draft.id,
        updates: {
          status: "discarded",
          discarded_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          onClose();
          toast("Slack draft discarded");
        },
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Slack
            </Badge>
            {draft.threadTs ? (
              <Badge variant="secondary" className="text-xs">
                Thread reply
              </Badge>
            ) : null}
          </div>
          <SheetTitle className="text-base">
            {draft.channelLabel ?? draft.channelId}
          </SheetTitle>
          <SheetDescription>
            {draft.threadTs ? "Replying in thread" : "Posting a new Slack message"}
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
                Review channel visibility and wording before Zoe posts this Slack message.
              </p>
              {draft.acceptedAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Approved {new Date(draft.acceptedAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Send warnings
              </p>
              <div className="flex flex-wrap gap-2">
                {(draft.reviewMetadata?.warnings?.length
                  ? draft.reviewMetadata.warnings
                  : warnings
                ).map((warning) => (
                  <span
                    key={warning}
                    className="inline-flex items-center rounded-md bg-destructive/10 px-2.5 py-1 text-xs text-destructive"
                  >
                    {warning}
                  </span>
                ))}
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

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Message body
              </p>
              {isEditing ? (
                <Textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  className="min-h-[220px] resize-none text-sm leading-relaxed"
                />
              ) : (
                <div className="rounded-lg border border-border bg-card p-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {displayMessage}
                </div>
              )}
            </div>

            {draft.editedMessage && draft.editedMessage !== draft.message && !isEditing ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Edited vs original
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Original draft
                    </p>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {draft.message}
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      Current version
                    </p>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {draft.editedMessage}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex items-center gap-2 px-4 pb-4">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSaveEdit} disabled={updateDraft.isPending}>
                Save changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => onSend(draft)}
                disabled={updateDraft.isPending || isSending || draft.status !== "accepted"}
              >
                {isSending ? "Sending..." : "Send approved draft"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleApprove}
                disabled={updateDraft.isPending || isSending || draft.status === "accepted"}
              >
                {draft.status === "accepted" ? "Approved" : "Approve draft"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
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
