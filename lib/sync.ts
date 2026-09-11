import { applySnapshot } from "@/lib/db";
import { exportBackup } from "@/lib/backup";
import type { BackupPayload } from "@/lib/types";

type SyncResponse = {
  ok: boolean;
  payload?: BackupPayload;
  revision?: number;
  error?: string;
  storage?: "cloud" | "local-file";
};

let timer: number | undefined;
let inflight = false;
let queued = false;
let listeners = new Set<(status: "idle" | "syncing" | "error") => void>();
let status: "idle" | "syncing" | "error" = "idle";

function setStatus(next: "idle" | "syncing" | "error") {
  status = next;
  for (const listener of listeners) listener(next);
}

export function subscribeSync(listener: (status: "idle" | "syncing" | "error") => void) {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function scheduleSync() {
  if (typeof window === "undefined") return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void runSync();
  }, 600);
}

export async function runSync(mode: "merge" | "replace" = "merge"): Promise<SyncResponse | null> {
  if (typeof window === "undefined") return null;
  if (!navigator.onLine) return null;
  if (inflight) {
    queued = true;
    return null;
  }
  inflight = true;
  setStatus("syncing");
  try {
    const local = await exportBackup();
    const response = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, payload: local }),
    });
    const data = (await response.json()) as SyncResponse;
    if (!response.ok || !data.ok || !data.payload) {
      setStatus("error");
      return data;
    }
    await applySnapshot(data.payload);
    setStatus("idle");
    return data;
  } catch {
    setStatus("error");
    return { ok: false, error: "Could not sync." };
  } finally {
    inflight = false;
    if (queued) {
      queued = false;
      scheduleSync();
    }
  }
}
