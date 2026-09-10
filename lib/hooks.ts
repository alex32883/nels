"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { compareISODate, todayISO } from "@/lib/dates";
import type { CalendarEvent, Note, Task } from "@/lib/types";

export function useNotes(): Note[] | undefined {
  return useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray());
}

export function useNote(id: string | undefined): Note | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    return (await db.notes.get(id)) ?? null;
  }, [id]);
}

export function useTasks(): Task[] | undefined {
  return useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const due = compareISODate(a.dueDate, b.dueDate);
      if (due !== 0) return due;
      const rank = { high: 0, medium: 1, low: 2 };
      if (rank[a.priority] !== rank[b.priority]) {
        return rank[a.priority] - rank[b.priority];
      }
      return b.updatedAt - a.updatedAt;
    });
  });
}

export function useEvents(): CalendarEvent[] | undefined {
  return useLiveQuery(() => db.events.orderBy("date").toArray());
}

export function useEventsOn(date: string): CalendarEvent[] | undefined {
  return useLiveQuery(async () => {
    const events = await db.events.where("date").equals(date).toArray();
    return events.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });
  }, [date]);
}

export function useTodayAgenda(date = todayISO()) {
  return useLiveQuery(async () => {
    const [notes, tasks, events] = await Promise.all([
      db.notes.filter((note) => note.pinned).toArray(),
      db.tasks.toArray(),
      db.events.where("date").equals(date).toArray(),
    ]);

    const open = tasks.filter((task) => !task.completed);
    const overdue = open
      .filter((task) => task.dueDate && task.dueDate < date)
      .sort((a, b) => compareISODate(a.dueDate, b.dueDate));
    const dueToday = open.filter((task) => task.dueDate === date);
    const unscheduled = open.filter((task) => !task.dueDate).slice(0, 5);

    events.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

    return {
      pinnedNotes: notes.sort((a, b) => b.updatedAt - a.updatedAt),
      overdue,
      dueToday,
      unscheduled,
      events,
    };
  }, [date]);
}

export function useCounts() {
  return useLiveQuery(async () => ({
    notes: await db.notes.count(),
    tasks: await db.tasks.count(),
    openTasks: await db.tasks.filter((task) => !task.completed).count(),
    events: await db.events.count(),
  }));
}
