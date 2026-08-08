/* ================================================
   Cyberpunk NewTab — Controller
   ================================================ */

// ---------- Built-in wallpapers (local presets + royalty-free Unsplash) ----------
const BUILTIN_WALLPAPERS = [
  { id: 'edge-solid', type: 'color', cssVar: '--edge-solid-color', label: 'Edge Surface' },
  { id: 'edge-cream', type: 'color', cssVar: '--edge-cream-color', label: 'Warm Paper' },
  { id: 'edge-pure',  type: 'color', cssVar: '--edge-pure-color',  label: 'Pure White' },
];

// ---------- Search engines ----------
const ENGINES = {
  baidu: {
    label: 'BAIDU',
    url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
  },
  bing: {
    label: 'BING',
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
  google: {
    label: 'GOOGLE',
    url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  github: {
    label: 'GITHUB',
    url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
  },
};

// ---------- State ----------
const DEFAULT_STATE = {
  wallpaper: { type: 'builtin', value: BUILTIN_WALLPAPERS[0].id },
  blur: 0,
  brightness: 100,
  saturation: 100,
  engine: 'baidu',
  themeMode: 'auto',  // 'auto' | 'light' | 'dark'
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
const queryLabel = $('#queryLabel');
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
const sourceTabs = document.querySelectorAll('.src-tab');
const searchTabs = document.querySelectorAll('.tab');

// ---------- Clock ----------
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  hudClock.textContent = `${hh}:${mm}:${ss}`;
}
setInterval(tickClock, 1000);
tickClock();

// ---------- Wallpaper ----------
function applyWallpaper() {
  let url = '';
  let isColor = false;
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
      } else {
        url = found.url;
      }
    }
  }
  if (isColor) {
    wallpaperEl.style.backgroundImage = 'none';
    wallpaperEl.style.backgroundColor = url;
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
function setEngine(name) {
  if (!ENGINES[name]) return;
  state.engine = name;
  searchTabs.forEach((t) => t.classList.toggle('active', t.dataset.engine === name));
  engineLabel.textContent = ENGINES[name].label.charAt(0) + ENGINES[name].label.slice(1).toLowerCase();
  persist();
}

searchTabs.forEach((t) => t.addEventListener('click', () => setEngine(t.dataset.engine)));

searchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  queryLabel.textContent = `QUERY: ${q || 'NULL'}`;
});

function performSearch(e) {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) {
    toast('Enter a query first', true);
    searchInput.focus();
    return;
  }
  const engine = ENGINES[state.engine];
  window.location.href = engine.url(q);
}

searchForm.addEventListener('submit', performSearch);
searchBtn.addEventListener('click', performSearch);

// ---------- Settings panel ----------
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.add('open');
  settingsPanel.setAttribute('aria-hidden', 'false');
});

closeSettingsBtn.addEventListener('click', closeSettings);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsPanel.classList.contains('open')) {
    closeSettings();
  }
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
});

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsPanel.setAttribute('aria-hidden', 'true');
}

// ---------- Reset ----------
resetBtn.addEventListener('click', () => {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  wallpaperUrlInput.value = '';
  fileHint.textContent = 'No file selected';
  applyWallpaper();
  applyFilters();
  renderBuiltinGrid();
  setEngine(state.engine);
  setSource('url');
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
    storage.set({ state });
  }, 250);
}

// ---------- Init ----------
async function init() {
  const { state: saved } = await storage.get('state');
  if (saved && typeof saved === 'object') {
    state = { ...DEFAULT_STATE, ...saved };
  }
  applyWallpaper();
  applyFilters();
  renderBuiltinGrid();
  setEngine(state.engine);
  setSource('url');
  applyTheme();
  searchInput.focus();
  bindThemeListener();
  bindThemeControls();
}

function applyTheme() {
  const mode = state.themeMode || 'auto';
  const html = document.documentElement;
  html.classList.remove('theme-dark', 'theme-light');
  if (mode === 'dark') html.classList.add('theme-dark');
  else if (mode === 'light') html.classList.add('theme-light');
  // 'auto' -> no class, let @media (prefers-color-scheme: dark) apply
  document.querySelectorAll('.theme-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === mode);
  });
  // Re-resolve wallpaper color (it reads CSS vars which just changed)
  if (!applyWallpaperColor()) applyWallpaper();
  renderBuiltinGrid();
}

function bindThemeControls() {
  document.querySelectorAll('.theme-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.themeMode = btn.dataset.theme;
      applyTheme();
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

init();






