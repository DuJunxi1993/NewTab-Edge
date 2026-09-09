
/* ================================================
   Settings panel — self-contained IIFE at the top
   of the file so the click handler is attached as soon
   as script.js loads (before any other code that might
   throw and prevent the rest from running).
   ================================================ */
(function setupSettingsPanel() {
  const btn = document.getElementById('settingsBtn');
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  const closeBtn = document.getElementById('closeSettings');
  if (!btn || !panel || !backdrop) {
    console.warn('[NewTab] settings panel elements missing:', { btn: !!btn, panel: !!panel, backdrop: !!backdrop });
    return;
  }
  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
    document.body.classList.add('settings-open');
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
    document.body.classList.remove('settings-open');
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    open();
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  // Backup: click anywhere on the document outside the panel and not
  // on the settings button itself also closes the panel
  document.addEventListener('click', function (e) {
    if (!panel.classList.contains('open')) return;
    if (e.target === btn || btn.contains(e.target)) return;
    if (panel.contains(e.target)) return;
    close();
  });
  // Escape to close
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });
  // Expose for cross-script calls
  window.openSettingsPanel = open;
  window.closeSettingsPanel = close;
})();


/* ================================================
   NewTab — Controller
   ================================================ */

// ---------- Built-in wallpapers (local presets + royalty-free Unsplash) ----------
const BUILTIN_WALLPAPERS = [
  // Solid color presets (theme-aware: the cssVar is set per theme)
  { id: 'edge-solid', type: 'color', cssVar: '--edge-solid-color', label: 'Edge Surface' },
  { id: 'edge-cream', type: 'color', cssVar: '--edge-cream-color', label: 'Warm Paper' },
  { id: 'edge-pure',  type: 'color', cssVar: '--edge-pure-color',  label: 'Pure White' },
  // Gradient presets. cssVar is a CSS variable that each theme exposes
  // with light + dark variants; applyWallpaper reads it.
  { id: 'aurora', type: 'gradient', cssVar: '--wp-aurora', label: 'Aurora' },
  { id: 'sunset', type: 'gradient', cssVar: '--wp-sunset', label: 'Sunset' },
  { id: 'ocean',  type: 'gradient', cssVar: '--wp-ocean',  label: 'Ocean' },
  { id: 'forest', type: 'gradient', cssVar: '--wp-forest', label: 'Forest' },
  { id: 'mono',   type: 'gradient', cssVar: '--wp-mono',   label: 'Mono' },
  { id: 'cyber',  type: 'gradient', cssVar: '--wp-cyber',  label: 'Cyber' },
];

// ---------- Search engines ----------
// `iframeFriendly` indicates whether the engine's SERP can be rendered
// inside a cross-origin <iframe>. Engines that return a strict
// Content-Security-Policy: frame-ancestors header (e.g. Baidu) will be
// blocked by Chromium when embedded from a chrome-extension:// page —
// `ERR_BLOCKED_BY_RESPONSE` shows up as "www.baidu.com 拒绝连接". We
// route those engines straight to a new tab and show a toast.
//
// `suggestUrl(q)` and `parseSuggestions(raw)` provide live
// autocomplete for the search input. Engines without these fields
// simply show no suggestions for that engine.
const ENGINES = {
  baidu: {
    label: 'BAIDU',
    url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
    iframeFriendly: false,
    suggestUrl: (q) =>
      `https://www.baidu.com/sugrec?pre=1&p=3&ie=utf-8&json=1&prod=pc&from=pc_web&wd=${encodeURIComponent(q)}`,
    parseSuggestions: (raw) => {
      try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(obj && obj.g)) return [];
        return obj.g
          .map((s) => (typeof s === 'object' && s ? s.q : null))
          .filter(Boolean);
      } catch (_) {
        return [];
      }
    },
  },
  bing: {
    label: 'BING',
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    iframeFriendly: true,
    suggestUrl: (q) =>
      `https://www.bing.com/AS/Suggestions?pt=page.serp&mkt=zh-cn&qry=${encodeURIComponent(q)}&cp=1&cvid=1`,
    // Bing returns a tiny HTML fragment: <ul class="sa_drw">...<li
    // class="sa_sg"><span>foo</span>...</li>...</ul>. Pull the visible
    // text out of every <li>sa_sg>.
    parseSuggestions: (raw) => {
      if (typeof raw !== 'string') return [];
      const out = [];
      const liRe = /<li\b[^>]*class="[^"]*\bsa_sg\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
      let m;
      while ((m = liRe.exec(raw)) !== null) {
        // Strip tags inside the <li> and decode a couple of common
        // HTML entities that Bing uses (mainly &amp; &lt; &gt;).
        const text = m[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        if (text && !out.includes(text)) out.push(text);
      }
      return out;
    },
  },
  google: {
    label: 'GOOGLE',
    url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    iframeFriendly: true,
    // Google's autocomplete endpoint requires an HTTP referer from
    // www.google.com; without it the response is a CAPTCHA. We mark
    // suggestions disabled so the dropdown stays empty for Google.
    suggestUrl: null,
    parseSuggestions: null,
  },
  github: {
    label: 'GITHUB',
    url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
    iframeFriendly: true,
    suggestUrl: null,
    parseSuggestions: null,
  },
  wkinfo: {
    label: '威科',
    url: (q) => `https://law.wkinfo.com.cn/legislation/list?simple=${encodeURIComponent(q)}`,
    iframeFriendly: true,
    suggestUrl: null,
    parseSuggestions: null,
  },
  bilibili: {
    label: 'BILIBILI',
    url: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
    iframeFriendly: true,
    suggestUrl: null,
    parseSuggestions: null,
  },
};

// Display order for both the main tab strip and the settings picker
const ENGINE_ORDER = ['baidu', 'bing', 'google', 'github', 'wkinfo', 'bilibili'];

// ---------- Theme presets ----------
// Each preset is a single source of truth for the page palette. The
// CSS side declares them as `html.theme-<id>` blocks; the JS side
// applies the matching class and (optionally) an `--accent-override`
// value for user-chosen accent colors.
//
// mode: 'light' | 'dark' — drives dark-mode override logic for the
//        wallpaper pickers and `prefers-color-scheme` fallback.
// family: 'standard' | 'paper' | 'muted' | 'hc' — coarse grouping for
//          the settings panel UI.
const THEME_PRESETS = [
  { id: 'edge-blue',   label: 'Edge Blue',  mode: 'light', family: 'standard' },
  { id: 'edge-dark',   label: 'Edge Dark',  mode: 'dark',  family: 'standard' },
  { id: 'pure-light',  label: 'Pure Light', mode: 'light', family: 'paper' },
  { id: 'sepia',       label: 'Sepia',      mode: 'light', family: 'paper' },
  { id: 'slate',       label: 'Slate',      mode: 'dark',  family: 'muted' },
  { id: 'high-contrast', label: 'High Contrast', mode: 'dark', family: 'hc' },
  { id: 'solarized',   label: 'Solarized',  mode: 'light', family: 'paper' },
  { id: 'rosepine',    label: 'Rosé Pine',  mode: 'dark',  family: 'muted' },
];

