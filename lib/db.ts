import Dexie, { type Table } from "dexie";
import type { CalendarEvent, ItemKind, Note, Priority, Task, Tombstone } from "@/lib/types";

export class NelsDB extends Dexie {
  notes!: Table<Note, string>;
  tasks!: Table<Task, string>;
  events!: Table<CalendarEvent, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super("nels");
    this.version(1).stores({
      notes: "id, updatedAt, pinned, *tags",
      tasks: "id, dueDate, completed, updatedAt, priority",
      events: "id, date, updatedAt",
    });
    this.version(2).stores({
      notes: "id, updatedAt, pinned, *tags",
      tasks: "id, dueDate, completed, updatedAt, priority",
      events: "id, date, updatedAt",
      tombstones: "id, kind, deletedAt",
    });
  }
}

export const db = new NelsDB();

function afterWrite() {
  if (typeof window === "undefined") return;
  void import("@/lib/sync").then((mod) => mod.scheduleSync());
}

export function now(): number {
  return Date.now();
}

export function newId(): string {
  return crypto.randomUUID();
}

async function rememberDelete(id: string, kind: ItemKind): Promise<void> {
  await db.tombstones.put({ id, kind, deletedAt: now() });
}

async function revive(id: string): Promise<void> {
  await db.tombstones.delete(id);
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
  afterWrite();
  return note;
}

export async function updateNote(
  id: string,
  changes: Partial<Omit<Note, "id" | "createdAt">>,
): Promise<void> {
  await db.notes.update(id, { ...changes, updatedAt: now() });
  afterWrite();
}

export async function deleteNote(id: string): Promise<void> {
  await db.transaction("rw", db.notes, db.tombstones, async () => {
    await db.notes.delete(id);
    await rememberDelete(id, "note");
  });
  afterWrite();
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
  afterWrite();
  return task;
}

export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, "id" | "createdAt">>,
): Promise<void> {
  await db.tasks.update(id, { ...changes, updatedAt: now() });
  afterWrite();
}

export async function toggleTask(task: Task): Promise<void> {
  const completed = !task.completed;
  await updateTask(task.id, {
    completed,
    completedAt: completed ? now() : undefined,
  });
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction("rw", db.tasks, db.tombstones, async () => {
    await db.tasks.delete(id);
    await rememberDelete(id, "task");
  });
  afterWrite();
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
  afterWrite();
  return event;
}

export async function updateEvent(
  id: string,
  changes: Partial<Omit<CalendarEvent, "id" | "createdAt">>,
): Promise<void> {
  await db.events.update(id, { ...changes, updatedAt: now() });
  afterWrite();
}

export async function deleteEvent(id: string): Promise<void> {
  await db.transaction("rw", db.events, db.tombstones, async () => {
    await db.events.delete(id);
    await rememberDelete(id, "event");
  });
  afterWrite();
}

export async function clearAllData(options?: { sync?: boolean }): Promise<void> {
  await db.transaction("rw", db.notes, db.tasks, db.events, db.tombstones, async () => {
    const [notes, tasks, events] = await Promise.all([
      db.notes.toArray(),
      db.tasks.toArray(),
      db.events.toArray(),
    ]);
    const stamp = now();
    await db.tombstones.bulkPut([
      ...notes.map((item) => ({ id: item.id, kind: "note" as const, deletedAt: stamp })),
      ...tasks.map((item) => ({ id: item.id, kind: "task" as const, deletedAt: stamp })),
      ...events.map((item) => ({ id: item.id, kind: "event" as const, deletedAt: stamp })),
    ]);
    await db.notes.clear();
    await db.tasks.clear();
    await db.events.clear();
  });
  if (options?.sync !== false) afterWrite();
}

export async function applySnapshot(payload: {
  notes: Note[];
  tasks: Task[];
  events: CalendarEvent[];
  tombstones?: Tombstone[];
}): Promise<void> {
  await db.transaction("rw", db.notes, db.tasks, db.events, db.tombstones, async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.events.clear();
    await db.tombstones.clear();
    if (payload.notes.length) await db.notes.bulkPut(payload.notes);
    if (payload.tasks.length) await db.tasks.bulkPut(payload.tasks);
    if (payload.events.length) await db.events.bulkPut(payload.events);
    if (payload.tombstones?.length) await db.tombstones.bulkPut(payload.tombstones);
  });
}

