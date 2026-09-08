
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
  wkinfo: {
    label: '威科',
    url: (q) => `https://law.wkinfo.com.cn/legislation/list?simple=${encodeURIComponent(q)}`,
  },
  bilibili: {
    label: 'BILIBILI',
    url: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
  },
};

// Display order for both the main tab strip and the settings picker
const ENGINE_ORDER = ['baidu', 'bing', 'google', 'github', 'wkinfo', 'bilibili'];

// ---------- State ----------
const DEFAULT_STATE = {
  wallpaper: { type: 'builtin', value: BUILTIN_WALLPAPERS[0].id },
  blur: 0,
  brightness: 100,
  saturation: 100,
  engine: 'baidu',
  themeMode: 'auto',  // 'auto' | 'light' | 'dark'
  customTitle: '',
  rainbowMode: 'off',  // 'off' | 'vivid' | 'soft' | 'morandi'
  aiSites: [],
  visibleEngines: null, // null = use default (all engines visible)
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

searchTabs.forEach((t) => t.addEventListener('click', () => setEngine(t.dataset.engine)));

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
    searchInput.focus();
    return;
  }
  const engine = ENGINES[state.engine];
  window.open(engine.url(q), '_blank', 'noopener');
  // Do NOT force focus back to the input after submitting — opening a
  // new tab already triggers Edge's own focus handling, and a forced
  // refocus races with that, frequently causing IME focus loss. The
  // user can press `/` (or click the input) to start the next query.
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
  // Mutual exclusion with the AI panel
  document.getElementById('aiPanel')?.classList.remove('open');
  document.getElementById('aiBackdrop')?.classList.remove('open');
  document.body.classList.remove('ai-open');
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
    searchInput.focus();
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
  applyWallpaper();
  applyFilters();
  renderBuiltinGrid();
  renderEngineTabs();
  renderEnginePicker();
  setSource('url');
  applyTheme();
  applyRainbow();
  // No explicit searchInput.focus() here: the input has the `autofocus`
  // attribute, which the browser handles at parse time and which
  // cooperates better with Chromium's new-tab focus model. Calling
  // .focus() from script runs after the URL bar has already claimed
  // focus, and can be overridden / lost during async storage reads.
  bindThemeListener();
  bindThemeControls();
  bindRainbowControls();
  bindTitleInput();
  // Defer to a macrotask: ai.js loads after this script, so the
  // render function only exists once parsing of all scripts ends.
  // (A 0ms timer can fire between external scripts, before ai.js is
  // parsed — 250ms is the primary trigger; ai.js also self-checks
  // __stateReady below, covering both orderings.)
  window.__stateReady = true;
  setTimeout(() => {
    if (typeof window.renderAiPanel === 'function') renderAiPanel();
  }, 250);
}

// When Edge activates this tab, the omnibox often keeps focus and the
// `autofocus` on the input is no help (it fires at parse time, not at
// tab activation). Re-claim focus from the omnibox here, but only when
// the page hasn't been interacted with yet — never steal focus from a
// focused element the user intentionally chose.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // If focus has already settled on a real element inside the page,
  // do nothing.
  const ae = document.activeElement;
  if (ae && ae !== document.body) return;
  searchInput.focus({ preventScroll: true });
});

const RAINBOW_PALETTES = {
  vivid:   ['#00e5ff', '#ff2e88', '#ffd60a', '#9dff3c', '#ff7a00', '#b26bff', '#00ff9d'],
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
    } else {
      titleEl.textContent = finalTitle;
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





