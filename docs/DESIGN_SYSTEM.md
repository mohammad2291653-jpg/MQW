# MQW v3 design system — Icy Sapphire

**Glossy Diamond White × Liquid Chrome Silver × Glossy Ink Black × Icy Sapphire Blue.** There is no purple, violet, lavender or mauve in the UI.

## Where it lives

- `src/app/globals.css` — `:root` tokens (`--mqw-*`), with the legacy names (`--primary`, `--ink`, …) aliased to them. The legacy sage/sand/purple literals were remapped to sapphire/chrome hues **at identical WCAG relative luminance**, so every original contrast ratio is preserved. The only exception is body ink, which moved darker (#23333b → #090d13).
- `src/app/theme-v3.css` — the identity layer: typography, glossy primary buttons, chrome secondary buttons, sapphire navigation pill, brand wordmark, top bar, hero frame, mobile navigation and motion.
- `src/components/evolution/evolution.css` — MQW 90 surfaces.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--mqw-bg` / `--mqw-bg-ice` / `--mqw-bg-frost` | #FFFFFF / #FAFCFF / #F5F9FD | page and quiet surfaces |
| `--mqw-surface-silver` | #EEF2F7 | hover and quiet fills |
| `--mqw-chrome-border` / `--mqw-chrome-soft` | #CBD5E1 / #E2E8F0 | edges |
| `--mqw-ink` / `-secondary` / `-tertiary` | #090D13 / #344256 / #4F5D71 | text (all ≥ 4.5:1 on white) |
| `--mqw-sapphire` / `-deep` / `-bright` | #0B63B6 / #084A8A / #1679B8 | primary actions, links, focus |
| `--mqw-ice` / `--mqw-cyan-reflection` | #BCEEFF / #5EDBFF | highlights only, never text |
| `--mqw-danger` / `--mqw-success` | #B42318 / #0F6B4F | semantic states |

## Rules

- 85–90% white, silver and ink by visual weight. Sapphire is reserved for actions, the active navigation item, focus and a few highlights.
- Gloss is selective: primary buttons and the active navigation item get a specular top highlight and an inner edge. Hero frames get a soft top sheen. Body cards stay solid white with a chrome edge, with no glass blur on content.
- Body text is solid near-black. Gradient text is limited to the MQW wordmark and short hero accents.
- Type: **Alexandria** (Arabic subset, 600/700) for headings, **IBM Plex Sans Arabic** (Arabic subset, 400/500/600) for body, and **Inter** (Latin subset, 400/600) as the only Latin and number face. All are OFL and served locally through Fontsource, with no Google request. Arabic is never letter-spaced.
- Performance:
  - Only the Arabic subsets of the Arabic faces load, so no Latin duplicates.
  - Core faces are warmed from server-rendered glyphs on the boot screen, which keeps CLS at 0.
  - The five primary destinations ship in the main bundle. MQW 90, the lesson player, reviews, study, settings and onboarding are lazy chunks, prefetched when idle after first content.
- Motion is 140–200 ms with a soft ease-out. `prefers-reduced-motion` and the in-app reduced-motion setting remove transforms and transitions.
- Touch targets are about 44 px. Every interactive element keeps a 3 px sapphire focus ring.
- Layouts vary by job: the dark Daily Compass, an asymmetric pillar mosaic, PPL cards with distinct top rails, and timelines. They are deliberately not one repeated card.
- The approved mockup is visual guidance only. Its percentages, tasks and palace art are not reproduced as data.
