import type { BackupPayload, ItemKind, Tombstone } from "@/lib/types";

type Timed = { id: string; updatedAt: number };

export function emptyPayload(): BackupPayload {
  return {
    version: 2,
    exportedAt: Date.now(),
    notes: [],
    tasks: [],
    events: [],
    tombstones: [],
  };
}

function newer<T extends Timed>(left: T, right: T): T {
  return left.updatedAt >= right.updatedAt ? left : right;
}

function mergeById<T extends Timed>(left: T[], right: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of left) map.set(item.id, item);
  for (const item of right) {
    const current = map.get(item.id);
    map.set(item.id, current ? newer(current, item) : item);
  }
  return [...map.values()];
}

function mergeTombstones(left: Tombstone[] = [], right: Tombstone[] = []): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const item of [...left, ...right]) {
    const current = map.get(item.id);
    if (!current || item.deletedAt > current.deletedAt) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

function alive<T extends Timed>(items: T[], tombstones: Tombstone[], kind: ItemKind): T[] {
  const deleted = new Map(
    tombstones.filter((item) => item.kind === kind).map((item) => [item.id, item.deletedAt]),
  );
  return items.filter((item) => {
    const deletedAt = deleted.get(item.id);
    return deletedAt === undefined || item.updatedAt > deletedAt;
  });
}

export function mergePayloads(local: BackupPayload, remote: BackupPayload): BackupPayload {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const notes = alive(mergeById(local.notes, remote.notes), tombstones, "note");
  const tasks = alive(mergeById(local.tasks, remote.tasks), tombstones, "task");
  const events = alive(mergeById(local.events, remote.events), tombstones, "event");
  const liveIds = new Set([...notes, ...tasks, ...events].map((item) => item.id));
  return {
    version: 2,
    exportedAt: Math.max(local.exportedAt, remote.exportedAt, Date.now()),
    notes,
    tasks,
    events,
    tombstones: tombstones.filter((item) => !liveIds.has(item.id)),
  };
}

export function parseTombstone(value: unknown): Tombstone | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return undefined;
  if (record.kind !== "note" && record.kind !== "task" && record.kind !== "event") {
    return undefined;
  }
  if (typeof record.deletedAt !== "number") return undefined;
  return { id: record.id, kind: record.kind, deletedAt: record.deletedAt };
}