// Accent color presets — used by the color picker. Each is paired with
// a foreground-friendly text color for the swatch chip itself.
const ACCENT_SWATCHES = [
  { id: 'edge-blue', value: '#0067c0' },
  { id: 'cyan',      value: '#00b7c3' },
  { id: 'violet',    value: '#7c3aed' },
  { id: 'pink',      value: '#ec4899' },
  { id: 'rose',      value: '#fb7299' },
  { id: 'amber',     value: '#d97706' },
  { id: 'lime',      value: '#65a30d' },
];

// ---------- State ----------
const DEFAULT_STATE = {
  wallpaper: { type: 'builtin', value: BUILTIN_WALLPAPERS[0].id },
  blur: 0,
  brightness: 100,
  saturation: 100,
  engine: 'baidu',
  // Legacy field kept for backward compatibility. New code reads
  // `themeId`; this is only consulted at migration time.
  themeMode: 'auto',  // 'auto' | 'light' | 'dark'
  themeId: 'edge-blue',     // see THEME_PRESETS
  accentOverride: null,     // hex string or null → use preset default
  // Automatic light/dark switching by local time of day.
  autoTheme: false,
  autoLightThemeId: 'edge-blue',  // preset used during the day
  autoDarkThemeId: 'edge-dark',   // preset used at night
  autoLightStart: '07:00',        // day begins
  autoDarkStart: '19:00',         // night begins
  customTitle: '',
  rainbowMode: 'off',  // 'off' | 'vivid' | 'soft' | 'morandi'
  visibleEngines: null, // null = use default (all engines visible)
  preview: { open: false, url: '', engine: '', query: '' },
  history: [], // [{ q, engine, ts }], newest first, capped at 30
  bgPattern: 'off', // 'off' | 'grid' | 'topo' | 'radial'
};

let state = { ...DEFAULT_STATE };

// ---------- Storage helpers ----------
const storage = {
  get(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        const out = {};
        try {
          const raw = localStorage.getItem('newtab_state');
          const data = raw ? JSON.parse(raw) : {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => (out[k] = data[k]));
        } catch (e) {}
        resolve(out);
      }
    });
  },
  set(obj) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(obj, resolve);
      } else {
        try {
          const raw = localStorage.getItem('newtab_state');
          const data = raw ? JSON.parse(raw) : {};
          Object.assign(data, obj);
          localStorage.setItem('newtab_state', JSON.stringify(data));
        } catch (e) {}
        resolve();
      }
    });
  },
};

// ---------- Cross-context sync ----------
// The toolbar popup writes the same `state` object. When it does, an
// already-open new-tab page should reflect the change without a
// reload. `ignoreStorageUntil` suppresses the echo from our own
// persist() writes so we don't re-apply state we just saved.
let ignoreStorageUntil = 0;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.state) return;
    if (Date.now() < ignoreStorageUntil) return; // our own write
    const next = changes.state.newValue;
    if (!next || typeof next !== 'object') return;
    state = { ...state, ...next };
    applyTheme();
    applyRainbow();
    applyBgPattern();
    applyWallpaper();
    applyFilters();
    applyCustomTitle();
    renderEngineTabs();
    renderEnginePicker();
  });
}

// ---------- DOM refs ----------
const $ = (sel) => document.querySelector(sel);
const wallpaperEl = $('#wallpaper');
const blurSlider = $('#blurSlider');
const brightnessSlider = $('#brightnessSlider');
const saturationSlider = $('#saturationSlider');
const blurValue = $('#blurValue');
const brightnessValue = $('#brightnessValue');
const saturationValue = $('#saturationValue');
const searchInput = $('#searchInput');
const searchForm = $('#searchForm');
const searchBtn = $('#searchBtn');
const engineLabel = $('#engineLabel');
const hudClock = $('#hudClock');
const settingsBtn = $('#settingsBtn');
const closeSettingsBtn = $('#closeSettings');
const settingsPanel = $('#settingsPanel');
const wallpaperUrlInput = $('#wallpaperUrl');
const applyUrlBtn = $('#applyUrl');
const wallpaperFileInput = $('#wallpaperFile');
const fileHint = $('#fileHint');
const builtinGrid = $('#builtinGrid');
const resetBtn = $('#resetSettings');
const toastEl = $('#toast');
const urlGroup = $('#urlGroup');
const uploadGroup = $('#uploadGroup');
const builtinGroup = $('#builtinGroup');
const sourceTabs = document.querySelectorAll('#settingsPanel .seg-btn[data-src]');
const searchTabs = document.querySelectorAll('.tab');

// ---------- Clock ----------
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  if (hudClock) hudClock.textContent = `${hh}:${mm}:${ss}`;
  const fsTime = document.getElementById('fsClockTime');
  if (fsTime) fsTime.textContent = `${hh}:${mm}:${ss}`;
  const fsDate = document.getElementById('fsClockDate');
  if (fsDate) fsDate.textContent = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Wallpaper ----------
function applyWallpaper() {
  let url = '';
  let isColor = false;
  let isGradient = false;
  let gradientValue = '';
  if (state.wallpaper.type === 'color') {
    url = state.wallpaper.value;
    isColor = true;
  } else if (state.wallpaper.type === 'url') {
    url = state.wallpaper.value;
  } else if (state.wallpaper.type === 'upload') {
    url = state.wallpaper.value;
  } else if (state.wallpaper.type === 'builtin') {
    const found = BUILTIN_WALLPAPERS.find((w) => w.id === state.wallpaper.value);
    if (found) {
      if (found.type === 'color' && found.cssVar) {
        // Theme-aware: resolve the live CSS variable (e.g. --edge-solid-color)
        const cssColor = resolveColorFromCss(found.cssVar);
        url = cssColor || found.url || '';
        isColor = true;
      } else if (found.type === 'gradient' && found.cssVar) {
        gradientValue = resolveColorFromCss(found.cssVar) || '';
        isGradient = !!gradientValue;
      } else {
        url = found.url;
      }
    }
  }
  if (isColor) {
    wallpaperEl.style.backgroundImage = 'none';
    wallpaperEl.style.backgroundColor = url;
  } else if (isGradient) {
    wallpaperEl.style.backgroundImage = gradientValue;
    wallpaperEl.style.backgroundColor = 'transparent';
  } else if (url) {
    wallpaperEl.style.backgroundColor = 'transparent';
    wallpaperEl.style.backgroundImage = `url("${url}")`;
  }
}

function applyFilters() {
  document.documentElement.style.setProperty('--blur', `${state.blur}px`);
  document.documentElement.style.setProperty('--brightness', `${state.brightness}%`);
  document.documentElement.style.setProperty('--saturation', `${state.saturation}%`);
  blurSlider.value = state.blur;
  brightnessSlider.value = state.brightness;
  saturationSlider.value = state.saturation;
  blurValue.textContent = `${state.blur}px`;
  brightnessValue.textContent = `${state.brightness}%`;
  saturationValue.textContent = `${state.saturation}%`;
}

