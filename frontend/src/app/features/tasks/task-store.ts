import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { Task, TaskCreate, TaskList, TaskPatch } from '../../core/models';

export type Filter = 'all' | 'active' | 'completed';

/**
 * Single source of truth for the tasks screen. Mutations write through to the
 * API and replace local state from the response, so the database always wins.
 */
@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly api = inject(Api);

  readonly tasks = signal<Task[]>([]);
  readonly lists = signal<TaskList[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedListId = signal<string | null>(null);
  readonly filter = signal<Filter>('all');
  readonly search = signal('');

  readonly visibleTasks = computed(() => {
    const filter = this.filter();
    const listId = this.selectedListId();
    const query = this.search().trim().toLowerCase();

    return this.tasks().filter((task) => {
      if (listId && task.list_id !== listId) return false;
      if (filter === 'active' && task.completed) return false;
      if (filter === 'completed' && !task.completed) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });
  });

  readonly remaining = computed(() => this.visibleTasks().filter((t) => !t.completed).length);
  readonly doneCount = computed(() => this.visibleTasks().filter((t) => t.completed).length);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [tasks, lists] = await Promise.all([
        this.call(this.api.listTasks()),
        this.call(this.api.listLists()),
      ]);
      this.tasks.set(tasks);
      this.lists.set(lists);
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async add(task: TaskCreate): Promise<void> {
    await this.run(async () => {
      const created = await this.call(this.api.createTask(task));
      this.tasks.update((tasks) => [...tasks, created]);
    });
  }

  async patch(id: string, patch: TaskPatch): Promise<void> {
    await this.run(async () => {
      const updated = await this.call(this.api.updateTask(id, patch));
      this.tasks.update((tasks) => tasks.map((t) => (t.id === id ? updated : t)));
    });
  }

  async toggle(task: Task): Promise<void> {
    await this.patch(task.id, { completed: !task.completed });
  }

  async remove(id: string): Promise<void> {
    await this.run(async () => {
      await this.call(this.api.deleteTask(id));
      this.tasks.update((tasks) => tasks.filter((t) => t.id !== id));
    });
  }

  async clearCompleted(): Promise<void> {
    const done = this.tasks().filter((t) => t.completed);
    for (const task of done) {
      await this.remove(task.id);
    }
  }

  async addList(name: string): Promise<void> {
    await this.run(async () => {
      const created = await this.call(this.api.createList(name));
      this.lists.update((lists) => [...lists, created]);
    });
  }

  async removeList(id: string): Promise<void> {
    await this.run(async () => {
      await this.call(this.api.deleteList(id));
      this.lists.update((lists) => lists.filter((l) => l.id !== id));
      // The API cascades the delete; mirror that locally.
      this.tasks.update((tasks) => tasks.filter((t) => t.list_id !== id));
      if (this.selectedListId() === id) this.selectedListId.set(null);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(this.message(err));
      await this.load();
    }
  }

  private call<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source, { defaultValue: undefined as T });
  }

  private message(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 0) return 'Cannot reach the server.';
    if (status === 401) return 'Your session expired. Please sign in again.';
    return (err as { message?: string })?.message ?? 'Something went wrong.';
  }
}
