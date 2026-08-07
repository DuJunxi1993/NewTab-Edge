/* ================================================
   Cyberpunk NewTab — Controller
   ================================================ */

// ---------- Built-in wallpapers (local presets + royalty-free Unsplash) ----------
const BUILTIN_WALLPAPERS = [
  { id: 'edge-solid', type: 'color', url: '#f3f3f3', label: 'Edge Surface' },
  { id: 'edge-cream', type: 'color', url: '#f8f4f1', label: 'Warm Paper' },
  { id: 'edge-pure',  type: 'color', url: '#ffffff', label: 'Pure White' },
  { id: 'local-1', url: 'Buildin_Image/Image_1.JPG', label: 'Preset 1' },
  { id: 'local-2', url: 'Buildin_Image/Image_2.jpeg', label: 'Preset 2' },
  { id: 'local-3', url: 'Buildin_Image/Image_3.jpg', label: 'Preset 3' },
  { id: 'local-4', url: 'Buildin_Image/Image_4.jpg', label: 'Preset 4' },
  { id: 'cyber-1', url: 'https://images.unsplash.com/photo-1542856391-010fb87dcfed?w=1920&q=80', label: 'Neon City' },
  { id: 'cyber-2', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&q=80', label: 'Red Matrix' },
  { id: 'cyber-3', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80', label: 'Code Rain' },
  { id: 'cyber-4', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&q=80', label: 'Retro Grid' },
  { id: 'cyber-5', url: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=1920&q=80', label: 'Night Skyline' },
  { id: 'cyber-6', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80', label: 'Tokyo Night' },
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
};

// ---------- State ----------
const DEFAULT_STATE = {
  wallpaper: { type: 'builtin', value: BUILTIN_WALLPAPERS[0].id },
  blur: 0,
  brightness: 100,
  saturation: 100,
  engine: 'baidu',
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
      url = found.url;
      isColor = found.type === 'color';
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

// ---------- Built-in grid ----------
function renderBuiltinGrid() {
  builtinGrid.innerHTML = '';
  BUILTIN_WALLPAPERS.forEach((w) => {
    const div = document.createElement('div');
    div.className = 'builtin-item';
    if (state.wallpaper.type === 'builtin' && state.wallpaper.value === w.id) {
      div.classList.add('active');
    }
    div.style.backgroundImage = `url("${w.url}")`;
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
  engineLabel.textContent = `ENGINE: ${ENGINES[name].label}`;
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
  searchInput.focus();
}

init();



