"use client";

import Link from "next/link";
import { formatLongDate, formatTime, todayISO } from "@/lib/dates";
import { useTodayAgenda } from "@/lib/hooks";

export function TodayView() {
  const today = todayISO();
  const agenda = useTodayAgenda(today);

  if (!agenda) {
    return <p className="text-[var(--muted)]">Loading your day…</p>;
  }

  const empty =
    !agenda.overdue.length &&
    !agenda.dueToday.length &&
    !agenda.events.length &&
    !agenda.pinnedNotes.length &&
    !agenda.unscheduled.length;

  return (
    <div className="max-w-3xl">
      <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Today</p>
      <h1 className="font-serif text-4xl tracking-tight text-[var(--ink)] md:text-5xl">
        {formatLongDate(today)}
      </h1>
      <p className="mt-3 max-w-xl text-[var(--muted)]">
        Press <kbd className="rounded border border-[var(--line)] px-1">/</kbd> and type{" "}
        <span className="italic">note</span>, <span className="italic">task</span>, or{" "}
        <span className="italic">event</span>.
      </p>

      {empty && (
        <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] bg-[var(--paper-2)] p-8">
          <h2 className="font-serif text-2xl">A quiet start</h2>
          <p className="mt-2 text-[var(--muted)]">
            Nothing is due yet. Add a task for today, pin a note, or put something on the
            calendar.
          </p>
        </div>
      )}

      <div className="mt-10 space-y-10">
        {agenda.overdue.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl text-[var(--copper)]">Overdue</h2>
            <ul className="space-y-2">
              {agenda.overdue.map((task) => (
                <li key={task.id}>
                  <Link href="/tasks" className="card-row">
                    <span className="priority-dot" data-p={task.priority} />
                    <span>{task.title}</span>
                    <span className="ml-auto text-sm text-[var(--muted)]">{task.dueDate}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {agenda.dueToday.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl">Due today</h2>
            <ul className="space-y-2">
              {agenda.dueToday.map((task) => (
                <li key={task.id}>
                  <Link href="/tasks" className="card-row">
                    <span className="priority-dot" data-p={task.priority} />
                    <span>{task.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {agenda.events.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl">On the calendar</h2>
            <ul className="space-y-2">
              {agenda.events.map((event) => (
                <li key={event.id}>
                  <Link href="/calendar" className="card-row">
                    <span className="w-20 shrink-0 text-sm text-[var(--copper)]">
                      {event.allDay || !event.startTime ? "All day" : formatTime(event.startTime)}
                    </span>
                    <span>{event.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {agenda.pinnedNotes.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl">Pinned notes</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {agenda.pinnedNotes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/notes/${note.id}`}
                    className="block rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-4 shadow-sm"
                  >
                    <div className="font-serif text-xl">{note.title}</div>
                    <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">
                      {note.body || "No body yet"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {agenda.unscheduled.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl">Open tasks</h2>
            <ul className="space-y-2">
              {agenda.unscheduled.map((task) => (
                <li key={task.id}>
                  <Link href="/tasks" className="card-row">
                    <span className="priority-dot" data-p={task.priority} />
                    <span>{task.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
