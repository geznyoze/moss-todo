/**
 * Derived from the URL the app was opened at, so one build serves
 * http://localhost:4200 and http://<lan-ip>:4200 without a rebuild. The API and
 * Keycloak are published on the same host, just different ports.
 */
const host = globalThis.location?.hostname ?? 'localhost';

export const environment = {
  production: false,
  apiUrl: `http://${host}:8000`,
  keycloak: {
    url: `http://${host}:8080`,
    realm: 'moss',
    clientId: 'moss-frontend',
  },
};
