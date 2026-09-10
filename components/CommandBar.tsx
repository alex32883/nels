"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createEvent, createNote, createTask } from "@/lib/db";
import { COMMAND_HELP, parseCommand } from "@/lib/parse-command";
import { useToast } from "@/components/Toast";

export function CommandBar() {
  const router = useRouter();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCommand(value);
    if (parsed.type === "help") {
      push(COMMAND_HELP);
      return;
    }
    if (parsed.type === "error") {
      push(parsed.message, "err");
      return;
    }
    setBusy(true);
    try {
      if (parsed.type === "note") {
        const note = await createNote({
          title: parsed.title,
          tags: parsed.tags,
          body: parsed.body,
        });
        push(`Saved note “${note.title}”`);
        setValue("");
        router.push(`/notes/${note.id}`);
      } else if (parsed.type === "task") {
        const task = await createTask({
          title: parsed.title,
          dueDate: parsed.dueDate,
          priority: parsed.priority,
        });
        push(`Added task “${task.title}”`);
        setValue("");
        router.push("/tasks");
      } else {
        const calEvent = await createEvent({
          title: parsed.title,
          date: parsed.date,
          startTime: parsed.startTime,
          allDay: parsed.allDay,
        });
        push(`Added event “${calEvent.title}”`);
        setValue("");
        router.push("/calendar");
      }
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not save.", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <label htmlFor="nels-command" className="sr-only">
        Assistant command
      </label>
      <input
        id="nels-command"
        ref={inputRef}
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask Nels…  note, task, event, or remind me"
        className="w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] py-3 pr-16 pl-4 font-sans text-[15px] text-[var(--ink)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--pine)] focus:ring-2 focus:ring-[var(--pine)]/20"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-1.5 py-0.5 text-[11px] text-[var(--muted)] sm:inline">
        /
      </kbd>
    </form>
  );
}