function syncSliders() {
  blurSlider.value = state.blur;
  brightnessSlider.value = state.brightness;
  saturationSlider.value = state.saturation;
  blurValue.textContent = `${state.blur}px`;
  brightnessValue.textContent = `${state.brightness}%`;
  saturationValue.textContent = `${state.saturation}%`;
}

function resolveColorFromCss(cssVarName) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}

function applyWallpaperColor() {
  // For builtin color presets, resolve the live CSS variable so the
  // wallpaper auto-switches when the system theme changes.
  if (state.wallpaper.type === 'builtin') {
    const found = BUILTIN_WALLPAPERS.find((w) => w.id === state.wallpaper.value);
    if (found && found.type === 'color' && found.cssVar) {
      const color = resolveColorFromCss(found.cssVar);
      if (color) {
        wallpaperEl.style.backgroundImage = 'none';
        wallpaperEl.style.backgroundColor = color;
        return true;
      }
    }
  }
  return false;
}
// ---------- Built-in grid ----------
function renderBuiltinGrid() {
  builtinGrid.innerHTML = '';
  BUILTIN_WALLPAPERS.forEach((w) => {
    const div = document.createElement('div');
    div.className = 'builtin-item';
    if (state.wallpaper.type === 'builtin' && state.wallpaper.value === w.id) {
      div.classList.add('active');
    }
    if (w.type === 'color') {
      div.style.backgroundImage = 'none';
      const cssColor = w.cssVar ? resolveColorFromCss(w.cssVar) : w.url;
      div.style.backgroundColor = cssColor || w.url;
    } else if (w.type === 'gradient' && w.cssVar) {
      // Resolve the live CSS variable so the swatch reflects the
      // currently-selected theme.
      div.style.backgroundImage = resolveColorFromCss(w.cssVar) || '';
      div.style.backgroundColor = 'transparent';
    } else {
      div.style.backgroundImage = `url("${w.url}")`;
    }
    div.title = w.label;
    div.dataset.id = w.id;
    div.addEventListener('click', () => {
      state.wallpaper = { type: 'builtin', value: w.id };
      renderBuiltinGrid();
      applyWallpaper();
      persist();
      toast('Wallpaper applied');
    });
    builtinGrid.appendChild(div);
  });
}

// ---------- Source tab UI ----------
function setSource(src) {
  sourceTabs.forEach((t) => t.classList.toggle('active', t.dataset.src === src));
  urlGroup.classList.toggle('hidden', src !== 'url');
  uploadGroup.classList.toggle('hidden', src !== 'upload');
  builtinGroup.classList.toggle('hidden', src !== 'builtin');
}

sourceTabs.forEach((t) =>
  t.addEventListener('click', () => setSource(t.dataset.src))
);

// ---------- File upload ----------
wallpaperFileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('File too large (max 10MB)', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.wallpaper = { type: 'upload', value: ev.target.result };
    applyWallpaper();
    persist();
    fileHint.textContent = file.name;
    toast('Wallpaper uploaded');
  };
  reader.readAsDataURL(file);
});

// ---------- URL apply ----------
applyUrlBtn.addEventListener('click', () => {
  const url = wallpaperUrlInput.value.trim();
  if (!url) {
    toast('Enter a URL first', true);
    return;
  }
  state.wallpaper = { type: 'url', value: url };
  applyWallpaper();
  persist();
  toast('Wallpaper applied');
});

wallpaperUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyUrlBtn.click();
  }
});

// ---------- Sliders ----------
blurSlider.addEventListener('input', (e) => {
  state.blur = Number(e.target.value);
  blurValue.textContent = `${state.blur}px`;
  document.documentElement.style.setProperty('--blur', `${state.blur}px`);
  persist();
});

brightnessSlider.addEventListener('input', (e) => {
  state.brightness = Number(e.target.value);
  brightnessValue.textContent = `${state.brightness}%`;
  document.documentElement.style.setProperty('--brightness', `${state.brightness}%`);
  persist();
});

saturationSlider.addEventListener('input', (e) => {
  state.saturation = Number(e.target.value);
  saturationValue.textContent = `${state.saturation}%`;
  document.documentElement.style.setProperty('--saturation', `${state.saturation}%`);
  persist();
});

// ---------- Search ----------
function visibleEngineIds() {
  if (Array.isArray(state.visibleEngines) && state.visibleEngines.length) {
    return state.visibleEngines.filter((id) => ENGINES[id]);
  }
  return ENGINE_ORDER.filter((id) => ENGINES[id]);
}

function renderEngineTabs() {
  const visible = new Set(visibleEngineIds());
  // If the active engine is hidden (just toggled off), fall back to the
  // first remaining visible engine.
  if (!visible.has(state.engine)) {
    state.engine = visibleEngineIds()[0] || 'baidu';
  }
  // Reorder the live DOM nodes to match the user's saved order, then
  // toggle visibility + active state. We use appendChild to move nodes
  // (idempotent: appending an existing child just moves it).
  const container = searchTabs[0]?.parentElement;
  if (container) {
    visibleEngineIds().forEach((id) => {
      const node = Array.from(searchTabs).find((t) => t.dataset.engine === id);
      if (node) container.appendChild(node);
    });
  }
  searchTabs.forEach((t) => {
    const id = t.dataset.engine;
    const show = visible.has(id);
    t.hidden = !show;
    t.style.display = show ? '' : 'none';
    t.classList.toggle('active', show && id === state.engine);
  });
  engineLabel.textContent = ENGINES[state.engine]
    ? ENGINES[state.engine].label.charAt(0) + ENGINES[state.engine].label.slice(1).toLowerCase()
    : '';
}

function setEngine(name) {
  if (!ENGINES[name]) return;
  if (!visibleEngineIds().includes(name)) return;
  state.engine = name;
  renderEngineTabs();
  persist();
}

// Clicking an engine tab moves focus to that <button>, which used to
// leave the search input blurred — the user had to click the input
// again before typing. Hand focus straight back to the input after
// the switch. focusInput() skips the refocus if the user already has
// a text field focused, which can't be the case here.
searchTabs.forEach((t) =>
  t.addEventListener('click', () => {
    setEngine(t.dataset.engine);
    focusInput({ force: true });
  })
);

