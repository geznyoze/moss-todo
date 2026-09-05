export interface Task {
  id: string;
  list_id: string | null;
  title: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  priority: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  id: string;
  name: string;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type TaskCreate = Partial<Pick<Task, 'notes' | 'list_id' | 'due_date' | 'priority' | 'position'>> & {
  title: string;
};

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'notes' | 'list_id' | 'completed' | 'due_date' | 'priority' | 'position'>
>;
