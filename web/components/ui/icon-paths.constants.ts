/**
 * Hand-authored geometric icon set — 24×24, stroke-based, no fill.
 *
 * Deliberately not Lucide/Feather: an off-the-shelf set is the visual signature
 * of a generated UI, and adding a dependency to a repo that already inlines its
 * SVG (see the landing page) buys nothing. Every path below is a primitive —
 * lines, brackets, a paper plane — so there is nothing to get subtly wrong.
 */
export const ICON_PATHS = {
  home: ['m3 10 9-7 9 7', 'M5 9.2V20h14V9.2', 'M10 20v-6h4v6'],
  activity: ['M4 6.5h16', 'M4 12h16', 'M4 17.5h10'],
  profile: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  scan: ['M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8', 'M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8', 'M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16', 'M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16', 'M4 12h16'],
  send: ['m4 12 16-8-6 16-2.5-6.5L4 12Z'],
  add: ['M12 5.5v13', 'M5.5 12h13'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['m3 3 18 18', 'M10.6 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.1', 'M6.6 7.7A16.4 16.4 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.2-.9'],
  bell: ['M18 8.5a6 6 0 1 0-12 0c0 5.5-2.5 7-2.5 7h17S18 14 18 8.5', 'M13.7 20a2 2 0 0 1-3.4 0'],
  chevronRight: ['m9.5 5.5 6.5 6.5-6.5 6.5'],
  arrowRight: ['M4 12h15', 'm13 6 6 6-6 6'],
  close: ['m6 6 12 12', 'm18 6-12 12'],
  /* Two sheets, sharp corners like the rest of the set: the front one whole, the
     back one open on the edges the front covers. */
  copy: ['M9 9h12v12H9z', 'M15 6V4.5A1.5 1.5 0 0 0 13.5 3h-9A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H6'],
  /* Status marks. The word beside them carries the meaning; these carry it to a
     reader who cannot see the colour. */
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  alert: ['M12 4.2 2.6 20h18.8L12 4.2Z', 'M12 10v4.2', 'M12 17.3h.01'],
} as const;

export type IconName = keyof typeof ICON_PATHS;
