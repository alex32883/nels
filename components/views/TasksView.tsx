"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createTask, deleteTask, toggleTask, updateTask } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { useTasks } from "@/lib/hooks";
import type { Priority, Task } from "@/lib/types";
import { useToast } from "@/components/Toast";

type Filter = "open" | "done" | "all";

export function TasksView() {
  const { push } = useToast();
  const tasks = useTasks();
  const [filter, setFilter] = useState<Filter>("open");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [priority, setPriority] = useState<Priority>("medium");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!tasks) return [];
    if (filter === "open") return tasks.filter((task) => !task.completed);
    if (filter === "done") return tasks.filter((task) => task.completed);
    return tasks;
  }, [tasks, filter]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await createTask({ title, dueDate: dueDate || undefined, priority });
    setTitle("");
    push("Task added");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Tasks</p>
      <h1 className="font-serif text-4xl">What needs doing</h1>

      <form onSubmit={onAdd} className="mt-6 grid gap-3 rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>

      <div className="mt-6 flex gap-2">
        {(["open", "done", "all"] as Filter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${
              filter === item
                ? "bg-[var(--pine)] text-[#f4efe6]"
                : "bg-[var(--paper-2)] text-[var(--muted)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {!tasks && <p className="mt-8 text-[var(--muted)]">Loading tasks…</p>}

      {tasks && visible.length === 0 && (
        <p className="mt-8 text-[var(--muted)]">Nothing in this list.</p>
      )}

      <ul className="mt-6 space-y-2">
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            expanded={editing === task.id}
            onToggleExpand={() => setEditing(editing === task.id ? null : task.id)}
            onDelete={async () => {
              await deleteTask(task.id);
              push("Task deleted");
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onDelete,
}: {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task)}
          className="h-5 w-5 accent-[var(--pine)]"
          aria-label={`Complete ${task.title}`}
        />
        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <div className={task.completed ? "text-[var(--muted)] line-through" : ""}>
            {task.title}
          </div>
          <div className="mt-0.5 flex gap-3 text-xs text-[var(--muted)]">
            <span className="capitalize">{task.priority}</span>
            {task.dueDate && <span>{task.dueDate}</span>}
          </div>
        </button>
        <span className="priority-dot" data-p={task.priority} />
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-[var(--line)] px-4 py-3">
          <input
            defaultValue={task.title}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== task.title) void updateTask(task.id, { title: next });
            }}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
          />
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              defaultValue={task.dueDate ?? ""}
              onChange={(event) =>
                void updateTask(task.id, { dueDate: event.target.value || undefined })
              }
              className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
            />
            <select
              defaultValue={task.priority}
              onChange={(event) =>
                void updateTask(task.id, { priority: event.target.value as Priority })
              }
              className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <textarea
            defaultValue={task.notes}
            placeholder="Notes"
            onBlur={(event) => void updateTask(task.id, { notes: event.target.value })}
            className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
          />
          <button type="button" className="text-sm text-[var(--danger)]" onClick={onDelete}>
            Delete task
          </button>
        </div>
      )}
    </li>
  );
}
