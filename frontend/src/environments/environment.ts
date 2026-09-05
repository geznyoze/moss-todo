/**
 * The app and `/api/*` come from wherever this page was loaded, which is what lets the
 * same build work at https://localhost and at a public address with no rebuild and no
 * CORS — see frontend/nginx.conf.
 */
const origin = globalThis.location?.origin ?? 'https://localhost';

export const environment = {
  apiUrl: origin,
};