function renderEnginePicker() {
  const picker = document.getElementById('enginePicker');
  if (!picker) return;
  picker.innerHTML = '';
  const visible = new Set(visibleEngineIds());
  // Iterate the user's saved order; any new engines (added in a later
  // build) that aren't in the saved list still get appended at the end
  // so users can reorder/hide them too.
  const order = orderedEngineIds();
  order.forEach((id) => {
    const row = document.createElement('div');
    row.className = 'engine-pick';
    row.draggable = true;
    row.dataset.engine = id;

    // Drag handle (visual affordance — the whole row is also draggable).
    const handle = document.createElement('span');
    handle.className = 'engine-pick-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.engine = id;
    cb.checked = visible.has(id);
    cb.addEventListener('change', () => {
      const current = new Set(visibleEngineIds());
      if (cb.checked) current.add(id);
      else current.delete(id);
      // Enforce "at least one visible": if user tried to disable the
      // last one, silently revert and notify.
      if (current.size === 0) {
        cb.checked = true;
        toast('至少保留一个搜索引擎', true);
        return;
      }
      // Preserve the current row order; just toggle membership.
      state.visibleEngines = orderedEngineIds().filter((k) => current.has(k));
      renderEngineTabs();
      renderEnginePicker();
      persist();
    });

    const text = document.createElement('span');
    text.className = 'engine-pick-text';
    text.textContent = ENGINES[id].label.charAt(0) + ENGINES[id].label.slice(1).toLowerCase();

    // "Hidden" badge for engines the user has currently disabled.
    if (!cb.checked) {
      const hidden = document.createElement('span');
      hidden.className = 'engine-pick-hidden';
      hidden.textContent = 'hidden';
      row.appendChild(hidden);
    }

    row.appendChild(handle);
    row.appendChild(cb);
    row.appendChild(text);
    picker.appendChild(row);

    // ----- HTML5 drag-and-drop wiring -----
    row.addEventListener('dragstart', (e) => {
      // Required for Firefox; dataTransfer.setData is needed for any
      // real cross-element drag to fire `drop`.
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      // Clear any residual indicator on the picker
      picker.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
        el.classList.remove('drop-before', 'drop-after');
      });
    });
    row.addEventListener('dragover', (e) => {
      // Only honour "move" drags originating from this picker.
      if (!Array.from(e.dataTransfer.types).includes('text/plain')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      // Clear sibling indicators so only one row shows the insertion line.
      picker.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
        if (el !== row) el.classList.remove('drop-before', 'drop-after');
      });
      row.classList.toggle('drop-before', before);
      row.classList.toggle('drop-after', !before);
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drop-before', 'drop-after');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === id) return;
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      reorderEngine(draggedId, id, before);
    });
  });
}

// Order to render the picker in: starts from the user's saved order, then
// appends any new engines (known to the build but not in the saved list).
function orderedEngineIds() {
  const saved = Array.isArray(state.visibleEngines) ? state.visibleEngines : [];
  const known = ENGINE_ORDER.filter((id) => ENGINES[id]);
  const out = saved.filter((id) => ENGINES[id]);
  known.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

function reorderEngine(draggedId, targetId, before) {
  if (!ENGINES[draggedId] || !ENGINES[targetId] || draggedId === targetId) return;
  const list = orderedEngineIds().slice();
  const fromIdx = list.indexOf(draggedId);
  if (fromIdx === -1) return;
  list.splice(fromIdx, 1);
  let toIdx = list.indexOf(targetId);
  if (toIdx === -1) return;
  if (!before) toIdx += 1;
  list.splice(toIdx, 0, draggedId);
  state.visibleEngines = list;
  renderEngineTabs();
  renderEnginePicker();
  persist();
}

function performSearch(e) {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) {
    toast('Enter a query first', true);
    focusInput({ force: true });
    return;
  }
  const engine = ENGINES[state.engine];
  if (!engine) {
    toast('No search engine selected', true);
    return;
  }
  const url = engine.url(q);
  // Record the query in history. suggestions.js exposes the API; if
  // that script hasn't loaded yet (extremely rare), we still write
  // directly to state so it survives a reload.
  if (typeof window.searchSuggestions === 'object' &&
      typeof window.searchSuggestions.recordHistory === 'function') {
    window.searchSuggestions.recordHistory(q, state.engine);
  } else if (Array.isArray(state.history)) {
    state.history.unshift({ q, engine: state.engine, ts: Date.now() });
    if (state.history.length > 30) state.history.length = 30;
    persist();
  }
  // Some engines (e.g. Baidu) ship a strict
  // `Content-Security-Policy: frame-ancestors` header that excludes
  // `chrome-extension://`. Chromium refuses to render those SERPs in
  // our iframe drawer. For those engines, open a real tab instead and
  // let the user know why.
  if (engine.iframeFriendly === false) {
    window.open(url, '_blank', 'noopener');
    toast(`${engine.label.charAt(0) + engine.label.slice(1).toLowerCase()} 拒绝嵌入，已在新标签页打开`);
    focusInput();
    return;
  }
  // Open the preview panel instead of a new tab. preview.js exposes
  // window.openSearchPreview(query, engine, url); it writes the URL
  // into state.preview so the same query survives an NTP reload
  // within the session.
  if (typeof window.openSearchPreview === 'function') {
    const ok = window.openSearchPreview(q, state.engine, url);
    if (!ok) window.open(url, '_blank', 'noopener');
  } else {
    window.open(url, '_blank', 'noopener');
  }
  // Keep focus on the input — the user usually wants to refine the
  // query next. We deliberately do NOT refocus if focus has moved to
  // an element inside the preview iframe (the user may have clicked
  // a result inside).
  focusInput();
}

searchForm.addEventListener('submit', performSearch);

// Block the Enter key while an IME composition is in progress. Without
// this guard, hitting Enter to confirm a Chinese/Japanese/Korean
// candidate can trigger implicit form submission, which moves focus
// to the submit button and breaks the next keystroke.
searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  // `isComposing` is true during IME composition (the spec'd signal);
  // `keyCode === 229` is the legacy Chromium signal for "still
  // composing". Either one means: do NOT submit.
  if (e.isComposing || e.keyCode === 229) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
});
searchBtn.addEventListener('click', performSearch);

// ---------- Settings panel ----------
settingsBtn?.addEventListener('click', () => {
  if (!settingsPanel) return;
  // Mutual exclusion with the search preview panel
  if (typeof window.closeSearchPreview === 'function') window.closeSearchPreview();
  settingsPanel.classList.add('open');
  settingsPanel.setAttribute('aria-hidden', 'false');
  document.getElementById('settingsBackdrop')?.classList.add('open');
});

closeSettingsBtn?.addEventListener('click', closeSettings);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsPanel.classList.contains('open')) {
    closeSettings();
  }
  // "/" focuses the search box — but never during IME composition,
  // or we'd swallow the "/" candidate the user is currently typing.
  if (e.key === '/' && !e.isComposing && e.keyCode !== 229 && document.activeElement !== searchInput) {
    e.preventDefault();
    focusInput();
  }
});

function closeSettings() {
  if (!settingsPanel) return;
  settingsPanel.classList.remove('open');
  settingsPanel.setAttribute('aria-hidden', 'true');
  document.getElementById('settingsBackdrop')?.classList.remove('open');
}

// Robust click-outside-to-close for settings panel (catches clicks even
// when the backdrop somehow doesn't receive them)
document.addEventListener('click', (e) => {
  if (!settingsPanel || !settingsPanel.classList.contains('open')) return;
  if (e.target.closest('#settingsPanel')) return; // click inside panel
  if (e.target.closest('.settings-btn-container, .hud-btn-circular')) return; // click on the gear
  if (e.target === settingsBtn) return;
  closeSettings();
});

