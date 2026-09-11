import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyPayload, mergePayloads } from "@/lib/snapshot";
import type { BackupPayload } from "@/lib/types";

const KEY = "nels:snapshot";
const FILE = path.join(process.cwd(), ".data", "snapshot.json");

export type Snapshot = {
  revision: number;
  payload: BackupPayload;
};

function redisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function cloudStorageConfigured(): boolean {
  return Boolean(redisClient());
}

export function storageReady(): boolean {
  return cloudStorageConfigured() || process.env.NODE_ENV !== "production";
}

async function readFileSnapshot(): Promise<Snapshot> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed?.payload) return { revision: 0, payload: emptyPayload() };
    return parsed;
  } catch {
    return { revision: 0, payload: emptyPayload() };
  }
}

async function writeFileSnapshot(snapshot: Snapshot): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(snapshot), "utf8");
}

export async function loadSnapshot(): Promise<Snapshot> {
  const redis = redisClient();
  if (redis) {
    const stored = await redis.get<Snapshot>(KEY);
    if (!stored?.payload) return { revision: 0, payload: emptyPayload() };
    return stored;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Shared storage is not configured. Add Upstash Redis on Vercel.");
  }
  return readFileSnapshot();
}

export async function saveMerged(incoming: BackupPayload): Promise<Snapshot> {
  const current = await loadSnapshot();
  const payload = mergePayloads(current.payload, incoming);
  const snapshot: Snapshot = {
    revision: current.revision + 1,
    payload,
  };
  const redis = redisClient();
  if (redis) {
    await redis.set(KEY, snapshot);
    return snapshot;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Shared storage is not configured. Add Upstash Redis on Vercel.");
  }
  await writeFileSnapshot(snapshot);
  return snapshot;
}

export async function replaceSnapshot(incoming: BackupPayload): Promise<Snapshot> {
  const current = await loadSnapshot();
  const snapshot: Snapshot = {
    revision: current.revision + 1,
    payload: {
      ...incoming,
      version: 2,
      exportedAt: Date.now(),
      tombstones: incoming.tombstones ?? [],
    },
  };
  const redis = redisClient();
  if (redis) {
    await redis.set(KEY, snapshot);
    return snapshot;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Shared storage is not configured. Add Upstash Redis on Vercel.");
  }
  await writeFileSnapshot(snapshot);
  return snapshot;
}
