/**
 * The gate's route constants.
 *
 * Stated once, here, because two places must agree on them and they must agree
 * exactly: the gate redirects TO `ONBOARDING_PATH` and treats it as the one route
 * that renders without the app shell, and the sent-away path must match the actual
 * route segment (`app/app/onboarding/`). A second literal is how a gate redirects to
 * a 404.
 */
export const ONBOARDING_PATH = '/app/onboarding';

/** Where a finished account lands — the wizard's own way out, not the gate's. */
export const APP_HOME_PATH = '/app';
