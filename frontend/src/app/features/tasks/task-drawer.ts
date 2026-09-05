import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PRESETS, PRIORITIES, RECURS, STATUSES, Subtask, Task } from '../../core/models';
import { TaskStore } from '../../core/task-store';

@Component({
  selector: 'app-task-drawer',
  imports: [FormsModule],
  templateUrl: './task-drawer.html',
  styleUrl: './task-drawer.css',
})
export class TaskDrawer {
  protected readonly store = inject(TaskStore);

  protected readonly statuses = STATUSES;
  protected readonly priorities = PRIORITIES;
  protected readonly recurs = RECURS;
  protected readonly presets = PRESETS;

  private readonly wheel = viewChild<ElementRef<HTMLElement>>('wheel');
  /** Hue/saturation being dragged on the wheel; committed on pointerup. */
  private readonly preview = signal<{ h: number; s: number } | null>(null);

  protected readonly task = computed(() => this.store.selected()!);

  protected readonly colour = computed(() => {
    const t = this.task();
    const p = this.preview();
    return { h: p?.h ?? t.color_h, s: p?.s ?? t.color_s, l: t.color_l };
  });

  protected readonly css = computed(() => {
    const c = this.colour();
    return `hsl(${c.h} ${c.s}% ${c.l}%)`;
  });

  protected readonly knob = computed(() => {
    const c = this.colour();
    const radius = Math.min(1, c.s / 85) * 68;
    const angle = (c.h * Math.PI) / 180;
    return { left: 74 + Math.cos(angle) * radius - 8, top: 74 + Math.sin(angle) * radius - 8 };
  });

  protected readonly groupOptions = computed(() => {
    const list = this.store.lists().find((l) => l.id === this.task().list_id);
    return ['', ...(list?.groups ?? [])];
  });

  protected patch(patch: Parameters<TaskStore['patch']>[1]): void {
    void this.store.patch(this.task().id, patch);
  }

  /** Clearing the date clears any time with it — a time with no date means nothing. */
  protected setDue(due: string): void {
    this.patch(due ? { due } : { due: null, due_time: null });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  /* ---------- colour wheel ---------- */

  private pick(event: PointerEvent): { h: number; s: number } | null {
    const el = this.wheel()?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const h = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
    const dist = Math.sqrt(dx * dx + dy * dy) / (rect.width / 2);
    return { h, s: Math.round(Math.max(0.12, Math.min(1, dist)) * 85) };
  }

  protected wheelDown(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.preview.set(this.pick(event));
  }

  protected wheelMove(event: PointerEvent): void {
    if (this.preview()) this.preview.set(this.pick(event));
  }

  protected wheelUp(): void {
    const picked = this.preview();
    this.preview.set(null);
    if (picked) this.patch({ color_h: picked.h, color_s: picked.s });
  }

  /* ---------- subtasks ---------- */

  protected addSubtask(input: HTMLInputElement): void {
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    this.patch({
      subtasks: [...this.task().subtasks, { id: crypto.randomUUID(), title, done: false }],
    });
  }

  protected toggleSubtask(sub: Subtask): void {
    this.patch({
      subtasks: this.task().subtasks.map((s) => (s.id === sub.id ? { ...s, done: !s.done } : s)),
    });
  }

  protected removeSubtask(sub: Subtask): void {
    this.patch({ subtasks: this.task().subtasks.filter((s) => s.id !== sub.id) });
  }

  protected subLabel(t: Task): string {
    return `${t.subtasks.filter((s) => s.done).length} of ${t.subtasks.length}`;
  }
}
