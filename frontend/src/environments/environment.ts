/**
 * Everything is served through one origin: the app, `/api/*` and Keycloak's
 * `/realms/*` all come from wherever this page was loaded. That is what lets the same
 * build work at https://localhost and at a LAN address, with no CORS and nothing to
 * rebuild — see frontend/nginx.conf.
 */
const origin = globalThis.location?.origin ?? 'https://localhost';

export const environment = {
  apiUrl: origin,
  keycloak: {
    url: origin,
    realm: 'moss',
    clientId: 'moss-frontend',
  },
};
