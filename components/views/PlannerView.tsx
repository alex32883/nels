"use client";

import { useMemo, useState } from "react";
import {
  addDaysISO,
  daysInRange,
  formatShortDate,
  formatTime,
  startOfWeekSunday,
  todayISO,
} from "@/lib/dates";
import { createTask, toggleTask } from "@/lib/db";
import { useEvents, useTasks } from "@/lib/hooks";
import type { CalendarEvent, Task } from "@/lib/types";
import { useToast } from "@/components/Toast";

export function PlannerView() {
  const { push } = useToast();
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<"week" | "day">("week");
  const tasks = useTasks();
  const events = useEvents();
  const weekStart = startOfWeekSunday(anchor);
  const days = mode === "week" ? daysInRange(weekStart, 7) : [anchor];

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [tasks]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Planner</p>
          <h1 className="font-serif text-4xl">
            {mode === "week"
              ? `${formatShortDate(weekStart)} – ${formatShortDate(addDaysISO(weekStart, 6))}`
              : formatShortDate(anchor)}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${mode === "week" ? "bg-[var(--pine)] text-[#f4efe6]" : "btn-ghost"}`}
            onClick={() => setMode("week")}
          >
            Week
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${mode === "day" ? "bg-[var(--pine)] text-[#f4efe6]" : "btn-ghost"}`}
            onClick={() => setMode("day")}
          >
            Day
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setAnchor(addDaysISO(anchor, mode === "week" ? -7 : -1))
            }
          >
            Prev
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(today)}>
            Today
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setAnchor(addDaysISO(anchor, mode === "week" ? 7 : 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className={`mt-8 grid gap-3 ${mode === "week" ? "md:grid-cols-7" : ""}`}>
        {days.map((day) => {
          const dayTasks = (tasksByDate.get(day) ?? []).filter((task) => !task.completed);
          const dayEvents = eventsByDate.get(day) ?? [];
          return (
            <section
              key={day}
              className={`rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-4 ${
                day === today ? "ring-2 ring-[var(--pine)]" : ""
              }`}
            >
              <button
                type="button"
                className="mb-3 text-left"
                onClick={() => {
                  setAnchor(day);
                  setMode("day");
                }}
              >
                <div className="text-xs tracking-wide text-[var(--muted)] uppercase">
                  {formatShortDate(day)}
                </div>
              </button>

              <h3 className="text-xs tracking-wide text-[var(--copper)] uppercase">Events</h3>
              <ul className="mt-2 space-y-2">
                {dayEvents.length === 0 && (
                  <li className="text-sm text-[var(--muted)]">—</li>
                )}
                {dayEvents.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span className="text-[var(--muted)]">
                      {event.allDay || !event.startTime ? "All day" : formatTime(event.startTime)}{" "}
                    </span>
                    {event.title}
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 text-xs tracking-wide text-[var(--copper)] uppercase">Tasks</h3>
              <ul className="mt-2 space-y-2">
                {dayTasks.length === 0 && (
                  <li className="text-sm text-[var(--muted)]">—</li>
                )}
                {dayTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--pine)]"
                      checked={task.completed}
                      onChange={() => toggleTask(task)}
                    />
                    <span>{task.title}</span>
                  </li>
                ))}
              </ul>

              {mode === "day" && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const input = form.elements.namedItem("title") as HTMLInputElement;
                    if (!input.value.trim()) return;
                    await createTask({ title: input.value, dueDate: day });
                    input.value = "";
                    push("Task added to this day");
                  }}
                >
                  <input
                    name="title"
                    placeholder="Add a task for this day"
                    className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
                  />
                  <button type="submit" className="btn-primary">
                    Add
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
