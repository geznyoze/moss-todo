import { Injectable, signal } from '@angular/core';
import Keycloak from 'keycloak-js';

import { environment } from '../../environments/environment';

/**
 * Wraps keycloak-js. `init()` runs once during app bootstrap; every route is
 * behind login, so we use `login-required` rather than silent check-sso.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly keycloak = new Keycloak(environment.keycloak);

  readonly username = signal<string | null>(null);
  readonly ready = signal(false);

  async init(): Promise<void> {
    await this.keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
    this.username.set(this.keycloak.tokenParsed?.['preferred_username'] ?? null);
    this.ready.set(true);
  }

  /** Refreshes when the token has under 30s left, then returns it. */
  async token(): Promise<string | undefined> {
    await this.keycloak.updateToken(30).catch(() => this.keycloak.login());
    return this.keycloak.token;
  }

  logout(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin });
  }
}