// ---------- Reset ----------
resetBtn.addEventListener('click', () => {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  // Reset visible engines to the built-in defaults
  state.visibleEngines = ENGINE_ORDER.slice();
  // Close any open preview panel + clear its stored URL.
  if (typeof window.closeSearchPreview === 'function') window.closeSearchPreview();
  state.preview = { open: false, url: '', engine: '', query: '' };
  wallpaperUrlInput.value = '';
  fileHint.textContent = 'No file selected';
  applyWallpaper();
  applyFilters();
  renderBuiltinGrid();
  renderEngineTabs();
  renderEnginePicker();
  setSource('url');
  applyTheme();
  applyRainbow();
  state.bgPattern = 'off';
  applyBgPattern();
  renderBgPatternPicker();
  persist();
  toast('Settings reset');
});

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, warn = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('warn', warn);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ---------- Persist ----------
let persistTimer = null;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    // Suppress the storage.onChanged echo of our own write (see the
    // cross-context sync listener above).
    ignoreStorageUntil = Date.now() + 500;
    storage.set({ state });
  }, 250);
}

// ---------- Fullscreen clock (click time -> big clock, click anywhere to exit) ----------
(function fullscreenClock() {
  const overlay = document.getElementById('fullscreenClock');
  const trigger = document.getElementById('hudClockBtn');
  if (!overlay || !trigger) return;

  function open() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('fullscreen-clock-active');
  }
  function close() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.getElementById('toolsBackdrop')?.classList.remove('open');
    document.documentElement.classList.remove('fullscreen-clock-active');
    // Replay the page entrance animation so coming back from the
    // big-clock view feels orchestrated, not abrupt.
    replayPageEntrance();
  }

  trigger.addEventListener('click', open);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });
})();

// ---------- Settings panel: click backdrop to close (consistent with tools panel) ----------
(function settingsBackdropClose() {
  const backdrop = document.getElementById('settingsBackdrop');
  const panel = document.getElementById('settingsPanel');
  if (!backdrop || !panel) return;
  backdrop.addEventListener('click', () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });
})();
// ---------- Init ----------
async function init() {
  const { state: saved } = await storage.get('state');
  if (saved && typeof saved === 'object') {
    state = { ...DEFAULT_STATE, ...saved };
    // Migrate legacy boolean rainbowMode (true->vivid, false->off)
    if (state.rainbowMode === true) state.rainbowMode = 'vivid';
    else if (state.rainbowMode === false || state.rainbowMode === undefined) state.rainbowMode = 'off';
    else if (!RAINBOW_PALETTES[state.rainbowMode]) state.rainbowMode = 'off';
    // Migrate legacy themeMode → themeId (only if the user never set
    // an explicit themeId before; we keep their old light/dark choice).
    if (!THEME_PRESETS.some((p) => p.id === state.themeId)) {
      if (state.themeMode === 'dark') state.themeId = 'edge-dark';
      else if (state.themeMode === 'light') state.themeId = 'edge-blue';
      else state.themeId = 'edge-blue';
    }
    // Sanitise accentOverride — must be a valid hex string, else null.
    if (state.accentOverride != null) {
      if (typeof state.accentOverride !== 'string' ||
          !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(state.accentOverride)) {
        state.accentOverride = null;
      }
    }
    // Normalise the auto light/dark schedule.
    state.autoTheme = !!state.autoTheme;
    if (!THEME_PRESETS.some((p) => p.id === state.autoLightThemeId)) {
      state.autoLightThemeId = 'edge-blue';
    }
    if (!THEME_PRESETS.some((p) => p.id === state.autoDarkThemeId)) {
      state.autoDarkThemeId = 'edge-dark';
    }
    if (parseHHMM(state.autoLightStart) == null) state.autoLightStart = '07:00';
    if (parseHHMM(state.autoDarkStart) == null) state.autoDarkStart = '19:00';
  }
  // Resolve visibleEngines: legacy null/missing → all visible; sanitise
  // any unknown ids (e.g. engines removed in a later build).
  if (!Array.isArray(state.visibleEngines)) {
    state.visibleEngines = ENGINE_ORDER.slice();
  } else {
    state.visibleEngines = state.visibleEngines.filter((id) => ENGINES[id]);
  }
  // Guarantee at least one visible engine; if none, fall back to default
  if (state.visibleEngines.length === 0) {
    state.visibleEngines = ENGINE_ORDER.slice();
  }
  // Ensure active engine is in the visible set; otherwise fall back to
  // the first visible engine.
  if (!state.visibleEngines.includes(state.engine)) {
    state.engine = state.visibleEngines[0];
  }
  // Normalise preview state: always start closed on a fresh NTP
  // load (no auto-restore across browser sessions). The iframe is
  // also never re-created here — preview.js handles re-mount on
  // demand.
  if (!state.preview || typeof state.preview !== 'object') {
    state.preview = { open: false, url: '', engine: '', query: '' };
  } else {
    state.preview.open = false;
  }
  applyWallpaper();
  applyFilters();
  renderBuiltinGrid();
  renderEngineTabs();
  renderEnginePicker();
  setSource('url');
  applyTheme();
  applyRainbow();
  applyBgPattern();
  renderBgPatternPicker();
  // Mark the entrance sequence as "playing" by leaving the
  // html:not(.page-entered) selector in effect. After ~900ms (longer
  // than the longest delay+duration) we add `.page-entered` so the
  // CSS animations don't sit there pinned at their final state.
  setTimeout(() => document.documentElement.classList.add('page-entered'), 1100);
  // No explicit searchInput.focus() here: the input has the `autofocus`
  // attribute, which the browser handles at parse time and which
  // cooperates better with Chromium's new-tab focus model. Calling
  // .focus() from script runs after the URL bar has already claimed
  // focus, and can be overridden / lost during async storage reads.
  bindThemeListener();
  bindThemeControls();
  bindRainbowControls();
  bindTitleInput();
}

// ---- Focus management: aggressively claim the input when the tab
// becomes visible. Edge's new-tab page normally leaves focus in the
// omnibox, and Chromium has no API to override that from an extension.
// We re-claim focus here whenever the page becomes visible AND the
// user hasn't already focused something else on the page.
//
// `focusInput` is also reused by:
//
//   * `visibilitychange` — fires when the user activates the tab.
//   * `pageshow`         — fires on load + BFCache restore.
//   * a one-shot rAF after init — the omnibox only releases focus
//     after the page finishes its initial layout; one animation frame
//     is enough for most cases.
//   * the empty-query branch of `performSearch` — keep the input
//     focused after a failed submit.
//
function focusInput({ force = false } = {}) {
  const ae = document.activeElement;
  // Skip if the user is already typing in the search input.
  if (ae === searchInput) return;
  // Skip if the user has focused another text-entry on the page
  // (e.g. an option in the settings panel). `force` opts out of this
  // guard for the omnibox-reclaim path.
  if (!force && ae && ae !== document.body && ae !== document.documentElement) {
    const tag = ae.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable) return;
  }
  searchInput.focus({ preventScroll: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  focusInput({ force: true });
  // Coming back from sleep / another tab may have crossed a schedule
  // boundary, so re-check the auto light/dark theme immediately
  // instead of waiting for the next minute tick.
  if (state.autoTheme && appliedThemeId !== null && resolveThemeId() !== appliedThemeId) {
    applyTheme();
  }
});

