"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createNote } from "@/lib/db";
import { useNotes } from "@/lib/hooks";
import { matchesQuery } from "@/lib/markdown";
import { useToast } from "@/components/Toast";

export function NotesView() {
  const router = useRouter();
  const { push } = useToast();
  const notes = useNotes();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!notes) return [];
    return notes.filter((note) =>
      matchesQuery(`${note.title} ${note.body} ${note.tags.join(" ")}`, query),
    );
  }, [notes, query]);

  async function onNew() {
    const note = await createNote({ title: "Untitled" });
    push("New note");
    router.push(`/notes/${note.id}`);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm tracking-wide text-[var(--muted)] uppercase">Notes</p>
          <h1 className="font-serif text-4xl">Pages & scraps</h1>
        </div>
        <button type="button" onClick={onNew} className="btn-primary">
          New note
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search titles, tags, body…"
        className="mt-6 w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] px-4 py-3 outline-none focus:border-[var(--pine)]"
      />

      {!notes && <p className="mt-8 text-[var(--muted)]">Loading notes…</p>}

      {notes && filtered.length === 0 && (
        <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] p-8">
          <h2 className="font-serif text-2xl">No notes yet</h2>
          <p className="mt-2 text-[var(--muted)]">
            Try the command bar: <code className="text-[var(--ink)]">note #ideas weekend trip</code>
          </p>
        </div>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {filtered.map((note) => (
          <li key={note.id}>
            <Link
              href={`/notes/${note.id}`}
              className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-4 shadow-sm transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl">{note.title || "Untitled"}</h2>
                {note.pinned && (
                  <span className="text-xs tracking-wide text-[var(--copper)] uppercase">
                    Pin
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-[var(--muted)]">
                {note.body || "Empty"}
              </p>
              {note.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
