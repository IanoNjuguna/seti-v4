import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Docusaurus configuration for the Seti product docs.
 *
 * Two deliberate choices:
 *
 * 1. **The docs plugin reads `../docs`.** There is one source of truth for the
 *    written docs; this site renders them rather than holding a copy. Editing
 *    `docs/internal/prd.md` changes the published page, and the copy cannot drift.
 * 2. **`routeBasePath: '/'`.** `docs/README.md` is the landing page; the
 *    developer pages sit at the root (`/quickstart`, `/api-reference`) while the
 *    engineering documents live under `/internal/*` and are kept out of the
 *    developer sidebar by `sidebars.ts`.
 *
 * `SUMMARY.md` is excluded: it is GitBook's navigation file and would otherwise
 * render as a stray page. The GitBook configs are kept intact so the same docs
 * can be imported into GitBook later without a rewrite.
 */
const config: Config = {
  title: 'Seti',
  tagline: 'A neobank built for Nairobians',
  favicon: 'img/favicon.png',

  url: 'https://docs.seti.live',
  baseUrl: '/',

  organizationName: 'IanoNjuguna',
  projectName: 'seti-v4',

  // Throw rather than warn: a broken link in the docs is a real defect and the
  // build is the only thing that catches it.
  onBrokenLinks: 'throw',
  // Moved under `markdown.hooks` in Docusaurus v4; using the new location now
  // avoids the deprecation warning and the migration.
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          exclude: ['SUMMARY.md'],
          editUrl: 'https://github.com/IanoNjuguna/seti-v4/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Seti',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'developers',
          position: 'left',
          label: 'Developers',
        },
        {
          type: 'docSidebar',
          sidebarId: 'internal',
          position: 'left',
          label: 'Internal',
        },
        {
          href: 'https://github.com/IanoNjuguna/seti-v4',
          label: 'Repository',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Developers',
          items: [
            { label: 'Overview', to: '/' },
            { label: 'Quickstart', to: '/quickstart' },
            { label: 'API reference', to: '/api-reference' },
            { label: 'MCP server', to: '/mcp' },
          ],
        },
        {
          title: 'Internal',
          items: [
            { label: 'Product requirements', to: '/internal/prd' },
            { label: 'Fee routing', to: '/internal/fee-routing' },
          ],
        },
        {
          title: 'Repository',
          items: [
            {
              label: 'seti-v4 on GitHub',
              href: 'https://github.com/IanoNjuguna/seti-v4',
            },
          ],
        },
      ],
      copyright: `Seti is non-custodial with no fiat off-ramp in v1. Source of truth for the code: the repository, not these pages.`,
    },
    prism: {
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
