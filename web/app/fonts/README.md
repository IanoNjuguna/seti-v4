# Fonts

The two families the web app paints with. Both are here rather than fetched by
`next/font/google` so a build never needs a route to Google and the exact files
that ship are reviewable in the diff.

- `poppins-{400,500,600,700}.woff2` — Poppins, static, latin subset. Body text,
  headings and the wordmark (`--font-sans`, `--font-brand`).
- `jetbrains-mono-var.woff2` — JetBrains Mono, VARIABLE (`wght` 400–800), latin
  subset. One file serves every weight, which is why there is one and not four:
  Google serves the same variable file for each requested weight (verified by
  md5 across the four responses). Figures, hashes and addresses (`--font-mono`).
- `OFL-poppins.txt`, `OFL-jetbrainsmono.txt` — the licences both families ship
  under. The SIL Open Font License requires the licence to travel with the font.

Provenance: `fonts.googleapis.com/css2?family=…` with a Chrome user agent, and
the `latin` block only (`unicode-range: U+0000-00FF`), downloaded once. To add a
weight, vendor the file and declare it in `app/layout.tsx`; do not reintroduce
`next/font/google`, which moves the files back into the build output.

Subset note: the latin block covers the digits, the KES copy and the punctuation
the product uses. A currency or a name outside it falls back to the system
stack, which is the behaviour every Google-served subset had.
