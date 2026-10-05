"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { DropdownMenu } from "radix-ui";
import { LayoutDashboard, Users, ListTodo, Activity, CalendarOff, TrendingUp, MessageCircle, Settings, LogOut, CircleUserRound, ChevronDown } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export const NAV_ITEMS = [
  { href: "/", label: "Sprint Plan", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: Users },
  { href: "/sprint", label: "Backlog", icon: ListTodo },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/leave", label: "Leave & Holidays", icon: CalendarOff },
  { href: "/velocity-history", label: "Velocity History", icon: TrendingUp },
  { href: "/assistant", label: "Assistant", icon: MessageCircle },
];

const MENU_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-highlighted:bg-[color:var(--surface-glass-strong)] data-disabled:cursor-not-allowed data-disabled:opacity-50";

export function TopNav() {
  const pathname = usePathname();
  const [loggingOut, startLogout] = useTransition();
  const settingsActive = pathname.startsWith("/settings");

  return (
    <nav className="glass sticky top-0 z-10 mb-4">
      {/* No horizontal scroll: labels only from xl up, icon-only (with a
          tooltip + accessible name) below, and wrap as a last resort. */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
        <span className="mr-3 hidden shrink-0 font-heading text-base font-semibold tracking-tight text-foreground sm:inline">
          Sprint &amp; Velocity
        </span>
        <span aria-hidden="true" className="mr-2 hidden h-5 w-px shrink-0 bg-[color:var(--border-glass)] sm:inline" />
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-[color:var(--surface-glass)] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-[color:var(--surface-glass-strong)] hover:text-foreground"
              }`}
            >
              <item.icon aria-hidden="true" className={`size-4 ${active ? "text-[color:var(--accent-peach)]" : ""}`} />
              <span className="sr-only xl:not-sr-only">{item.label}</span>
            </Link>
          );
        })}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            title="Account"
            className={`ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-[color:var(--surface-glass)] ${
              settingsActive
                ? "bg-[color:var(--surface-glass)] font-medium text-foreground"
                : "text-muted-foreground hover:bg-[color:var(--surface-glass-strong)] hover:text-foreground"
            }`}
          >
            <CircleUserRound aria-hidden="true" className={`size-4 ${settingsActive ? "text-[color:var(--accent-peach)]" : ""}`} />
            <span className="sr-only">Account</span>
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 flex min-w-44 flex-col gap-0.5 rounded-xl border border-[color:var(--border-glass)] bg-[color:var(--surface-base)] p-1.5 shadow-[0_8px_24px_rgba(52,48,44,0.1)]"
            >
              <DropdownMenu.Item asChild className={MENU_ITEM}>
                <Link href="/settings" aria-current={settingsActive ? "page" : undefined}>
                  <Settings aria-hidden="true" className="size-4 text-muted-foreground" />
                  Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[color:var(--border-glass)]" />
              <DropdownMenu.Item
                disabled={loggingOut}
                onSelect={(event) => {
                  // Keep the menu open so "Logging out…" is visible until the redirect lands.
                  event.preventDefault();
                  startLogout(() => logoutAction());
                }}
                className={MENU_ITEM}
              >
                <LogOut aria-hidden="true" className="size-4 text-muted-foreground" />
                {loggingOut ? "Logging out…" : "Log out"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  );
}
