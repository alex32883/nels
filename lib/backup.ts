import { clearAllData, db } from "@/lib/db";
import { parseTombstone } from "@/lib/snapshot";
import type { BackupPayload, CalendarEvent, Note, Task } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseNote(value: unknown): Note | undefined {
  if (!isRecord(value) || typeof value.id !== "string") return undefined;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Untitled",
    body: typeof value.body === "string" ? value.body : "",
    tags: asStringArray(value.tags),
    pinned: Boolean(value.pinned),
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

function parseTask(value: unknown): Task | undefined {
  if (!isRecord(value) || typeof value.id !== "string") return undefined;
  const priority =
    value.priority === "low" || value.priority === "high" || value.priority === "medium"
      ? value.priority
      : "medium";
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Untitled",
    notes: typeof value.notes === "string" ? value.notes : "",
    dueDate: typeof value.dueDate === "string" ? value.dueDate : undefined,
    priority,
    completed: Boolean(value.completed),
    completedAt: typeof value.completedAt === "number" ? value.completedAt : undefined,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

function parseEvent(value: unknown): CalendarEvent | undefined {
  if (!isRecord(value) || typeof value.id !== "string") return undefined;
  if (typeof value.date !== "string") return undefined;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Untitled",
    notes: typeof value.notes === "string" ? value.notes : "",
    date: value.date,
    startTime: typeof value.startTime === "string" ? value.startTime : undefined,
    endTime: typeof value.endTime === "string" ? value.endTime : undefined,
    allDay: Boolean(value.allDay),
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

export async function exportBackup(): Promise<BackupPayload> {
  const [notes, tasks, events, tombstones] = await Promise.all([
    db.notes.toArray(),
    db.tasks.toArray(),
    db.events.toArray(),
    db.tombstones.toArray(),
  ]);
  return {
    version: 2,
    exportedAt: Date.now(),
    notes,
    tasks,
    events,
    tombstones,
  };
}

export function parseBackup(raw: unknown): BackupPayload {
  if (!isRecord(raw)) {
    throw new Error("Backup file is not valid JSON.");
  }
  const notes = Array.isArray(raw.notes)
    ? raw.notes.map(parseNote).filter((item): item is Note => Boolean(item))
    : [];
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map(parseTask).filter((item): item is Task => Boolean(item))
    : [];
  const events = Array.isArray(raw.events)
    ? raw.events.map(parseEvent).filter((item): item is CalendarEvent => Boolean(item))
    : [];
  const tombstones = Array.isArray(raw.tombstones)
    ? raw.tombstones.map(parseTombstone).filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  if (notes.length + tasks.length + events.length === 0 && !Array.isArray(raw.notes)) {
    throw new Error("Backup has no notes, tasks, or events.");
  }
  return {
    version: 2,
    exportedAt: typeof raw.exportedAt === "number" ? raw.exportedAt : Date.now(),
    notes,
    tasks,
    events,
    tombstones,
  };
}

export async function importBackup(
  payload: BackupPayload,
  mode: "merge" | "replace",
): Promise<void> {
  if (mode === "replace") {
    await clearAllData({ sync: false });
  }
  await db.transaction("rw", db.notes, db.tasks, db.events, db.tombstones, async () => {
    await db.notes.bulkPut(payload.notes);
    await db.tasks.bulkPut(payload.tasks);
    await db.events.bulkPut(payload.events);
    if (payload.tombstones?.length) await db.tombstones.bulkPut(payload.tombstones);
    const liveIds = [
      ...payload.notes.map((item) => item.id),
      ...payload.tasks.map((item) => item.id),
      ...payload.events.map((item) => item.id),
    ];
    if (liveIds.length) await db.tombstones.bulkDelete(liveIds);
  });
  const { scheduleSync } = await import("@/lib/sync");
  scheduleSync();
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

