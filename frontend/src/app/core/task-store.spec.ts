import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Api } from './api';
import { DAY, iso, today0 } from './dates';
import { Task, TaskList } from './models';
import { TaskStore } from './task-store';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    list_id: null,
    group_name: '',
    title: 'Task',
    notes: '',
    done: false,
    due: null,
    priority: 'none',
    status: 'backlog',
    recurring: 'none',
    color_h: 96,
    color_s: 40,
    color_l: 46,
    subtasks: [],
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStore(api: Partial<Api> = {}): TaskStore {
  TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: api }] });
  return TestBed.inject(TaskStore);
}

const t = today0();

describe('scoping', () => {
  it('splits tasks into today and upcoming by due date', () => {
    const store = makeStore();
    store.tasks.set([
      task({ title: 'overdue', due: iso(t - DAY) }),
      task({ title: 'today', due: iso(t) }),
      task({ title: 'later', due: iso(t + 2 * DAY) }),
      task({ title: 'undated' }),
    ]);

    store.scope.set('today');
    expect(store.visible().map((x) => x.title)).toEqual(['overdue', 'today']);

    store.scope.set('upcoming');
    expect(store.visible().map((x) => x.title)).toEqual(['later']);
  });

  it('hides done tasks when showDone is off', () => {
    const store = makeStore();
    store.tasks.set([task({ title: 'a' }), task({ title: 'b', done: true })]);

    expect(store.visible()).toHaveLength(2);
    store.showDone.set(false);
    expect(store.visible().map((x) => x.title)).toEqual(['a']);
  });
});

describe('sections', () => {
  it('builds one section per group plus Ungrouped, in list view', () => {
    const store = makeStore();
    const list: TaskList = {
      id: 'L1',
      name: 'Personal',
      hue: 96,
      groups: ['Errands', 'Health'],
      position: 0,
      created_at: '',
      updated_at: '',
    };
    store.lists.set([list]);
    store.scope.set('L1');
    store.tasks.set([
      task({ title: 'milk', list_id: 'L1', group_name: 'Errands' }),
      task({ title: 'loose', list_id: 'L1' }),
    ]);

    expect(store.sections().map((s) => [s.title, s.tasks.length])).toEqual([
      ['Errands', 1],
      ['Health', 0],
      ['Ungrouped', 1],
    ]);
  });

  it('buckets by due date in dates view', () => {
    const store = makeStore();
    store.view.set('dates');
    store.tasks.set([
      task({ due: iso(t - DAY) }),
      task({ due: iso(t) }),
      task({ due: iso(t + 3 * DAY) }),
      task({ due: iso(t + 30 * DAY) }),
      task({}),
    ]);

    expect(store.sections().map((s) => [s.title, s.tasks.length])).toEqual([
      ['Overdue', 1],
      ['Today', 1],
      ['This week', 1],
      ['Later', 1],
      ['No date', 1],
    ]);
  });
});

describe('reordering', () => {
  it('drops between neighbours by taking the midpoint position', async () => {
    const patchTask = vi.fn((_id: string, patch: object) => of({ ...task(), ...patch }));
    const store = makeStore({ patchTask } as Partial<Api>);

    const a = task({ title: 'a', position: 10 });
    const b = task({ title: 'b', position: 20 });
    const dragged = task({ title: 'dragged', position: 99 });
    store.tasks.set([a, b, dragged]);

    store.dragId.set(dragged.id);
    await store.moveBefore(b);

    expect(patchTask).toHaveBeenCalledWith(dragged.id, expect.objectContaining({ position: 15 }));
  });

  it('places before the first row without colliding with it', async () => {
    const patchTask = vi.fn((_id: string, patch: object) => of({ ...task(), ...patch }));
    const store = makeStore({ patchTask } as Partial<Api>);

    const first = task({ title: 'first', position: 10 });
    const dragged = task({ title: 'dragged', position: 99 });
    store.tasks.set([first, dragged]);

    store.dragId.set(dragged.id);
    await store.moveBefore(first);

    expect(patchTask.mock.calls[0][1]).toMatchObject({ position: 9.5 });
  });

  it('ignores a drop onto the dragged row itself', async () => {
    const patchTask = vi.fn();
    const store = makeStore({ patchTask } as Partial<Api>);
    const only = task({ position: 1 });
    store.tasks.set([only]);

    store.dragId.set(only.id);
    await store.moveBefore(only);

    expect(patchTask).not.toHaveBeenCalled();
  });
});

describe('bucketDue', () => {
  it('maps each dates-view bucket to a representative due date', () => {
    const store = makeStore();
    expect(store.bucketDue('today')).toBe(iso(t));
    expect(store.bucketDue('over')).toBe(iso(t - DAY));
    expect(store.bucketDue('none')).toBeNull();
  });
});
