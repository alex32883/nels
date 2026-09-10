"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteNote, updateNote } from "@/lib/db";
import { useNote } from "@/lib/hooks";
import { MarkdownLite } from "@/lib/markdown";
import type { Note } from "@/lib/types";
import { useToast } from "@/components/Toast";

export function NoteEditorView({ id }: { id: string }) {
  const note = useNote(id);

  if (note === undefined) {
    return <p className="text-[var(--muted)]">Opening note…</p>;
  }

  if (note === null) {
    return (
      <div>
        <p>That note is not on this device.</p>
        <Link href="/notes" className="mt-4 inline-block text-[var(--pine)] underline">
          Back to notes
        </Link>
      </div>
    );
  }

  return <NoteForm key={note.id} note={note} />;
}

function NoteForm({ note }: { note: Note }) {
  const router = useRouter();
  const { push } = useToast();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [preview, setPreview] = useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const parsedTags = tags
        .split(/[,\s]+/)
        .map((tag) => tag.replace(/^#/, "").toLowerCase())
        .filter(Boolean);
      void updateNote(note.id, { title: title.trim() || "Untitled", body, tags: parsedTags });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [title, body, tags, note.id]);

  async function onDelete() {
    if (!confirm("Delete this note?")) return;
    await deleteNote(note.id);
    push("Note deleted");
    router.push("/notes");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/notes" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          ← Notes
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void updateNote(note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)}>
            {preview ? "Edit" : "Preview"}
          </button>
          <button type="button" className="btn-ghost text-[var(--danger)]" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full bg-transparent font-serif text-4xl outline-none"
        placeholder="Title"
      />
      <input
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        className="mt-3 w-full bg-transparent text-sm text-[var(--muted)] outline-none"
        placeholder="tags, comma separated"
      />

      {preview ? (
        <div className="mt-8 rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
          <MarkdownLite text={body} />
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write in plain text. Use **bold**, lists, and # headings."
          className="mt-8 min-h-[50vh] w-full resize-y rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6 font-sans text-[16px] leading-7 outline-none focus:border-[var(--pine)]"
        />
      )}
    </div>
  );
}
