import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { productionApiUrlRefusal } from "./scripts/guard-production-env.mjs";

/**
 * The production build guard, as a Vite plugin.
 *
 * `npm run build:vinext` already runs `scripts/guard-production-env.mjs` before
 * `vite build`, but a bare `vite build` would slip past that. `apply: "build"`
 * makes the plugin run for a build and NEVER for `vite dev`, so the development
 * server is untouched, while any production build of this config refuses to
 * bake a localhost `NEXT_PUBLIC_API_URL` into the client bundle.
 *
 * Same single source of truth as `npm run build` / `npm run build:vinext`: the
 * rule lives in `scripts/guard-production-env.mjs`, and this only invokes it.
 */
function productionApiUrlGuard(): Plugin {
  let checked = false;
  return {
    name: "seti:production-api-url-guard",
    apply: "build",
    buildStart() {
      // The RSC/SSR/client environments each start a build; check once.
      if (checked) return;
      checked = true;
      const refusal = productionApiUrlRefusal();
      if (refusal) {
        this.error(refusal);
      }
    },
  };
}

/**
 * The year the footer prints, stamped by the bundler rather than read at runtime.
 *
 * `LandingFooter.constants.ts` used to compute `new Date().getFullYear()` at module
 * scope, which is correct under `next build` (the value lands at build time and is
 * serialised into the HTML) and wrong under `build:vinext`: there the expression is
 * kept as an expression and evaluated when the chunk runs, and the deployed Worker's
 * clock answered 0, so the live footer read "© 1970 Seti" (#270).
 *
 * Stamping it HERE fixes that at the root: `define` substitutes the literal into every
 * bundle, so no clock is read at build time in the Worker, at request time, or in the
 * render. The date below is the build machine's, which is the year a build is named for.
 */
const BUILD_YEAR = String(new Date().getFullYear());

export default defineConfig({
  define: {
    __SETI_BUILD_YEAR__: JSON.stringify(BUILD_YEAR),
  },
  plugins: [
    productionApiUrlGuard(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
