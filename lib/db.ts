import Dexie, { type Table } from "dexie";
import type { CalendarEvent, Note, Priority, Task } from "@/lib/types";

export class NelsDB extends Dexie {
  notes!: Table<Note, string>;
  tasks!: Table<Task, string>;
  events!: Table<CalendarEvent, string>;

  constructor() {
    super("nels");
    this.version(1).stores({
      notes: "id, updatedAt, pinned, *tags",
      tasks: "id, dueDate, completed, updatedAt, priority",
      events: "id, date, updatedAt",
    });
  }
}

export const db = new NelsDB();

export function now(): number {
  return Date.now();
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function createNote(input: {
  title?: string;
  body?: string;
  tags?: string[];
  pinned?: boolean;
}): Promise<Note> {
  const stamp = now();
  const note: Note = {
    id: newId(),
    title: input.title?.trim() || "Untitled",
    body: input.body ?? "",
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.notes.add(note);
  return note;
}

export async function updateNote(
  id: string,
  changes: Partial<Omit<Note, "id" | "createdAt">>,
): Promise<void> {
  await db.notes.update(id, { ...changes, updatedAt: now() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export async function createTask(input: {
  title: string;
  notes?: string;
  dueDate?: string;
  priority?: Priority;
}): Promise<Task> {
  const stamp = now();
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    notes: input.notes ?? "",
    dueDate: input.dueDate,
    priority: input.priority ?? "medium",
    completed: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.tasks.add(task);
  return task;
}

export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, "id" | "createdAt">>,
): Promise<void> {
  await db.tasks.update(id, { ...changes, updatedAt: now() });
}

export async function toggleTask(task: Task): Promise<void> {
  const completed = !task.completed;
  await updateTask(task.id, {
    completed,
    completedAt: completed ? now() : undefined,
  });
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

export async function createEvent(input: {
  title: string;
  notes?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}): Promise<CalendarEvent> {
  const stamp = now();
  const allDay = input.allDay ?? !input.startTime;
  const event: CalendarEvent = {
    id: newId(),
    title: input.title.trim(),
    notes: input.notes ?? "",
    date: input.date,
    startTime: allDay ? undefined : input.startTime,
    endTime: allDay ? undefined : input.endTime,
    allDay,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.events.add(event);
  return event;
}

export async function updateEvent(
  id: string,
  changes: Partial<Omit<CalendarEvent, "id" | "createdAt">>,
): Promise<void> {
  await db.events.update(id, { ...changes, updatedAt: now() });
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.delete(id);
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.notes, db.tasks, db.events, async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.events.clear();
  });
}