window.addEventListener('pageshow', (e) => {
  focusInput({ force: true });
  // BFCache restore (persisted=true) — replay the entrance animation.
  if (e.persisted) replayPageEntrance();
});

// One extra claim after the first paint, in case the omnibox grabbed
// focus back between `pageshow` and now.
requestAnimationFrame(() => focusInput({ force: true }));

// ---- Page entrance animation ----
// CSS keyframes are gated on `html:not(.page-entered)`. After the
// entrance sequence finishes we add `.page-entered` so subsequent
// re-renders don't re-trigger the animation. To replay (e.g. when
// exiting the fullscreen clock or restoring from BFCache), remove
// the class, force a reflow, and add it back.
function replayPageEntrance() {
  const html = document.documentElement;
  if (html.classList.contains('page-entered')) {
    html.classList.remove('page-entered');
    // Force reflow so the browser re-evaluates the :not(.page-entered)
    // selector and restarts the CSS animations.
    void html.offsetWidth;
    html.classList.add('page-entered');
  } else {
    html.classList.add('page-entered');
  }
}

const RAINBOW_PALETTES = {
  // Vivid desaturated ~20% from the original neon set: yellow
  // #ffd60a becomes #d4b454 (no longer bleeds on white), pink
  // #ff2e88 becomes #d96aa0, etc. This is what fixes the "刺眼"
  // complaint while keeping the same playful intent.
  vivid:   ['#5cc9d8', '#d96aa0', '#d4b454', '#8acf63', '#d6884a', '#a98ce0', '#5cd49a'],
  soft:    ['#7fd4e6', '#ef9ec4', '#ecd98a', '#b8d9a1', '#e5b48f', '#b3a6df', '#8fdcbe'],
  morandi: ['#8aa8b5', '#c2a0ac', '#c9b98f', '#a5b29a', '#c2a48c', '#a8a0bd', '#99b3a8'],
};

function countChineseChars(s) {
  // Count CJK ideographs (CJK Unified Ideographs blocks)
  const m = s.match(/[\u3400-\u9FFF]/g);
  return m ? m.length : 0;
}

function applyCustomTitle() {
  const raw = (state.customTitle || '').trim();
  const cn = countChineseChars(raw);
  const total = raw.length;
  // Rule: if any Chinese, cap at 7 CN (and total <= 14 to match input maxlength)
  // Otherwise cap at 14 total chars
  let valid = true;
  let reason = '';
  if (cn > 0 && cn > 7) { valid = false; reason = '中文最多 7 个汉字'; }
  else if (cn === 0 && total > 14) { valid = false; reason = '英文 / 数字最多 14 字符'; }
  // Use custom text if valid AND non-empty; otherwise default to NETRUNNER
  const finalTitle = (valid && raw) ? raw : 'NETRUNNER';
  // Update browser tab title
  document.title = (raw && valid) ? (finalTitle + ' - NewTab') : 'NewTab';

  // Update visible <h1 class=.title.>NETRUNNER</h1>
  const titleEl = document.querySelector('.title');
  if (titleEl) {
    if (state.rainbowMode !== 'off') {
      // Rainbow mode: one solid color per glyph (built via textContent
      // chunks, so user input can never inject markup)
      const colors = RAINBOW_PALETTES[state.rainbowMode] || RAINBOW_PALETTES.vivid;
      titleEl.textContent = '';
      [...finalTitle].forEach((ch, i) => {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.color = colors[i % colors.length];
        titleEl.appendChild(span);
      });
      // Mirror the same palette onto the title underline so the bar
      // echoes the glyph colours. We smooth the endpoints with a
      // touch of transparency so the bar fades to the page background
      // at both ends rather than cutting off hard.
      const n = colors.length;
      const stops = colors.map((c, i) => {
        const pct = (i / Math.max(1, n - 1)) * 80 + 10; // 10%..90%
        return `${c} ${pct.toFixed(1)}%`;
      }).join(', ');
      const rainbowBg = `linear-gradient(90deg, transparent 0%, ${stops}, transparent 100%)`;
      titleEl.style.setProperty('--title-underline-rainbow', rainbowBg);
      titleEl.setAttribute('data-rainbow-underline', '1');
    } else {
      titleEl.textContent = finalTitle;
      titleEl.removeAttribute('data-rainbow-underline');
      titleEl.style.removeProperty('--title-underline-rainbow');
    }
  }

  // Show feedback
  const counter = document.getElementById('titleCount');
  if (counter) {
    counter.textContent = `${total} / ${cn > 0 ? '7 中' : '14 英'}`;
    counter.style.color = valid ? '' : 'var(--danger)';
  }
  const input = document.getElementById('customTitle');
  if (input) {
    const hint = input.nextElementSibling;
    if (hint) hint.textContent = valid ? '英文 / 数字 ≤ 14 字符 · 中文 ≤ 7 汉字' : reason;
    input.style.borderColor = valid ? '' : 'var(--danger)';
  }
  // Resize the underline so it stays "略短一点" relative to the new
  // title text. Done after the DOM is updated above.
  fitTitleUnderline();
}

function bindTitleInput() {
  const input = document.getElementById('customTitle');
  if (!input) return;
  input.addEventListener('input', () => {
    state.customTitle = input.value;
    applyCustomTitle();
    persist();
  });
  // Initialize from state
  input.value = state.customTitle || '';
  applyCustomTitle();
}
// Parse "HH:MM" into minutes since midnight. Returns null for junk.
function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Which side of the day are we on, given the configured schedule?
// Returns true for "day". Handles a schedule that wraps midnight
// (e.g. day 22:00 -> night 06:00).
function isDaytime(now) {
  const lightStart = parseHHMM(state.autoLightStart);
  const darkStart = parseHHMM(state.autoDarkStart);
  const ls = lightStart == null ? 7 * 60 : lightStart;
  const ds = darkStart == null ? 19 * 60 : darkStart;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (ls === ds) return true; // degenerate config: stay light
  if (ls < ds) return mins >= ls && mins < ds;
  return mins >= ls || mins < ds; // wraps midnight
}

// The theme actually in effect right now. When auto switching is off
// this is just the user's manual pick.
function resolveThemeId(now) {
  const fallback = THEME_PRESETS.some((p) => p.id === state.themeId)
    ? state.themeId
    : THEME_PRESETS[0].id;
  if (!state.autoTheme) return fallback;
  const day = isDaytime(now || new Date());
  const want = day ? state.autoLightThemeId : state.autoDarkThemeId;
  if (THEME_PRESETS.some((p) => p.id === want)) return want;
  return day ? 'edge-blue' : 'edge-dark';
}

// The preset id currently painted on <html>. Tracked so the auto
// light/dark timer can skip redundant re-applies.
let appliedThemeId = null;

