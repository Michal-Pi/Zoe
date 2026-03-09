"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DraftList } from "@/components/drafts/draft-list";
import { DraftReviewPanel } from "@/components/drafts/draft-review-panel";
import { useDrafts, useUpdateDraft } from "@/hooks/use-drafts";
import { toast } from "sonner";
import type { DraftReply } from "@/domain/drafts";
import { withBasePath } from "@/lib/base-path";

export default function DraftsPage() {
  const [selectedDraft, setSelectedDraft] = useState<DraftReply | null>(null);
  const [tab, setTab] = useState<"pending" | "sent" | "discarded">("pending");

  const { data: drafts, isLoading } = useDrafts(tab);
  const updateDraft = useUpdateDraft();

  const handleSend = async (draft: DraftReply) => {
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
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Smart Drafts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated email replies and follow-ups. Review, edit, and send.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
      >
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="discarded">Discarded</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <DraftList
              drafts={drafts ?? []}
              onSelect={setSelectedDraft}
              selectedId={selectedDraft?.id}
            />
          )}
        </TabsContent>
      </Tabs>

      <DraftReviewPanel
        draft={selectedDraft}
        open={selectedDraft !== null}
        onClose={() => setSelectedDraft(null)}
        onSend={handleSend}
      />
    </div>
  );
}
