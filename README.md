# NewTab — Edge Edition

A Windows 11 / Edge-styled new tab override for Chrome and Edge, built on the
Fluent Design (WinUI 3) language: translucent Mica-like surfaces, rounded
corners, a single accent color, and quiet motion.

## Features

### Search

- **Multi-engine search** — switch between **Baidu** / **Bing** / **Google** /
  **GitHub** / **威科** / **Bilibili** with one click. Switching an engine hands
  focus straight back to the search box, so you can keep typing without
  clicking the input again.
- **Custom engine bar** — choose which engines appear in the search strip from
  the settings panel (at least one must stay enabled) and drag the rows to
  reorder them; the search strip mirrors the same order.
- **Live suggestions** — Baidu and Bing provide autocomplete as you type.
  `↑` / `↓` to highlight, `Enter` to accept, `Esc` to dismiss. Suggestions are
  filtered by substring, de-duplicated, and capped at 8.
- **Search history** — the last 30 queries are stored (deduped per engine) and
  shown in a popover toggled by clicking the page title. Each entry shows its
  engine and relative time; click one to replay it, or use the hover `×` to
  remove it.
- **Inline search preview** — pressing `Enter` no longer opens a new tab.
  A right-side drawer slides in and renders the chosen engine's results in an
  iframe, so you can keep refining the query without losing your place. Close
  it with `Esc`, the toolbar `✕`, or by clicking the dimmed background; use the
  toolbar `↗` to open the current results in a real tab. Engines that refuse
  to be embedded (Baidu sends `Content-Security-Policy: frame-ancestors`
  without `chrome-extension://`) automatically fall back to a real tab with a
  toast explaining why.

### Appearance

- **8 theme presets** — Edge Blue, Edge Dark, Pure Light, Sepia, Solarized,
  Slate, High Contrast, and Rosé Pine. Each is a complete palette.
- **Auto light/dark by local time** — toggle it on and pick which preset to use
  during the day and which at night, plus the two switch-over times. The page
  re-evaluates once a minute and whenever the tab becomes visible again.
- **Custom accent color** — pick from 7 swatches or enter any HEX value;
  hover/pressed shades are derived automatically.
- **Rainbow mode** — three tiers (vivid / soft / morandi) that tint the engine
  tabs, search button, and title glyphs. Soft and morandi derive from the live
  accent color so they always match the chosen theme.
- **Wallpapers** — set from URL, local file upload (max 10 MB), three solid
  presets, or six gradient presets (aurora / sunset / ocean / forest / mono /
  cyber). Every gradient adapts to light and dark themes.
- **Live filters** — sliders for **blur (0–20 px)**, **brightness (40–160 %)**,
  and **saturation (0–200 %)**.
- **Background line patterns** — optional animated geometric overlays
  (grid / topographic / radial). Thin, low-opacity, slow-drifting; they never
  compete with the content.
- **Custom title** — up to 14 latin characters or 7 CJK characters. The accent
  underline below the title resizes to match the title width.

### Tools

A slide-in panel with a calculator (with history), base converter,
Base64 / URL / Unicode encoder, Chinese amount-to-uppercase converter, color
picker, random picker, JSON formatter, UUID generator, and timestamp converter.

## File map

```
NewTab-Edge/
├── manifest.json       MV3 manifest, overrides the new tab
├── newtab.html         Main markup
├── styles.css          Theme presets, layout, components
├── script.js           Wallpaper / search / settings / theme logic
├── suggestions.js      Autocomplete dropdown + search history
├── preview.js          Inline search preview drawer
├── tools.js            Tools panel
├── panels.css          Shared panel framework (slide-left / -right)
├── suggestions.css     Suggestion dropdown + history popover styles
├── preview.css         Search preview drawer styles
├── tools.css           Tools panel styles
├── popup.html          Toolbar popup
├── popup.js            Toolbar popup logic
├── DESIGN.md           Design notes (themes, layering, motion)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder.
4. Open a new tab — done.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | focus the search box |
| `Enter` | run search (opens the inline preview drawer, not a new tab) |
| `↑` / `↓` | move through suggestions |
| `Esc` | close the suggestion dropdown, history popover, settings / tools panel, preview drawer, or fullscreen clock |

## Notes

- The wallpaper image URL must be reachable (CORS / network) for it to
  display; if it is behind a hotlink-protected CDN, use the file upload option
  instead.
- Settings persist per browser profile via `chrome.storage.local`. Use
  **RESET ALL** in the settings panel to restore defaults.
- The script prefers `chrome.storage.local` and silently falls back to
  `localStorage` when running outside an extension context (e.g. opening
  `newtab.html` directly for testing).
- The inline preview drawer only works for engines that permit iframe
  embedding. Baidu does not, so Baidu searches open a real tab.
