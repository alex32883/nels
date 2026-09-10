"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  addDaysISO,
  formatMonthYear,
  formatTime,
  formatWeekday,
  monthGrid,
  parseISODate,
  startOfMonth,
  todayISO,
} from "@/lib/dates";
import { createEvent, deleteEvent, updateEvent } from "@/lib/db";
import { useEvents } from "@/lib/hooks";
import type { CalendarEvent } from "@/lib/types";
import { useToast } from "@/components/Toast";

export function CalendarView() {
  const { push } = useToast();
  const today = todayISO();
  const [cursor, setCursor] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftAllDay, setDraftAllDay] = useState(true);
  const events = useEvents();

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return (a.startTime ?? "").localeCompare(b.startTime ?? "");
      });
    }
    return map;
  }, [events]);

  const selectedEvents = byDate.get(selected) ?? [];
  const inMonth = (iso: string) => parseISODate(iso).getMonth() === parseISODate(cursor).getMonth();

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!draftTitle.trim()) return;
    await createEvent({
      title: draftTitle,
      date: selected,
      allDay: draftAllDay,
      startTime: draftAllDay ? undefined : draftTime || undefined,
    });
    setDraftTitle("");
    setDraftTime("");
    setDraftAllDay(true);
    push("Event saved");
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Calendar</p>
          <h1 className="font-serif text-4xl">{formatMonthYear(cursor)}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setCursor(startOfMonth(addDaysISO(cursor, -1)))}
          >
            Prev
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setCursor(startOfMonth(today));
              setSelected(today);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setCursor(startOfMonth(addDaysISO(cursor, 32)))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper-2)]">
          <div className="grid grid-cols-7 border-b border-[var(--line)] text-center text-xs tracking-wide text-[var(--muted)] uppercase">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayEvents = byDate.get(day) ?? [];
              const isToday = day === today;
              const isSelected = day === selected;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={`min-h-24 border-t border-r border-[var(--line)] p-2 text-left last:border-r-0 ${
                    inMonth(day) ? "bg-[var(--paper-2)]" : "bg-[var(--paper)]/60 text-[var(--muted)]"
                  } ${isSelected ? "ring-2 ring-inset ring-[var(--pine)]" : ""}`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday ? "bg-[var(--pine)] text-[#f4efe6]" : ""
                    }`}
                  >
                    {parseISODate(day).getDate()}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((item) => (
                      <li
                        key={item.id}
                        className="truncate rounded bg-[var(--pine)]/10 px-1 text-[11px] text-[var(--pine)]"
                      >
                        {item.title}
                      </li>
                    ))}
                    {dayEvents.length > 3 && (
                      <li className="text-[11px] text-[var(--muted)]">+{dayEvents.length - 3}</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-5">
          <h2 className="font-serif text-2xl">
            {formatWeekday(selected)} {selected}
          </h2>
          <form onSubmit={onAdd} className="mt-4 space-y-2">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="New event"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draftAllDay}
                onChange={(event) => setDraftAllDay(event.target.checked)}
              />
              All day
            </label>
            {!draftAllDay && (
              <input
                type="time"
                value={draftTime}
                onChange={(event) => setDraftTime(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              />
            )}
            <button type="submit" className="btn-primary w-full">
              Add to this day
            </button>
          </form>

          <ul className="mt-5 space-y-2">
            {selectedEvents.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No events.</li>
            )}
            {selectedEvents.map((event) => (
              <li key={event.id} className="rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {event.allDay || !event.startTime ? "All day" : formatTime(event.startTime)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)]"
                    onClick={async () => {
                      await deleteEvent(event.id);
                      push("Event deleted");
                    }}
                  >
                    Delete
                  </button>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs text-[var(--pine)] underline"
                  onClick={() => setEditing(event)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>

          {editing && (
            <form
              className="mt-4 space-y-2 border-t border-[var(--line)] pt-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                await updateEvent(editing.id, {
                  title: String(form.get("title") || editing.title),
                  date: String(form.get("date") || editing.date),
                  notes: String(form.get("notes") || ""),
                  allDay: form.get("allDay") === "on",
                  startTime: form.get("allDay") === "on" ? undefined : String(form.get("time") || ""),
                });
                setEditing(null);
                push("Event updated");
              }}
            >
              <h3 className="font-serif text-lg">Edit event</h3>
              <input
                name="title"
                defaultValue={editing.title}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              />
              <input
                name="date"
                type="date"
                defaultValue={editing.date}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              />
              <label className="flex items-center gap-2 text-sm">
                <input name="allDay" type="checkbox" defaultChecked={editing.allDay} />
                All day
              </label>
              <input
                name="time"
                type="time"
                defaultValue={editing.startTime ?? ""}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              />
              <textarea
                name="notes"
                defaultValue={editing.notes}
                placeholder="Notes"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">
                  Save
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
