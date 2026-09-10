"use client";

import { useEffect, useRef, useState } from "react";
import { downloadJson, exportBackup, importBackup, parseBackup } from "@/lib/backup";
import { todayISO } from "@/lib/dates";
import { clearAllData } from "@/lib/db";
import { useCounts } from "@/lib/hooks";
import { COMMAND_HELP } from "@/lib/parse-command";
import { useToast } from "@/components/Toast";

export function SettingsView() {
  const { push } = useToast();
  const counts = useCounts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

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
    if (!confirm("Delete all notes, tasks, and events on this device?")) return;
    await clearAllData();
    push("All local data cleared");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Settings</p>
        <h1 className="font-serif text-4xl">This device</h1>
        <p className="mt-3 text-[var(--muted)]">
          Nels keeps your data in this browser (IndexedDB). Hosting on Vercel only serves the
          app. Export a backup if you switch machines.
        </p>
      </div>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Storage</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Notes" value={counts?.notes} />
          <Stat label="Tasks" value={counts?.tasks} />
          <Stat label="Open tasks" value={counts?.openTasks} />
          <Stat label="Events" value={counts?.events} />
        </dl>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Network: {online ? "online" : "offline — your local data still works"}
        </p>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
        <h2 className="font-serif text-2xl">Backup</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          JSON export/import. Merge keeps existing items and overwrites matching ids. Replace
          wipes this device first.
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
          Clear all data on this device
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
          <li>After that, Today, Notes, Tasks, Calendar, and Planner work without a network.</li>
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
