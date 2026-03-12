"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DraftList } from "@/components/drafts/draft-list";
import { DraftReviewPanel } from "@/components/drafts/draft-review-panel";
import { SlackDraftList } from "@/components/drafts/slack-draft-list";
import { SlackDraftReviewPanel } from "@/components/drafts/slack-draft-review-panel";
import { useDrafts, useSlackDrafts, useUpdateDraft } from "@/hooks/use-drafts";
import { toast } from "sonner";
import type { DraftReply, SlackDraft } from "@/domain/drafts";
import { withBasePath } from "@/lib/base-path";

export default function DraftsPage() {
  const [selectedDraft, setSelectedDraft] = useState<DraftReply | null>(null);
  const [selectedSlackDraft, setSelectedSlackDraft] = useState<SlackDraft | null>(null);
  const [channel, setChannel] = useState<"email" | "slack">("email");
  const [tab, setTab] = useState<"review" | "approved" | "sent" | "discarded">(
    "review"
  );
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [sendingSlackDraftId, setSendingSlackDraftId] = useState<string | null>(null);

  const { data: drafts, isLoading } = useDrafts(tab);
  const { data: slackDrafts, isLoading: slackDraftsLoading } = useSlackDrafts(tab);
  const updateDraft = useUpdateDraft();
  const queryClient = useQueryClient();

  const emptyStateCopy: Record<
    typeof tab,
    { title: string; description: string }
  > = {
    review: {
      title: "No drafts need review",
      description: "Zoe will place new or edited drafts here until you approve them.",
    },
    approved: {
      title: "No approved drafts",
      description: "Approve a draft first, then it will move here until you send it.",
    },
    sent: {
      title: "No sent drafts yet",
      description: "Approved drafts you send from Zoe will appear here.",
    },
    discarded: {
      title: "No discarded drafts",
      description: "Discarded drafts stay here as a record of what you chose not to send.",
    },
  };

  const handleSendSlack = async (draft: SlackDraft) => {
    setSendingSlackDraftId(draft.id);
    try {
      const res = await fetch(withBasePath("/api/drafts/send-slack"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          channel: draft.channelId,
          message: draft.editedMessage ?? draft.message,
          threadTs: draft.threadTs,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Failed to send Slack draft");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["slack-drafts"] });
      setSelectedSlackDraft(null);
      toast.success("Slack message sent");
    } catch {
      toast.error("Failed to send Slack message");
    } finally {
      setSendingSlackDraftId(null);
    }
  };
  const activeLoading = channel === "email" ? isLoading : slackDraftsLoading;

  const handleSend = async (draft: DraftReply) => {
    setSendingDraftId(draft.id);
    try {
      const res = await fetch(withBasePath("/api/drafts/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          to: draft.toEmail,
          subject: draft.subject,
          body: draft.editedBody ?? draft.body,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Failed to send");
        return;
      }

      updateDraft.mutate({
        id: draft.id,
        updates: { status: "sent", sent_at: new Date().toISOString() },
      });

      setSelectedDraft(null);
      toast.success("Email sent");
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingDraftId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Smart Drafts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve Zoe&apos;s outbound drafts before anything gets sent.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setChannel("email")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            channel === "email"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setChannel("slack")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            channel === "slack"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          Slack
        </button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
      >
        <TabsList>
          <TabsTrigger value="review">Needs review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="discarded">Discarded</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {activeLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {channel === "email" ? (
                <DraftList
                  drafts={drafts ?? []}
                  onSelect={(draft) => {
                    setSelectedSlackDraft(null);
                    setSelectedDraft(draft);
                  }}
                  selectedId={selectedDraft?.id}
                  emptyTitle={emptyStateCopy[tab].title}
                  emptyDescription={emptyStateCopy[tab].description}
                />
              ) : (
                <SlackDraftList
                  drafts={slackDrafts ?? []}
                  onSelect={(draft) => {
                    setSelectedDraft(null);
                    setSelectedSlackDraft(draft);
                  }}
                  selectedId={selectedSlackDraft?.id}
                  emptyTitle={`No Slack drafts ${tab === "review" ? "need review" : `in ${tab}`}`}
                  emptyDescription="Slack drafts saved from chat will appear here for approval before sending."
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <DraftReviewPanel
        draft={selectedDraft}
        open={selectedDraft !== null}
        onClose={() => setSelectedDraft(null)}
        onSend={handleSend}
        isSending={sendingDraftId === selectedDraft?.id}
      />
      <SlackDraftReviewPanel
        draft={selectedSlackDraft}
        open={selectedSlackDraft !== null}
        onClose={() => setSelectedSlackDraft(null)}
        onSend={handleSendSlack}
        isSending={sendingSlackDraftId === selectedSlackDraft?.id}
      />
    </div>
  );
}
