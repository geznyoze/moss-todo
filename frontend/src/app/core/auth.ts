import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';

interface Session {
  token: string;
  username: string;
}

const KEY = 'moss.session';

/**
 * Our own auth. The token is an HS256 JWT from /api/auth/login, kept in localStorage
 * so a reload does not sign you out — it is a cached credential, not app state, which
 * still lives only in Postgres.
 *
 * login/register use `fetch` rather than HttpClient on purpose: the interceptor
 * injects this service, so injecting HttpClient here would close a cycle.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(read());

  readonly username = computed(() => this.session()?.username ?? null);
  readonly authed = computed(() => this.session() !== null);

  /** The interceptor's contract: the bearer string, or undefined when signed out. */
  async token(): Promise<string | undefined> {
    return this.session()?.token;
  }

  login(username: string, password: string): Promise<void> {
    return this.post('login', { username, password });
  }

  register(username: string, email: string, password: string): Promise<void> {
    return this.post('register', { username, email, password });
  }

  logout(): void {
    localStorage.removeItem(KEY);
    this.session.set(null);
    void this.router.navigateByUrl('/login');
  }

  private async post(path: string, body: object): Promise<void> {
    const res = await fetch(`${environment.apiUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(detail(data) ?? `Request failed (${res.status})`);

    const session: Session = { token: data.access_token, username: data.username };
    localStorage.setItem(KEY, JSON.stringify(session));
    this.session.set(session);
  }
}

function read(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** FastAPI puts a string in `detail` for our errors and a list for validation ones. */
function detail(data: { detail?: unknown }): string | null {
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return String(data.detail[0]?.msg ?? '');
  return null;
}
