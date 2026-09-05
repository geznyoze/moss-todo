import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { Auth } from './core/auth';

const signedIn: CanActivateFn = () =>
  inject(Auth).authed() || inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [signedIn],
    loadComponent: () => import('./features/tasks/tasks-page').then((m) => m.TasksPage),
  },
  { path: '**', redirectTo: '' },
];
