"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandBar } from "@/components/CommandBar";
import {
  IconCalendar,
  IconNotes,
  IconPlanner,
  IconSettings,
  IconTasks,
  IconToday,
} from "@/components/Icons";

const nav = [
  { href: "/", label: "Today", icon: IconToday },
  { href: "/notes", label: "Notes", icon: IconNotes },
  { href: "/tasks", label: "Tasks", icon: IconTasks },
  { href: "/calendar", label: "Calendar", icon: IconCalendar },
  { href: "/planner", label: "Planner", icon: IconPlanner },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <div className="flex min-h-dvh w-full">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-[var(--pine)] px-4 py-6 text-[#f4efe6] md:flex">
          <Link href="/" className="mb-8 px-2">
            <div className="font-serif text-3xl leading-none tracking-tight">Nels</div>
            <div className="mt-1 text-xs tracking-wide text-[#f4efe6]/70">
              Planner & notes
            </div>
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-white/12 text-white" : "text-[#f4efe6]/80 hover:bg-white/8"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/settings"
            className={`mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
              pathname.startsWith("/settings")
                ? "bg-white/12 text-white"
                : "text-[#f4efe6]/80 hover:bg-white/8"
            }`}
          >
            <IconSettings className="h-5 w-5" />
            Settings
          </Link>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="mb-3 flex items-center justify-between md:hidden">
              <Link href="/" className="font-serif text-2xl">
                Nels
              </Link>
              <Link
                href="/settings"
                className="rounded-full p-2 text-[var(--pine)]"
                aria-label="Settings"
              >
                <IconSettings className="h-5 w-5" />
              </Link>
            </div>
            <CommandBar />
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--paper-2)]/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                    active ? "text-[var(--pine)]" : "text-[var(--muted)]"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
