const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const WEEKDAY_SHORT: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function startOfWeekSunday(iso: string): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() - date.getDay());
  return toISODate(date);
}

export function startOfMonth(iso: string): string {
  const date = parseISODate(iso);
  date.setDate(1);
  return toISODate(date);
}

export function monthGrid(iso: string): string[] {
  const start = startOfMonth(iso);
  const gridStart = startOfWeekSunday(start);
  return Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
}

export function daysInRange(startISO: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(startISO, i));
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthYear(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekday(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export function formatTime(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":").map(Number);
  const date = new Date();
  date.setHours(hRaw ?? 0, mRaw ?? 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function compareISODate(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function nextWeekday(from: Date, weekday: number): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + (delta === 0 ? 0 : delta));
  return date;
}

export function parseTimeToken(raw: string): string | undefined {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const mer = match[3];
  if (minute > 59 || hour > 23) return undefined;
  if (mer) {
    if (hour > 12 || hour < 1) return undefined;
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return undefined;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function extractTime(text: string): { time?: string; rest: string } {
  const match = text.match(
    /\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i,
  );
  if (!match || match.index === undefined) return { rest: text };
  const time = parseTimeToken(match[1]);
  if (!time) return { rest: text };
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .trim();
  return { time, rest };
}

export function extractDate(
  text: string,
  now = new Date(),
): { date?: string; rest: string } {
  const source = text.trim();
  const patterns: { re: RegExp; toDate: (m: RegExpMatchArray) => Date | undefined }[] = [
    {
      re: /\b(today)\b/i,
      toDate: () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    },
    {
      re: /\b(tomorrow)\b/i,
      toDate: () => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      re: /\b(yesterday)\b/i,
      toDate: () => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        d.setDate(d.getDate() - 1);
        return d;
      },
    },
    {
      re: /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
      toDate: (m) => {
        const key = m[1].toLowerCase();
        const weekday =
          WEEKDAYS.findIndex((d) => d.startsWith(key.slice(0, 3))) >= 0
            ? WEEKDAYS.indexOf(
                WEEKDAYS.find((d) => d.startsWith(key.slice(0, 3)))!,
              )
            : WEEKDAY_SHORT[key];
        if (weekday === undefined) return undefined;
        const base = nextWeekday(now, weekday);
        if (base.getDay() === now.getDay()) base.setDate(base.getDate() + 7);
        else if (toISODate(base) === todayISO(now)) base.setDate(base.getDate() + 7);
        return base;
      },
    },
    {
      re: /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i,
      toDate: (m) => {
        const key = m[1].toLowerCase();
        const weekday =
          WEEKDAYS.findIndex((d) => d.startsWith(key.slice(0, 3))) >= 0
            ? WEEKDAYS.indexOf(
                WEEKDAYS.find((d) => d.startsWith(key.slice(0, 3)))!,
              )
            : WEEKDAY_SHORT[key];
        if (weekday === undefined) return undefined;
        return nextWeekday(now, weekday);
      },
    },
    {
      re: /\b(\d{4}-\d{2}-\d{2})\b/,
      toDate: (m) => parseISODate(m[1]),
    },
    {
      re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
      toDate: (m) => {
        const month = Number(m[1]);
        const day = Number(m[2]);
        let year = m[3] ? Number(m[3]) : now.getFullYear();
        if (year < 100) year += 2000;
        if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
        return new Date(year, month - 1, day);
      },
    },
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern.re);
    if (!match || match.index === undefined) continue;
    const date = pattern.toDate(match);
    if (!date || Number.isNaN(date.getTime())) continue;
    const rest = `${source.slice(0, match.index)} ${source.slice(match.index + match[0].length)}`
      .replace(/\s+/g, " ")
      .trim();
    return { date: toISODate(date), rest };
  }

  return { rest: source };
}
