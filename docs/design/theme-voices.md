# Theme voices — design brief (oil-ui)

## Task
Replace the 15 palette-swap presets (themes that only recolor the site) with a
small curated set of **typographic identities**: switching a theme changes the
whole material of the site — type system, density, window dressing, structure,
and color together.

## Category / task / protagonist
- Category: personal writing platforms (markdown blogs).
- Reader's task: read and browse posts; author's task: publish.
- Above-the-fold protagonist: the latest posts + the site title.
- Benchmarks absorbed: Substack (serif system), newsletter/publication themes
  (mono system), gallery sites (white space).

## Chosen direction: "theme = voice"
One palette per mode is the floor; each preset additionally carries a
**face** — the part that makes it a material rather than a color:

- **Density** — the Tailwind spacing unit is a token (`--face-density`), so a
  preset can make the entire site airy or compact, not just one section.
- **Body voice** — font family (sans or serif), size, leading, tracking.
- **Display voice** — tracking + weight (broadsheet sets a heavy black serif,
  atelier sets a light display, ledger a tight technical sans).
- **Chrome voice** — labels (dates, bylines, tags, footer) in mono or not.
- **Prose furniture** — drop caps, always-underlined links.
- **Structural rules** — stroke width and style (ledger/console/broadsheet get
  visible rules; console gets dashed ones).
- **Atmosphere** — rare: a preset may replace the flat paper with a gradient
  (lantern).

## The set (7 + the comfortable default; 8 total)
| id | mode | voice |
| --- | --- | --- |
| `inkline` | dual | Ink on paper by day, ink on slate by night — the comfortable default. |
| `broadsheet` | dual | Front page: serif body, heavy serif display, mono bylines, rules, drop caps. |
| `folio` | dual | Quiet paperback: cream, lingering serif body, drop caps, forest thread. |
| `atelier` | dual | Gallery air: near-monochrome, light display, cornices of white space. |
| `ledger` | dual | Engineer's log: mono stamps, ruled lines, ledger green, underlined links. |
| `nocturne` | dark-only | Midnight reading chamber: moonlit amber, generous leading. |
| `console` | dark-only | Phosphor terminal: mono chrome, dashed rules, compiled look. |
| `lantern` | dark-only | Harbor night: gradient paper, lamplight amber. |

Dark-leaning but light-loving: 3 mono/gradient dark-only voices + 4 dual with
real light modes. `mode` drives whether the light/dark toggle renders; a
dark-only preset carries one look only (its `light` palette slot mirrors the
dark one so the engine stays uniform).

## Compatibility rules (do not break)
- `theme.preset` written by an older version (e.g. `raku`) must **not** reset
  the stored title/analytics: reads use a tolerant schema (unknown ids fall
  back to the default preset), writes stay strict (admin API keeps 400s).
- Old `radius` / `headingFont` admin knobs keep working as overrides; the face
  engine adds dials but removes none of the existing ones.
- Palette hex still lives only in `src/lib/theme.ts` + globals fallbacks.
