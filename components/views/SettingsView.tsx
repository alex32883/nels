"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { downloadJson, exportBackup, importBackup, parseBackup } from "@/lib/backup";
import { todayISO } from "@/lib/dates";
import { clearAllData } from "@/lib/db";
import { useCounts } from "@/lib/hooks";
import { COMMAND_HELP } from "@/lib/parse-command";
import { runSync, subscribeSync } from "@/lib/sync";
import { useToast } from "@/components/Toast";

export function SettingsView() {
  const router = useRouter();
  const { push } = useToast();
  const counts = useCounts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [cloud, setCloud] = useState<boolean | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => subscribeSync(setSyncState), []);

  useEffect(() => {
    void fetch("/api/status")
      .then((response) => response.json())
      .then((data: { storageConfigured?: boolean }) => {
        setCloud(Boolean(data.storageConfigured));
      })
      .catch(() => setCloud(false));
  }, []);

  async function onExport() {
    const backup = await exportBackup();
    downloadJson(`nels-backup-${todayISO()}.json`, backup);
    push("Backup downloaded");
  }

  async function onImport(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      const payload = parseBackup(raw);
      await importBackup(payload, mode);
      push(
        `Imported ${payload.notes.length} notes, ${payload.tasks.length} tasks, ${payload.events.length} events`,
      );
    } catch (error) {
      push(error instanceof Error ? error.message : "Import failed", "err");
    }
  }

  async function onClear() {
    if (
      !confirm(
        "Delete all notes, tasks, and events? This clears this device and, once synced, the shared list on other devices too.",
      )
    ) {
      return;
    }
    await clearAllData();
    push("All data cleared");
  }

  async function onSyncNow() {
    const result = await runSync();
    if (result?.ok) push("Synced");
    else push(result?.error || "Sync failed", "err");
  }

  async function onLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const syncLabel =
    syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Settings</p>
        <h1 className="font-serif text-4xl">Account & data</h1>
        <p className="mt-3 text-[var(--muted)]">
          After you sign in, Nels keeps a local copy for offline use and syncs the same notes,
          tasks, and events to every device that opens this site.
        </p>
      </div>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Sync</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Status: {syncLabel}. Network: {online ? "online" : "offline — local data still works"}.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Shared cloud store:{" "}
          {cloud === null ? "…" : cloud ? "connected" : "not set (local file only until Redis is added on Vercel)"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void onSyncNow()}>
            Sync now
          </button>
          <button type="button" className="btn-ghost" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Storage</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Notes" value={counts?.notes} />
          <Stat label="Tasks" value={counts?.tasks} />
          <Stat label="Open tasks" value={counts?.openTasks} />
          <Stat label="Events" value={counts?.events} />
        </dl>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Backup</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          JSON export/import. Merge keeps existing items and overwrites matching ids. Replace
          wipes this device first, then syncs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={onExport}>
            Export JSON
          </button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
            />
            Merge
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            Replace
          </label>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onImport(file);
            event.target.value = "";
          }}
        />
        <button type="button" className="mt-6 text-sm text-[var(--danger)]" onClick={onClear}>
          Clear all data
        </button>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Install & offline</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
          <li>Open Nels once while online so the app shell can cache.</li>
          <li>
            In Chrome or Edge: install from the address bar. On iPhone: Share → Add to Home
            Screen.
          </li>
          <li>Edits made offline upload the next time this device is online.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Assistant</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{COMMAND_HELP}</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl bg-[var(--paper)] px-3 py-3">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-serif text-2xl">{value ?? "—"}</dd>
    </div>
  );
}
