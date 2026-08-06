# NewTab — Cyberpunk Edition

A minimal Chrome / Edge new tab override with a cyberpunk HUD aesthetic.

## Features

- **Custom wallpaper** — set from URL, local file upload (max 10 MB), or pick from 6 built-in cyberpunk presets.
- **Adjustable filters** — live sliders for **blur (0-20 px)**, **brightness (40-160 %)**, and **saturation (0-200 %)**.
- **Multi-engine search** — switch between **Baidu** / **Bing** / **Google** with one click.
- **Persistent settings** — stored via `chrome.storage.local` (falls back to `localStorage` in dev).
- **Cyberpunk HUD** — angled corner brackets, scanlines, glitch animation on the title, neon glow accents.
- **Title typography** — classical European handwriting font (`Great Vibes`) at large size, weight 900.

## File map

```
CyberpunkNewTab/
├── manifest.json       MV3 manifest, overrides the new tab
├── newtab.html         Main markup
├── styles.css          Cyberpunk stylesheet
├── script.js           Wallpaper / search / settings logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select the `CyberpunkNewTab` folder.
4. Open a new tab — done.

## Keyboard shortcuts

- `/` — focus the search box
- `Enter` — run search
- `Esc` — close settings panel

## Notes

- The wallpaper image URL must be reachable (CORS / network) for it to display; if loading from a hotlink-protected CDN, use the file upload option instead.
- Settings persist per-browser-profile. Use the **RESET ALL** button in the settings panel to restore defaults.
- The script prefers `chrome.storage.local` and silently falls back to `localStorage` when running outside an extension context (e.g. opening `newtab.html` directly for testing).
