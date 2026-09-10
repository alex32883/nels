import { extractDate, extractTime, todayISO } from "@/lib/dates";
import type { Priority } from "@/lib/types";

export type CommandResult =
  | { type: "note"; title: string; tags: string[]; body: string }
  | { type: "task"; title: string; dueDate?: string; priority: Priority }
  | { type: "event"; title: string; date: string; startTime?: string; allDay: boolean }
  | { type: "help" }
  | { type: "error"; message: string };

const HELP =
  "Try: note buy milk  ·  task submit report friday  ·  event dentist tomorrow 3pm  ·  remind me tomorrow to call Jan";

function takeTags(text: string): { tags: string[]; rest: string } {
  const tags: string[] = [];
  const rest = text
    .replace(/(^|\s)#([a-z0-9_-]+)/gi, (_, space: string, tag: string) => {
      tags.push(tag.toLowerCase());
      return space;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { tags, rest };
}

function takePriority(text: string): { priority: Priority; rest: string } {
  const bang = text.match(/^\s*(!{1,3})\s+/);
  if (bang) {
    const priority: Priority =
      bang[1].length >= 3 ? "high" : bang[1].length === 2 ? "medium" : "low";
    return { priority, rest: text.slice(bang[0].length).trim() };
  }
  const word = text.match(/^\s*(p[123]|high|medium|low)\b[:\s-]*/i);
  if (word) {
    const token = word[1].toLowerCase();
    const priority: Priority =
      token === "p1" || token === "high"
        ? "high"
        : token === "p3" || token === "low"
          ? "low"
          : "medium";
    return { priority, rest: text.slice(word[0].length).trim() };
  }
  return { priority: "medium", rest: text.trim() };
}

function cleanTitle(text: string): string {
  return text.replace(/^to\s+/i, "").replace(/\s+/g, " ").trim();
}

export function parseCommand(input: string, now = new Date()): CommandResult {
  const raw = input.trim();
  if (!raw) return { type: "error", message: "Type a command, or help." };

  if (/^(help|\?)$/i.test(raw)) return { type: "help" };

  const remind = raw.match(/^(?:remind(?:er)?(?:\s+me)?)\s+(.+)$/i);
  if (remind) {
    const dated = extractDate(remind[1], now);
    const title = cleanTitle(dated.rest);
    if (!title) {
      return { type: "error", message: "What should I remind you about?" };
    }
    return { type: "task", title, dueDate: dated.date ?? todayISO(now), priority: "medium" };
  }

  const noteMatch = raw.match(/^(?:note|notes|n)\s*[:.]?\s+(.+)$/i);
  if (noteMatch) {
    const tagged = takeTags(noteMatch[1]);
    const title = tagged.rest || tagged.tags.map((tag) => `#${tag}`).join(" ");
    if (!title) return { type: "error", message: "Give the note a title." };
    return { type: "note", title, tags: tagged.tags, body: "" };
  }

  const taskMatch = raw.match(/^(?:task|todo|todos|t)\s*[:.]?\s+(.+)$/i);
  if (taskMatch) {
    const prioritized = takePriority(taskMatch[1]);
    const dated = extractDate(prioritized.rest, now);
    const title = cleanTitle(dated.rest);
    if (!title) return { type: "error", message: "Give the task a title." };
    return {
      type: "task",
      title,
      dueDate: dated.date,
      priority: prioritized.priority,
    };
  }

  const eventMatch = raw.match(
    /^(?:event|events|ev|cal|calendar|meeting|meet)\s*[:.]?\s+(.+)$/i,
  );
  if (eventMatch) {
    const timed = extractTime(eventMatch[1]);
    const dated = extractDate(timed.rest, now);
    const title = cleanTitle(dated.rest.replace(/\ball-?day\b/gi, "").trim());
    if (!title) return { type: "error", message: "Give the event a title." };
    return {
      type: "event",
      title,
      date: dated.date ?? todayISO(now),
      startTime: timed.time,
      allDay: !timed.time,
    };
  }

  return { type: "error", message: HELP };
}

export const COMMAND_HELP = HELP;
