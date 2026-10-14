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

export default defineConfig({
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
