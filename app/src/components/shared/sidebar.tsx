"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: DashboardIcon,
  },
  {
    label: "Command Center",
    href: "/command",
    icon: CommandIcon,
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: CalendarIcon,
  },
  {
    label: "Chat",
    href: "/chat",
    icon: ChatIcon,
  },
  {
    label: "Drafts",
    href: "/drafts",
    icon: DraftsIcon,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col border-r border-border bg-sidebar lg:w-56">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-3 lg:px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm">
            Z
          </div>
          <span className="hidden font-display text-lg font-semibold text-foreground lg:block">
            Zoe
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);

          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="hidden lg:block">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2 space-y-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <SettingsIcon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:block">Settings</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">
            Settings
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:block">Log out</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">
            Log out
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

// Inline SVG icons — minimal, clean line style

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="4" rx="1.5" />
      <rect x="2" y="11" width="7" height="4" rx="1.5" />
      <rect x="11" y="8" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CommandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" />
      <path d="M10 18V10" />
      <path d="M17 6L10 10L3 6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="15" height="14" rx="2" />
      <path d="M2.5 8H17.5" />
      <path d="M6.5 2V5" />
      <path d="M13.5 2V5" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4H16C17.1 4 18 4.9 18 6V12C18 13.1 17.1 14 16 14H6L2 18V6C2 4.9 2.9 4 4 4Z" />
      <path d="M7 8H13" />
      <path d="M7 11H11" />
    </svg>
  );
}

function DraftsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6C4.9 2 4 2.9 4 4V16C4 17.1 4.9 18 6 18H14C15.1 18 16 17.1 16 16V4C16 2.9 15.1 2 14 2Z" />
      <path d="M7 7H13" />
      <path d="M7 10H13" />
      <path d="M7 13H10" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17H4C3.45 17 3 16.55 3 16V4C3 3.45 3.45 3 4 3H7" />
      <path d="M14 14L18 10L14 6" />
      <path d="M18 10H7" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2V4.5M10 15.5V18M2 10H4.5M15.5 10H18M4.34 4.34L6.17 6.17M13.83 13.83L15.66 15.66M15.66 4.34L13.83 6.17M6.17 13.83L4.34 15.66" />
    </svg>
  );
}
