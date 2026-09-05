import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { Api } from './api';
import { DAY, dueLabel, iso, today0 } from './dates';
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
    due_time: null,
    priority: 'none',
    status: 'backlog',
    recurring: 'none',
    color_h: 96,
    color_s: 40,
    color_l: 46,
    subtasks: [],
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

  it('keeps progress steady when done tasks are hidden', () => {
    const store = makeStore();
    store.tasks.set([task({ done: true }), task({ done: true }), task({}), task({})]);

    expect(store.progress()).toBe(50);
    store.showDone.set(false);
    expect(store.visible()).toHaveLength(2);
    expect(store.progress()).toBe(50);
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

describe('ordering', () => {
  it('lists soonest due first and undated last', () => {
    const store = makeStore();
    store.tasks.set([
      task({ title: 'undated' }),
      task({ title: 'later', due: iso(t + 3 * DAY) }),
      task({ title: 'today', due: iso(t) }),
    ]);

    expect(store.scoped().map((x) => x.title)).toEqual(['today', 'later', 'undated']);
  });

  it('orders same-day tasks by time, with the untimed one first', () => {
    const store = makeStore();
    store.tasks.set([
      task({ title: 'evening', due: iso(t), due_time: '18:30' }),
      task({ title: 'all day', due: iso(t) }),
      task({ title: 'morning', due: iso(t), due_time: '09:00' }),
    ]);

    expect(store.scoped().map((x) => x.title)).toEqual(['all day', 'morning', 'evening']);
  });

  it('falls back to creation time when two tasks are due at the same moment', () => {
    const store = makeStore();
    store.tasks.set([
      task({ title: 'newer', due: iso(t), due_time: '09:00', created_at: '2026-02-01T00:00:00Z' }),
      task({ title: 'older', due: iso(t), due_time: '09:00', created_at: '2026-01-01T00:00:00Z' }),
    ]);

    expect(store.scoped().map((x) => x.title)).toEqual(['older', 'newer']);
  });

  it('buckets a timed task by its day, not its hour', () => {
    const store = makeStore();
    store.view.set('dates');
    store.tasks.set([task({ due: iso(t), due_time: '23:45' })]);

    const filled = store.sections().filter((s) => s.tasks.length);
    expect(filled.map((s) => s.title)).toEqual(['Today']);
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

describe('dueLabel', () => {
  it('appends a time only when one is set', () => {
    expect(dueLabel({ due: iso(t), due_time: null })).toBe('Today');
    expect(dueLabel({ due: iso(t), due_time: '09:00' })).toMatch(/^Today \d/);
    expect(dueLabel({ due: null, due_time: null })).toBe('');
  });
});

describe('toggleDoing', () => {
  it('moves a task into "doing" and back out to "next"', async () => {
    const sent: Partial<Task>[] = [];
    const store = makeStore({
      patchTask: (_id: string, patch: Partial<Task>) => {
        sent.push(patch);
        return of(task({ ...patch }));
      },
    } as Partial<Api>);

    await store.toggleDoing(task({ status: 'backlog' }));
    await store.toggleDoing(task({ status: 'doing' }));
    expect(sent).toEqual([{ status: 'doing' }, { status: 'next' }]);
  });
});
