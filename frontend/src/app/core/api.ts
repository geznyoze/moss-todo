import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ListPatch, Task, TaskList, TaskNew, TaskPatch } from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  tasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.base}/api/tasks`);
  }

  createTask(task: TaskNew): Observable<Task> {
    return this.http.post<Task>(`${this.base}/api/tasks`, task);
  }

  patchTask(id: string, patch: TaskPatch): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/api/tasks/${id}`, patch);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/tasks/${id}`);
  }

  lists(): Observable<TaskList[]> {
    return this.http.get<TaskList[]>(`${this.base}/api/lists`);
  }

  createList(list: { name: string; hue: number; position: number }): Observable<TaskList> {
    return this.http.post<TaskList>(`${this.base}/api/lists`, list);
  }

  patchList(id: string, patch: ListPatch): Observable<TaskList> {
    return this.http.patch<TaskList>(`${this.base}/api/lists/${id}`, patch);
  }

  deleteList(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/lists/${id}`);
  }
}
