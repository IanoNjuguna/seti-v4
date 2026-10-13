/**
 * Base URL for the Seti API.
 *
 * `NEXT_PUBLIC_API_URL` wins so a build can point anywhere; the default is the
 * local backend. Unlike the mobile app there is no platform branch: a browser
 * always reaches the host as `localhost`.
 *
 * Ported from `mobile/src/lib/api/api.constants.ts`.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
