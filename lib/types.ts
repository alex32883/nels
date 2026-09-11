export type Priority = "low" | "medium" | "high";

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate?: string;
  priority: Priority;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  notes: string;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ItemKind = "note" | "task" | "event";

export type Tombstone = {
  id: string;
  kind: ItemKind;
  deletedAt: number;
};

export type BackupPayload = {
  version: 1 | 2;
  exportedAt: number;
  notes: Note[];
  tasks: Task[];
  events: CalendarEvent[];
  tombstones?: Tombstone[];
};