function applyTheme() {
  const html = document.documentElement;
  // Remove every preset class, then add the active one. When auto
  // light/dark is on, the active one comes from the schedule.
  THEME_PRESETS.forEach((p) => html.classList.remove('theme-' + p.id));
  const effectiveId = resolveThemeId();
  const preset = THEME_PRESETS.find((p) => p.id === effectiveId) || THEME_PRESETS[0];
  html.classList.add('theme-' + preset.id);
  appliedThemeId = preset.id;

  // Set the mode class so any code that gates on .theme-dark /
  // .theme-light (e.g. wallpaper solid presets) keeps working.
  html.classList.remove('theme-dark', 'theme-light');
  if (preset.mode === 'dark') html.classList.add('theme-dark');
  else html.classList.add('theme-light');

  // Accent override: write CSS vars on the element so they win over
  // the preset's --accent. We also generate hover / pressed shades by
  // darkening the input value via color-mix (well-supported in Chromium).
  if (state.accentOverride && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(state.accentOverride)) {
    const base = state.accentOverride.toLowerCase();
    html.style.setProperty('--accent', base);
    html.style.setProperty('--accent-hover', `color-mix(in srgb, ${base} 85%, white)`);
    html.style.setProperty('--accent-pressed', `color-mix(in srgb, ${base} 75%, black)`);
    html.style.setProperty('--accent-light', `color-mix(in srgb, ${base} 12%, transparent)`);
  } else {
    html.style.removeProperty('--accent');
    html.style.removeProperty('--accent-hover');
    html.style.removeProperty('--accent-pressed');
    html.style.removeProperty('--accent-light');
  }

  // Sync the new theme grid (added by renderThemePicker). The active
  // card reflects the *effective* theme, which under auto switching
  // is whichever preset the schedule picked.
  const grid = document.getElementById('themeGrid');
  document.querySelectorAll('[data-theme-pick]').forEach((el) => {
    el.classList.toggle('active', el.dataset.themePick === preset.id);
  });
  // While auto switching is on, the manual grid is inert — the two
  // selects in the auto section drive the theme instead.
  if (grid) grid.classList.toggle('auto-disabled', !!state.autoTheme);
  const gridHint = document.getElementById('themeGridHint');
  if (gridHint) {
    gridHint.textContent = state.autoTheme
      ? '自动切换中 · 由下方「自动明暗」的配置决定'
      : '8 套主题预设 · 覆盖页面所有色板';
  }
  syncAutoThemeControls();
  // Sync the accent swatch row + custom input.
  const swatchRoot = document.getElementById('accentSwatches');
  if (swatchRoot) {
    swatchRoot.querySelectorAll('[data-accent]').forEach((el) => {
      el.classList.toggle('active', el.dataset.accent === (state.accentOverride || ''));
    });
  }
  const accentInput = document.getElementById('accentCustomInput');
  if (accentInput) accentInput.value = state.accentOverride || '';

  // Re-resolve wallpaper color (it reads CSS vars which just changed)
  if (!applyWallpaperColor()) applyWallpaper();
  renderBuiltinGrid();
  // Theme may shift the title's effective width (font fallback etc.).
  fitTitleUnderline();
}

// Measure the rendered title and resize the underline pseudo-element to
// match (slightly shorter). Called after every title render and on
// theme change; ResizeObserver keeps it in sync with later reflows.
let titleUnderlineObs = null;
function fitTitleUnderline() {
  const titleEl = document.querySelector('.title');
  if (!titleEl) return;
  // The underline is rendered via .title::after in CSS. We can't set
  // its width from JS directly (pseudo-elements are read-mostly from
  // CSS), but we CAN size the title itself with inline padding to give
  // the underline the visual width we want. The simpler approach is
  // to set a CSS variable that the pseudo-element uses.
  const w = titleEl.getBoundingClientRect().width;
  // Cap at 0.55 of the title width so the line is "略短一点" (per
  // user feedback). Min 28px so single-char titles still get a
  // visible line.
  const target = Math.max(28, Math.min(w * 0.55, w - 8));
  titleEl.style.setProperty('--title-underline-w', target + 'px');
  // Lazily start a ResizeObserver so we follow future reflows
  // (rainbow toggle changes the DOM children, font-loading events,
  // theme gradient widths, etc.).
  if (titleUnderlineObs) titleUnderlineObs.disconnect();
  titleUnderlineObs = new ResizeObserver(() => fitTitleUnderline());
  titleUnderlineObs.observe(titleEl);
}

function setTheme(themeId) {
  if (!THEME_PRESETS.some((p) => p.id === themeId)) return;
  state.themeId = themeId;
  // Keep legacy themeMode in sync so wallpaper color presets pick the
  // right side (light vs dark).
  const preset = THEME_PRESETS.find((p) => p.id === themeId);
  state.themeMode = preset.mode;
  applyTheme();
  persist();
}

function setAccentOverride(hex) {
  if (hex == null || hex === '') {
    state.accentOverride = null;
  } else if (typeof hex === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) {
    state.accentOverride = hex.toLowerCase();
  } else {
    return; // ignore invalid
  }
  applyTheme();
  persist();
}

function setBgPattern(id) {
  const allowed = ['off', 'grid', 'topo', 'radial'];
  if (!allowed.includes(id)) return;
  state.bgPattern = id;
  applyBgPattern();
  persist();
}

function applyBgPattern() {
  const html = document.documentElement;
  if (state.bgPattern && state.bgPattern !== 'off') {
    html.setAttribute('data-pattern', state.bgPattern);
  } else {
    html.removeAttribute('data-pattern');
  }
  // Sync the segmented buttons in the settings panel (added by
  // renderBgPatternPicker).
  document.querySelectorAll('[data-pattern-pick]').forEach((el) => {
    el.classList.toggle('active', el.dataset.patternPick === (state.bgPattern || 'off'));
  });
}

function renderBgPatternPicker() {
  const root = document.getElementById('bgPatternPicker');
  if (!root) return;
  root.innerHTML = '';
  const items = [
    { id: 'off',    label: 'OFF' },
    { id: 'grid',   label: 'GRID' },
    { id: 'topo',   label: 'TOPO' },
    { id: 'radial', label: 'RADIAL' },
  ];
  items.forEach((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-btn';
    b.dataset.patternPick = it.id;
    b.textContent = it.label;
    if ((state.bgPattern || 'off') === it.id) b.classList.add('active');
    b.addEventListener('click', () => setBgPattern(it.id));
    root.appendChild(b);
  });
}

