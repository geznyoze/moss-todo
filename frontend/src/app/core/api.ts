import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Task, TaskCreate, TaskList, TaskPatch } from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  listTasks(filter: { list_id?: string; completed?: boolean; q?: string } = {}): Observable<Task[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Task[]>(`${this.base}/api/tasks`, { params });
  }

  createTask(task: TaskCreate): Observable<Task> {
    return this.http.post<Task>(`${this.base}/api/tasks`, task);
  }

  updateTask(id: string, patch: TaskPatch): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/api/tasks/${id}`, patch);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/tasks/${id}`);
  }

  listLists(): Observable<TaskList[]> {
    return this.http.get<TaskList[]>(`${this.base}/api/lists`);
  }

  createList(name: string, color?: string): Observable<TaskList> {
    return this.http.post<TaskList>(`${this.base}/api/lists`, { name, color });
  }

  updateList(id: string, patch: Partial<Pick<TaskList, 'name' | 'color' | 'position'>>): Observable<TaskList> {
    return this.http.patch<TaskList>(`${this.base}/api/lists/${id}`, patch);
  }

  deleteList(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/lists/${id}`);
  }
}
