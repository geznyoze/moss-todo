import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { Api } from '../../core/api';
import { Task } from '../../core/models';
import { TaskStore } from './task-store';

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    list_id: null,
    title: 'Task',
    notes: null,
    completed: false,
    completed_at: null,
    due_date: null,
    priority: 0,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStore(): TaskStore {
  TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: {} }] });
  return TestBed.inject(TaskStore);
}

describe('TaskStore.visibleTasks', () => {
  it('filters by completion state', () => {
    const store = makeStore();
    store.tasks.set([task({ title: 'a' }), task({ title: 'b', completed: true })]);

    store.filter.set('active');
    expect(store.visibleTasks().map((t) => t.title)).toEqual(['a']);

    store.filter.set('completed');
    expect(store.visibleTasks().map((t) => t.title)).toEqual(['b']);

    store.filter.set('all');
    expect(store.visibleTasks()).toHaveLength(2);
  });

  it('filters by list and search together', () => {
    const store = makeStore();
    store.tasks.set([
      task({ title: 'Buy moss', list_id: 'L1' }),
      task({ title: 'Buy soil', list_id: 'L2' }),
      task({ title: 'Water plants', list_id: 'L1' }),
    ]);

    store.selectedListId.set('L1');
    expect(store.visibleTasks()).toHaveLength(2);

    store.search.set('buy');
    expect(store.visibleTasks().map((t) => t.title)).toEqual(['Buy moss']);
  });

  it('counts remaining and done within the current view', () => {
    const store = makeStore();
    store.tasks.set([
      task({ list_id: 'L1' }),
      task({ list_id: 'L1', completed: true }),
      task({ list_id: 'L2', completed: true }),
    ]);
    store.selectedListId.set('L1');

    expect(store.remaining()).toBe(1);
    expect(store.doneCount()).toBe(1);
  });
});
