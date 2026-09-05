export type Priority = 'none' | 'low' | 'med' | 'high';
export type Status = 'backlog' | 'next' | 'doing' | 'done';
export type Recurring = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  list_id: string | null;
  group_name: string;
  title: string;
  notes: string;
  done: boolean;
  due: string | null;
  /** 'HH:MM' when the task is due at a specific time, else null. */
  due_time: string | null;
  priority: Priority;
  status: Status;
  recurring: Recurring;
  color_h: number;
  color_s: number;
  color_l: number;
  subtasks: Subtask[];
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  id: string;
  name: string;
  hue: number;
  groups: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>;
export type TaskNew = TaskPatch & { title: string };
export type ListPatch = Partial<Pick<TaskList, 'name' | 'hue' | 'groups' | 'position'>>;

export const STATUSES: { id: Status; name: string }[] = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'next', name: 'Next up' },
  { id: 'doing', name: 'In progress' },
  { id: 'done', name: 'Done' },
];

export const PRIORITIES: { id: Priority; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'low', name: 'Low' },
  { id: 'med', name: 'Medium' },
  { id: 'high', name: 'High' },
];

export const RECURS: { id: Recurring; name: string }[] = [
  { id: 'none', name: 'Never' },
  { id: 'daily', name: 'Daily' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'monthly', name: 'Monthly' },
];

export const PRESETS = [
  { h: 96, s: 42, l: 46 },
  { h: 168, s: 38, l: 44 },
  { h: 200, s: 46, l: 50 },
  { h: 262, s: 36, l: 56 },
  { h: 330, s: 46, l: 58 },
  { h: 18, s: 62, l: 54 },
  { h: 42, s: 68, l: 50 },
  { h: 70, s: 24, l: 42 },
];
