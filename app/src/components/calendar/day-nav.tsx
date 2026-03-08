"use client";

import { Button } from "@/components/ui/button";

interface DayNavProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

function formatDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function DayNav({ date, onDateChange }: DayNavProps) {
  const goTo = (offset: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + offset);
    onDateChange(next);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => goTo(-1)}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      <span className="min-w-[120px] text-center text-sm font-medium text-foreground">
        {formatDate(date)}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => goTo(1)}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-8 text-xs"
        onClick={goToToday}
      >
        Today
      </Button>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d="M10 4L6 8L10 12" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}
