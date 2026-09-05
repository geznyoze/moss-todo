import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/tasks/tasks-page').then((m) => m.TasksPage),
  },
  { path: '**', redirectTo: '' },
];
