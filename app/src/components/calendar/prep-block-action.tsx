"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withBasePath } from "@/lib/base-path";
import type { CalendarEvent } from "@/domain/calendar";

interface PrepSlot {
  start: string;
  end: string;
}

function formatSlot(slot: PrepSlot): string {
  return `${new Date(slot.start).toLocaleString()} - ${new Date(slot.end).toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" }
  )}`;
}

export function PrepBlockAction({
  event,
  variant = "outline",
  size = "sm",
  label = "Block prep time",
  onCreated,
}: {
  event: CalendarEvent;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "default";
  label?: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<PrepSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PrepSlot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const needsPrep =
    (event.prepTimeNeededMinutes ?? 0) > 0 && !event.hasPrepBlock;

  const recommendedSlot = useMemo(
    () => selectedSlot ?? slots[0] ?? null,
    [selectedSlot, slots]
  );

  const loadProposal = async () => {
    if (!needsPrep) return;
    setOpen(true);
    setIsLoading(true);
    setError(null);
    setSelectedSlot(null);

    try {
      const response = await fetch(withBasePath("/api/calendar/prep-block/propose"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: event.id }),
      });

      const payload = (await response.json()) as {
        slots?: PrepSlot[];
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to find prep time.");
        setSlots([]);
        return;
      }

      setSlots(payload.slots ?? []);
      if (!(payload.slots ?? []).length) {
        setError("No available prep window was found before this meeting.");
      }
    } catch {
      setError("Failed to find prep time.");
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!recommendedSlot) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(withBasePath("/api/calendar/prep-block/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: event.id,
          start: recommendedSlot.start,
          end: recommendedSlot.end,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create prep block.");
        return;
      }

      toast.success("Prep block created in Google Calendar");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-stats"] }),
      ]);
      setOpen(false);
      onCreated?.();
    } catch {
      setError("Failed to create prep block.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!needsPrep) return null;

  return (
    <>
      <Button variant={variant} size={size} onClick={loadProposal}>
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block prep time</DialogTitle>
            <DialogDescription>
              Zoe will only create a prep block after you confirm an available slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Meeting starts {new Date(event.startAt).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Requested prep time: {event.prepTimeNeededMinutes ?? 15}m
              </p>
            </div>

            {isLoading ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Finding open prep slots before the meeting...
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : slots.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Available prep windows
                </p>
                <div className="space-y-2">
                  {slots.map((slot) => {
                    const isSelected =
                      (selectedSlot ?? slots[0])?.start === slot.start;

                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {formatSlot(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!recommendedSlot || isLoading || isCreating}
            >
              {isCreating ? "Creating..." : "Approve prep block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