function renderThemePicker() {
  const grid = document.getElementById('themeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  // Preserve the auto-switching lock: the grid is rebuilt whenever the
  // picker renders, which happens after applyTheme() in init().
  grid.classList.toggle('auto-disabled', !!state.autoTheme);
  THEME_PRESETS.forEach((p) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.themePick = p.id;
    card.title = p.label;

    const swatch = document.createElement('span');
    swatch.className = 'theme-card-swatch';
    // Each card is a tiny preview: the accent dot + a textured
    // background that reflects the preset's surface / text colours.
    swatch.style.background =
      p.mode === 'dark'
        ? 'linear-gradient(135deg, #1f2030 0%, #2a2c3a 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #f0f0f5 100%)';
    const dot = document.createElement('span');
    dot.className = 'theme-card-dot';
    // We'll override this dot color in applyTheme() with the live
    // --accent for the active card so it reflects the actual palette.
    dot.dataset.role = 'accent';
    swatch.appendChild(dot);

    const lbl = document.createElement('span');
    lbl.className = 'theme-card-label';
    lbl.textContent = p.label;

    const mode = document.createElement('span');
    mode.className = 'theme-card-mode';
    mode.textContent = p.mode === 'dark' ? '暗' : '亮';

    card.append(swatch, lbl, mode);
    card.addEventListener('click', () => setTheme(p.id));
    grid.appendChild(card);
  });
  // Set the accent dot on each card to match its preset's accent.
  // We resolve the var via a temporary DOM probe so the preview reads
  // the same value the page will use.
  requestAnimationFrame(() => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    THEME_PRESETS.forEach((p) => {
      probe.className = 'theme-' + p.id;
      const c = getComputedStyle(probe).getPropertyValue('--accent').trim();
      const dot = grid.querySelector(`.theme-card[data-theme-pick="${p.id}"] .theme-card-dot`);
      if (dot && c) dot.style.background = c;
      probe.className = '';
    });
    probe.remove();
  });
}

function renderAccentSwatches() {
  const root = document.getElementById('accentSwatches');
  if (!root) return;
  root.innerHTML = '';
  ACCENT_SWATCHES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'accent-swatch';
    btn.dataset.accent = s.value;
    btn.title = s.value;
    btn.style.background = s.value;
    root.appendChild(btn);
    btn.addEventListener('click', () => setAccentOverride(s.value));
  });
  // "Default" tile (empty accent = preset default)
  const def = document.createElement('button');
  def.type = 'button';
  def.className = 'accent-swatch accent-default';
  def.dataset.accent = '';
  def.title = '使用主题默认色';
  def.textContent = 'A';
  root.appendChild(def);
  def.addEventListener('click', () => setAccentOverride(null));
}

function bindAccentInput() {
  const input = document.getElementById('accentCustomInput');
  const clearBtn = document.getElementById('accentClearBtn');
  if (input) {
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v === '') return; // wait for blur / explicit clear
      setAccentOverride(v);
    });
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (v === '' || /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)) return;
      // Revert to last good value
      input.value = state.accentOverride || '';
      toast('HEX 格式错误，例如 #0067c0', true);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) input.value = '';
      setAccentOverride(null);
    });
  }
}

function bindThemeControls() {
  renderThemePicker();
  renderAccentSwatches();
  bindAccentInput();
  renderAutoThemeControls();
}

// ----- Auto light/dark controls -----

// Human-readable summary shown under the toggle.
function autoThemeHintText() {
  if (!state.autoTheme) return '关闭中 · 使用上方手动选择的主题';
  const day = isDaytime(new Date());
  const id = day ? state.autoLightThemeId : state.autoDarkThemeId;
  const preset = THEME_PRESETS.find((p) => p.id === id);
  return `当前：${day ? '白天' : '夜间'} · ${preset ? preset.label : id}`;
}

// Push state into the controls without firing change events. Called
// from applyTheme() so the panel always reflects reality.
function syncAutoThemeControls() {
  const toggle = document.getElementById('autoThemeToggle');
  if (toggle) toggle.checked = !!state.autoTheme;
  const cfg = document.getElementById('autoThemeConfig');
  if (cfg) cfg.classList.toggle('hidden', !state.autoTheme);
  const lightSel = document.getElementById('autoLightTheme');
  if (lightSel) lightSel.value = state.autoLightThemeId;
  const darkSel = document.getElementById('autoDarkTheme');
  if (darkSel) darkSel.value = state.autoDarkThemeId;
  const ls = document.getElementById('autoLightStart');
  if (ls) ls.value = state.autoLightStart;
  const ds = document.getElementById('autoDarkStart');
  if (ds) ds.value = state.autoDarkStart;
  const hint = document.getElementById('autoThemeHint');
  if (hint) hint.textContent = autoThemeHintText();
}

let autoThemeControlsBound = false;
function renderAutoThemeControls() {
  const lightSel = document.getElementById('autoLightTheme');
  const darkSel = document.getElementById('autoDarkTheme');

  // Populate the two preset selects once.
  [lightSel, darkSel].forEach((sel) => {
    if (!sel || sel.options.length) return;
    THEME_PRESETS.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.label + (p.mode === 'dark' ? '（暗）' : '（亮）');
      sel.appendChild(o);
    });
  });

  if (!autoThemeControlsBound) {
    autoThemeControlsBound = true;
    const toggle = document.getElementById('autoThemeToggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        state.autoTheme = toggle.checked;
        applyTheme();
        persist();
        toast(state.autoTheme ? '已开启自动明暗' : '已关闭自动明暗');
      });
    }
    if (lightSel) {
      lightSel.addEventListener('change', () => {
        state.autoLightThemeId = lightSel.value;
        applyTheme();
        persist();
      });
    }
    if (darkSel) {
      darkSel.addEventListener('change', () => {
        state.autoDarkThemeId = darkSel.value;
        applyTheme();
        persist();
      });
    }
    const ls = document.getElementById('autoLightStart');
    if (ls) {
      ls.addEventListener('change', () => {
        state.autoLightStart = ls.value || '07:00';
        applyTheme();
        persist();
      });
    }
    const ds = document.getElementById('autoDarkStart');
    if (ds) {
      ds.addEventListener('change', () => {
        state.autoDarkStart = ds.value || '19:00';
        applyTheme();
        persist();
      });
    }
  }

  syncAutoThemeControls();
}

// Re-evaluate the schedule once a minute. Only re-applies when the
// resolved theme actually changed, so this is cheap. The
// `appliedThemeId === null` guard skips the tick before init() has
// painted the first theme.
setInterval(() => {
  if (!state.autoTheme || appliedThemeId === null) return;
  if (resolveThemeId() !== appliedThemeId) applyTheme();
}, 60_000);

function applyRainbow() {
  const mode = state.rainbowMode || 'off';
  const html = document.documentElement;
  if (mode === 'off') {
    html.removeAttribute('data-rainbow');
  } else {
    html.setAttribute('data-rainbow', mode);
  }
  document.querySelectorAll('.rainbow-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.rainbow === mode);
  });
  applyCustomTitle();
}

function bindRainbowControls() {
  document.querySelectorAll('.rainbow-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.rainbowMode = btn.dataset.rainbow;
      applyRainbow();
      persist();
    });
  });
}
function bindThemeListener() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (applyWallpaperColor()) {
      renderBuiltinGrid();
      return;
    }
    applyWallpaper();
    renderBuiltinGrid();
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
  } else if (mq.addListener) {
    mq.addListener(handler);
  }
}

init().catch((e) => { window.__initFail = e.message; });





