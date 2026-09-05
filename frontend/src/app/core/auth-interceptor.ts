import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  return from(auth.token()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
    catchError((err: HttpErrorResponse) => {
      // The token has a 30-day life and no refresh, so an expired one is a real case.
      // Without this the app just sits there empty.
      if (err.status === 401) auth.logout();
      return throwError(() => err);
    }),
  );
};
