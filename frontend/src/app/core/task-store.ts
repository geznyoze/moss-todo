import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { Api } from './api';
import { DAY, byDueThenCreated, dueDayMs, iso, today0 } from './dates';
import {
  ListPatch,
  STATUSES,
  Status,
  Task,
  TaskList,
  TaskNew,
  TaskPatch,
} from './models';

export type View = 'list' | 'board' | 'dates';
/** A list id, or one of the smart views. */
export type Scope = string;

export interface Section {
  key: string;
  title: string;
  /** Group name for list view, bucket id for dates view. */
  id: string;
  tasks: Task[];
  canAdd: boolean;
  canRemove: boolean;
}

export interface Column {
  id: Status;
  name: string;
  tasks: Task[];
}

const DATE_BUCKETS = [
  { id: 'over', name: 'Overdue' },
  { id: 'today', name: 'Today' },
  { id: 'week', name: 'This week' },
  { id: 'later', name: 'Later' },
  { id: 'none', name: 'No date' },
];

/**
 * All screen state. Mutations write through to the API and adopt the response,
 * so Postgres stays the source of truth and nothing is cached locally.
 */
@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly api = inject(Api);

  readonly tasks = signal<Task[]>([]);
  readonly lists = signal<TaskList[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly scope = signal<Scope>('all');
  readonly view = signal<View>('list');
  readonly showDone = signal(true);
  readonly selectedId = signal<string | null>(null);
  readonly collapsed = signal<Record<string, boolean>>({});
  readonly sidebarOpen = signal(true);
  readonly dragId = signal<string | null>(null);

  readonly scopeList = computed(() => this.lists().find((l) => l.id === this.scope()) ?? null);
  readonly selected = computed(() => this.tasks().find((t) => t.id === this.selectedId()) ?? null);
  readonly openCount = computed(() => this.tasks().filter((t) => !t.done).length);

  /** Everything in the current scope, done included, soonest due first. */
  readonly scoped = computed(() => {
    const scope = this.scope();
    const t = today0();
    const tasks = this.tasks();

    const inScope =
      scope === 'today'
        ? tasks.filter((x) => (dueDayMs(x.due) ?? Infinity) <= t)
        : scope === 'upcoming'
          ? tasks.filter((x) => (dueDayMs(x.due) ?? -Infinity) > t)
          : scope === 'all'
            ? tasks
            : tasks.filter((x) => x.list_id === scope);

    // Sorted here as well as in the API so a locally added task lands in the right
    // place immediately, without waiting for a refetch.
    return [...inScope].sort(byDueThenCreated);
  });

  /** What the rows actually render — `scoped`, minus done tasks when they are hidden. */
  readonly visible = computed(() =>
    this.showDone() ? this.scoped() : this.scoped().filter((x) => !x.done),
  );

  /**
   * Measured against `scoped`, not `visible`: hiding done tasks is a view preference and
   * must not change how much of the scope is reported as finished.
   */
  readonly progress = computed(() => {
    const all = this.scoped();
    if (!all.length) return 0;
    return Math.round((all.filter((t) => t.done).length / all.length) * 100);
  });

  readonly smartViews = computed(() => {
    const t = today0();
    const open = this.tasks().filter((x) => !x.done);
    return [
      { id: 'all', name: 'All tasks', count: open.length },
      { id: 'today', name: 'Today', count: open.filter((x) => (dueDayMs(x.due) ?? Infinity) <= t).length },
      { id: 'upcoming', name: 'Upcoming', count: open.filter((x) => (dueDayMs(x.due) ?? -Infinity) > t).length },
    ];
  });

  readonly listNav = computed(() =>
    this.lists().map((l) => ({
      ...l,
      count: this.tasks().filter((t) => t.list_id === l.id && !t.done).length,
    })),
  );

  readonly sections = computed<Section[]>(() => {
    const list = this.scopeList();
    const visible = this.visible();

    if (this.view() === 'dates') {
      const t = today0();
      const bucket = (task: Task): string => {
        const ms = dueDayMs(task.due);
        if (ms === null) return 'none';
        if (ms < t) return 'over';
        if (ms === t) return 'today';
        return ms <= t + 7 * DAY ? 'week' : 'later';
      };
      return DATE_BUCKETS.map((b) => ({
        key: `bucket::${b.id}`,
        id: b.id,
        title: b.name,
        tasks: visible.filter((task) => bucket(task) === b.id),
        canAdd: false,
        canRemove: false,
      }));
    }

    const groups = list ? [...list.groups, ''] : [''];
    return groups.map((g) => ({
      key: `${list?.id ?? this.scope()}::${g}`,
      id: g,
      title: g || (list ? 'Ungrouped' : 'All'),
      tasks: visible.filter((t) => t.group_name === g),
      canAdd: !!list,
      canRemove: !!g,
    }));
  });

  readonly columns = computed<Column[]>(() =>
    STATUSES.map((s) => ({
      ...s,
      tasks: this.visible().filter((t) => t.status === s.id),
    })),
  );

  isOpen(key: string): boolean {
    return this.collapsed()[key] !== true;
  }

  toggleSection(key: string): void {
    this.collapsed.update((c) => ({ ...c, [key]: this.isOpen(key) }));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [tasks, lists] = await Promise.all([this.call(this.api.tasks()), this.call(this.api.lists())]);
      this.tasks.set(tasks);
      this.lists.set(lists);
      this.error.set(null);
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.loading.set(false);
    }
  }

  async add(fields: TaskNew): Promise<void> {
    const hue = this.lists().find((l) => l.id === fields.list_id)?.hue ?? 96;
    await this.run(async () => {
      const created = await this.call(this.api.createTask({ color_h: hue, ...fields }));
      this.tasks.update((tasks) => [...tasks, created]);
    });
  }

  async patch(id: string, patch: TaskPatch): Promise<void> {
    await this.run(async () => {
      const updated = await this.call(this.api.patchTask(id, patch));
      this.tasks.update((tasks) => tasks.map((t) => (t.id === id ? updated : t)));
    });
  }

  async toggle(task: Task): Promise<void> {
    await this.patch(task.id, { done: !task.done, status: task.done ? 'next' : 'done' });
  }

  async remove(id: string): Promise<void> {
    await this.run(async () => {
      await this.call(this.api.deleteTask(id));
      this.tasks.update((tasks) => tasks.filter((t) => t.id !== id));
      if (this.selectedId() === id) this.selectedId.set(null);
    });
  }

  async duplicate(task: Task): Promise<void> {
    const { id, created_at, updated_at, ...rest } = task;
    await this.run(async () => {
      const copy = await this.call(
        this.api.createTask({ ...rest, title: `${task.title} (copy)` }),
      );
      this.tasks.update((tasks) => [...tasks, copy]);
      this.selectedId.set(copy.id);
    });
  }

  /**
   * Drop onto empty space in a section or column, or onto another task: the dragged
   * task adopts that grouping. Rows always render in due order, so there is no
   * within-group position to move.
   */
  async moveInto(patch: TaskPatch, exceptId?: string): Promise<void> {
    const id = this.dragId();
    this.dragId.set(null);
    if (id && id !== exceptId) await this.patch(id, patch);
  }

  /** Due date a task takes when dropped into a bucket of the dates view. */
  bucketDue(bucketId: string): string | null {
    const t = today0();
    const map: Record<string, string | null> = {
      over: iso(t - DAY),
      today: iso(t),
      week: iso(t + 3 * DAY),
      later: iso(t + 21 * DAY),
      none: null,
    };
    return map[bucketId] ?? null;
  }

  async addList(name: string): Promise<void> {
    const hue = [96, 200, 42, 168, 262, 330][this.lists().length % 6];
    await this.run(async () => {
      const created = await this.call(
        this.api.createList({ name, hue, position: this.lists().length }),
      );
      this.lists.update((lists) => [...lists, created]);
    });
  }

  async patchList(id: string, patch: ListPatch): Promise<void> {
    await this.run(async () => {
      const updated = await this.call(this.api.patchList(id, patch));
      this.lists.update((lists) => lists.map((l) => (l.id === id ? updated : l)));
    });
  }

  async addGroup(list: TaskList, name: string): Promise<void> {
    if (list.groups.includes(name)) return;
    await this.patchList(list.id, { groups: [...list.groups, name] });
  }

  /** Removing a group keeps its tasks — they fall back to Ungrouped. */
  async removeGroup(list: TaskList, name: string): Promise<void> {
    await this.patchList(list.id, { groups: list.groups.filter((g) => g !== name) });
    for (const task of this.tasks().filter((t) => t.list_id === list.id && t.group_name === name)) {
      await this.patch(task.id, { group_name: '' });
    }
  }

  async removeList(id: string): Promise<void> {
    await this.run(async () => {
      await this.call(this.api.deleteList(id));
      this.lists.update((lists) => lists.filter((l) => l.id !== id));
      this.tasks.update((tasks) => tasks.filter((t) => t.list_id !== id));
      if (this.scope() === id) this.scope.set('all');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      this.error.set(null);
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
