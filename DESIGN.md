# Edge / WinUI 3 NewTab — Design Notes

## 1. Visual Theme & Atmosphere

A Windows 11 / Edge-styled new tab page built on the **Fluent Design / WinUI 3**
language: Mica-like translucent surfaces, soft rounded corners, a restrained
accent color, and quiet motion. The page should feel like part of the browser
chrome rather than a separate "start page" product.

**Key characteristics**

- **Surfaces** — translucent panels (`--surface`) over the user's wallpaper,
  hairline borders, tight drop shadows that hug the panel instead of lifting it.
- **Accent** — a single `--accent` drives focus rings, active tabs, the title
  underline, and the search button. Users can override it per theme.
- **Typography** — `Inter` for UI, `JetBrains Mono` for numerics, code, and
  metadata (clock, engine labels, HEX values).
- **Motion** — Apple-style deceleration (`cubic-bezier(0.22, 1, 0.36, 1)`) on
  panels; a staggered entrance on first paint. Nothing bounces.
- **Restraint** — no glitch, no scanlines, no neon glow. Effects are limited to
  subtle inner highlights, a soft title underline, and optional background
  line patterns.

## 2. Theme presets

Eight presets, each a complete palette declared as `html.theme-<id>` in
`styles.css`. `script.js` (`applyTheme`) swaps the class; nothing else changes.

| ID | Mode | Family | Notes |
|---|---|---|---|
| `edge-blue` | light | standard | Default. Edge brand blue, gradient backdrop. |
| `edge-dark` | dark | standard | Cyan accent, deep blue-violet backdrop. |
| `pure-light` | light | paper | Near-monochrome; accent collapses to near-black. |
| `sepia` | light | paper | Warm paper, brown text; low-blue for long reading. |
| `solarized` | light | paper | Solarized Light palette. |
| `slate` | dark | muted | Neutral grey dark; low contrast, OLED-friendly. |
| `rosepine` | dark | muted | Rosé Pine mauve/pink dark. |
| `high-contrast` | dark | hc | Pure black/white, outline shadows instead of blur. |

Each preset sets the same variable set, so adding a preset is a single CSS
block plus one entry in `THEME_PRESETS` (script.js). Required variables:

```
--accent / -hover / -pressed / -light   --danger
--bg-gradient                            --surface / -solid / -hover / -pressed
--border / -strong                       --text-primary / -secondary / -tertiary
--shadow-sm / -md / -lg                  --edge-solid-color / -cream / -pure
--title-text-shadow                      --title-fill (dark presets override to #fff)
--hud-highlight                          --bg-pattern-color / -fade-top / -fade-bottom
--wp-aurora / -sunset / -ocean / -forest / -mono / -cyber
```

## 3. Accent override

`state.accentOverride` (hex or `null`) is written to `html` as inline
`--accent` / `-hover` / `-pressed` / `-light`. Inline styles win over the
preset classes by specificity, so the override layers on top of any theme.
Hover/pressed shades are derived with `color-mix()` rather than hardcoded.

## 4. Rainbow mode

Three tiers, all gated on `html[data-rainbow="<tier>"]`:

- **vivid** — desaturated ~20 % from the original neon set (yellow `#ffd60a`
  → `#d4b454`) so it stops bleeding on light backgrounds.
- **soft** / **morandi** — derived from the live `--accent` via `color-mix()`,
  so they adapt to the chosen theme instead of using a fixed RGB triplet.

Rainbow mode tints the engine tabs, the search button gradient, and the title
glyphs. The title underline mirrors the same palette (built in JS as a
multi-stop `linear-gradient`).

## 5. Wallpapers

- **Solid** (`type: 'color'`) — three presets that resolve a per-theme CSS
  variable so they follow light/dark switches.
- **Gradient** (`type: 'gradient'`) — six presets (`aurora`, `sunset`,
  `ocean`, `forest`, `mono`, `cyber`), each exposing `--wp-<id>` with a light
  and a dark variant per theme.
- **URL / upload** — user-supplied, stored as a data URL (upload) or URL.

Live filters: `--blur` (0–20 px), `--brightness` (40–160 %), `--saturation`
(0–200 %), applied to the `.wallpaper` layer only.

## 6. Background line patterns

Optional decorative overlay behind everything (`z-index: -2`):

| ID | Shape | Cycle |
|---|---|---|
| `grid` | 48 px square grid | 38 s |
| `topo` | topographic curves | 46 s |
| `radial` | concentric circles | 28 s |

Inline SVG (no external assets, no CSP issues), `stroke-width` 0.6–0.7, drawn
in `currentColor` bound to `--bg-pattern-color`. Opacity 0.055–0.075. The
`::before` overlay fades the pattern out at the top and bottom edges so it
never competes with the HUD chrome.

## 7. Layering

| z-index | Layer |
|---|---|
| `-3` … `-1` | wallpaper, bg-pattern, wallpaper overlay |
| `5` | `.hud-top` / `.hud-bottom` (fixed) |
| *auto* | `.stage` — deliberately **no** z-index; a viewport-sized stacking layer here would paint over the HUD and swallow clicks |
| `30` | `.search-row` |
| `50` | `.suggest-list` |
| `199` / `200` | panel backdrop / panel |
| `200` | toast |
| `300` | fullscreen clock |

## 8. Motion

```
--panel-ease-open:  cubic-bezier(0.22, 1, 0.36, 1)   /* EaseOutQuint */
--panel-ease-close: cubic-bezier(0.55, 0, 0.55, 0.2) /* sharper gather */
--panel-time-open:  420ms
--panel-time-close: 280ms
```

Open and close use different curves. CSS transitions can only declare one
timing per property at a time, so the un-opened rule carries the close timing
and the `.open` rule overrides it with the open timing; the browser picks the
right one based on which rule is in effect for the change.

Panels also delay their `visibility` flip until the transform finishes
(`visibility 0s linear var(--panel-time-close)`), otherwise the element
vanishes mid-animation and the close looks instant.

**Entrance** — a staggered sequence gated on `html:not(.page-entered)`:
wallpaper → HUD top/bottom → stage → title (fade + blur-clear) → search panel
(scale 0.97 → 1) → tabs → search row. Total ~700 ms. JS adds `.page-entered`
at 1100 ms so the selectors stop matching; `replayPageEntrance()` removes the
class, forces a reflow, and re-adds it to replay (fullscreen-clock exit,
BFCache restore).

## 9. Accessibility notes

- `:focus-visible` (not `:focus`) drives focus rings, so mouse clicks don't
  produce a ring while keyboard navigation does.
- The `high-contrast` preset uses outline shadows instead of blurred shadows
  and pushes text to pure white on pure black.
- All interactive elements are real `<button>` / `<input>` elements; the
  suggestion dropdown is `role="combobox"` + `role="listbox"` with
  `aria-expanded` maintained by `suggestions.js`.
- Motion is short and non-essential; nothing depends on an animation
  completing for the UI to be usable.
