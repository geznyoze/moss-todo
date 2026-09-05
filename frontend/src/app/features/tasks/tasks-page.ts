import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../core/auth';
import { Task } from '../../core/models';
import { Filter, TaskStore } from './task-store';

@Component({
  selector: 'app-tasks-page',
  imports: [FormsModule],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit {
  protected readonly store = inject(TaskStore);
  protected readonly auth = inject(Auth);

  protected readonly draftTitle = signal('');
  protected readonly draftDue = signal('');
  protected readonly draftList = signal<string>('');
  protected readonly newListName = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingTitle = signal('');

  ngOnInit(): void {
    void this.store.load();
  }

  protected setFilter(filter: Filter): void {
    this.store.filter.set(filter);
  }

  protected selectList(id: string | null): void {
    this.store.selectedListId.set(id);
  }

  protected async addTask(): Promise<void> {
    const title = this.draftTitle().trim();
    if (!title) return;
    await this.store.add({
      title,
      due_date: this.draftDue() || null,
      list_id: this.draftList() || this.store.selectedListId() || null,
    });
    this.draftTitle.set('');
    this.draftDue.set('');
  }

  protected async addList(): Promise<void> {
    const name = this.newListName().trim();
    if (!name) return;
    await this.store.addList(name);
    this.newListName.set('');
  }

  protected startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingTitle.set(task.title);
  }

  protected async commitEdit(task: Task): Promise<void> {
    const title = this.editingTitle().trim();
    this.editingId.set(null);
    if (title && title !== task.title) {
      await this.store.patch(task.id, { title });
    }
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected listName(id: string | null): string | null {
    return this.store.lists().find((l) => l.id === id)?.name ?? null;
  }

  /** Human-friendly due label; flags anything not yet done and past due. */
  protected due(task: Task): { label: string; overdue: boolean } | null {
    if (!task.due_date) return null;
    const date = new Date(`${task.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    const label =
      days === 0
        ? 'Today'
        : days === 1
          ? 'Tomorrow'
          : days === -1
            ? 'Yesterday'
            : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { label, overdue: days < 0 && !task.completed };
  }
}
