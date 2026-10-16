/**
 * The terms version in force, read from the server's own module.
 *
 * This file exists so the web app has ONE import path for the terms version, and
 * so that path is stated in one place. The value is NOT restated here — it is
 * re-exported from `backend/src/legal/terms.ts`, which is the single source the
 * terms copy below it and the backend's consent recorder both read. A second
 * literal in the web app is how a recorded acceptance comes to name a version
 * nobody was shown, which is the whole failure this arrangement removes.
 *
 * WHY THE BACKEND OWNS IT: the backend image ships only `backend/` (see
 * `backend/Dockerfile` and `.dockerignore`), so a constant it must read at
 * runtime can only live inside the backend. The web app is the side that reaches
 * across, and it can: it builds from this repository, and both `next` and the
 * Workers build resolve a path outside `web/` (verified in a rendered dev build,
 * not assumed).
 *
 * The relative path rather than `@/` because the target is deliberately outside
 * the `@/*` → `web/*` alias — an alias that silently resolved elsewhere would be
 * a second copy under another name, which is the thing this avoids.
 */
export { TERMS_VERSION, TERMS_EFFECTIVE_DATE } from '../../../backend/src/legal/terms';
