import { Component, OnInit, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Auth } from '../../core/auth';
import { dueDayMs, dueLabel, today0 } from '../../core/dates';
import { Column, Section, TaskStore, View } from '../../core/task-store';
import { PRIORITIES, Task } from '../../core/models';
import { TaskDrawer } from './task-drawer';

@Component({
  selector: 'app-tasks-page',
  imports: [FormsModule, NgTemplateOutlet, TaskDrawer],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit {
  protected readonly store = inject(TaskStore);
  protected readonly auth = inject(Auth);

  protected readonly quickDraft = signal('');
  protected readonly listDraft = signal('');
  protected readonly groupDraft = signal('');
  protected readonly sectionDrafts = signal<Record<string, string>>({});

  protected readonly dueLabel = dueLabel;

  ngOnInit(): void {
    void this.store.load();
    this.store.sidebarOpen.set(window.innerWidth >= 900);
  }

  /* ---------- per-task colour ---------- */

  protected accent(t: Task): string {
    return `hsl(${t.color_h} ${t.color_s}% ${t.color_l}%)`;
  }

  /** Row background: the task's hue, desaturated and darkened into the moss palette. */
  protected tint(t: Task): string {
    return `hsl(${t.color_h} ${Math.min(45, t.color_s * 0.55)}% ${t.done ? 11 : 19}%)`;
  }

  protected edge(t: Task): string {
    return `hsl(${t.color_h} ${Math.min(45, t.color_s * 0.55)}% 28%)`;
  }

  protected overdue(t: Task): boolean {
    const day = dueDayMs(t.due);
    return day !== null && day < today0() && !t.done;
  }

  protected priorityName(t: Task): string {
    return PRIORITIES.find((p) => p.id === t.priority)?.name ?? '';
  }

  protected subLabel(t: Task): string {
    return `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`;
  }

  protected listName(id: string | null): string {
    return this.store.lists().find((l) => l.id === id)?.name ?? '';
  }

  protected get scopeTitle(): string {
    const list = this.store.scopeList();
    if (list) return list.name;
    return this.store.scope() === 'today'
      ? 'Today'
      : this.store.scope() === 'upcoming'
        ? 'Upcoming'
        : 'All tasks';
  }

  protected get scopeSub(): string {
    const view = this.store.view();
    if (view === 'board') return 'Grouped by status — drag cards between columns';
    if (view === 'dates') return 'Grouped by due date — drag to reschedule';
    const list = this.store.scopeList();
    return list ? `${list.groups.length} groups · drag rows to reorder` : 'Every task across your lists';
  }

  /* ---------- actions ---------- */

  protected setView(view: View): void {
    this.store.view.set(view);
  }

  protected async addQuick(): Promise<void> {
    const title = this.quickDraft().trim();
    if (!title) return;
    this.quickDraft.set('');
    await this.store.add({ title, list_id: this.store.scopeList()?.id ?? null });
  }

  protected async addToSection(section: Section): Promise<void> {
    const title = (this.sectionDrafts()[section.key] ?? '').trim();
    if (!title) return;
    this.setSectionDraft(section.key, '');
    await this.store.add({
      title,
      list_id: this.store.scopeList()?.id ?? null,
      group_name: section.id,
    });
  }

  protected setSectionDraft(key: string, value: string): void {
    this.sectionDrafts.update((d) => ({ ...d, [key]: value }));
  }

  protected async addList(): Promise<void> {
    const name = this.listDraft().trim();
    if (!name) return;
    this.listDraft.set('');
    await this.store.addList(name);
  }

  protected async addGroup(): Promise<void> {
    const list = this.store.scopeList();
    const name = this.groupDraft().trim();
    if (!list || !name) return;
    this.groupDraft.set('');
    await this.store.addGroup(list, name);
  }

  /* ---------- drag and drop ---------- */

  protected onDragStart(task: Task, event: DragEvent): void {
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.store.dragId.set(task.id);
  }

  protected allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  /** Dropping onto a task adopts its grouping; ordering is always by due date. */
  protected async dropOnTask(target: Task, event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.store.moveInto(
      { group_name: target.group_name, list_id: target.list_id, status: target.status },
      target.id,
    );
  }

  protected async dropOnSection(section: Section, event: DragEvent): Promise<void> {
    event.preventDefault();
    if (this.store.view() === 'dates') {
      await this.store.moveInto({ due: this.store.bucketDue(section.id) });
    } else {
      const list = this.store.scopeList();
      await this.store.moveInto(
        list ? { group_name: section.id, list_id: list.id } : { group_name: section.id },
      );
    }
  }

  protected async dropOnColumn(column: Column, event: DragEvent): Promise<void> {
    event.preventDefault();
    await this.store.moveInto({ status: column.id, done: column.id === 'done' });
  }
}
