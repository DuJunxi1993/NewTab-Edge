/* ================================================
   Toolbar action popup — NewTab quick panel.

   Mirrors the active new-tab theme (palette applied to this
   document so the popup looks like part of the page) and offers
   the three settings people change most often:

     - theme preset (8 cards)
     - multicolor / rainbow tier (off | vivid | soft | morandi)
     - background line pattern (off | grid | topo | radial)

   Plus the five most recent searches, which open the search in a
   real tab when clicked.

   Storage contract: chrome.storage.local key "state", shape
   { state: {...} } — identical to script.js. Changes written here
   are picked up by any open new-tab page via the storage
   onChanged listener in script.js.
   ================================================ */
(function () {
  'use strict';

  // Preset metadata + the palette the popup paints itself with.
  // Keep in sync with THEME_PRESETS in script.js and the
  // html.theme-<id> blocks in styles.css.
  const THEMES = [
    { id: 'edge-blue',     label: 'Edge Blue',     mode: 'light' },
    { id: 'edge-dark',     label: 'Edge Dark',     mode: 'dark'  },
    { id: 'pure-light',    label: 'Pure Light',    mode: 'light' },
    { id: 'sepia',         label: 'Sepia',         mode: 'light' },
    { id: 'solarized',     label: 'Solarized',     mode: 'light' },
    { id: 'slate',         label: 'Slate',         mode: 'dark'  },
    { id: 'rosepine',      label: 'Rosé Pine',     mode: 'dark'  },
    { id: 'high-contrast', label: 'High Contrast', mode: 'dark'  },
  ];

  const PALETTES = {
    'edge-blue': {
      accent: '#0067c0', accentLight: 'rgba(0,103,192,.12)',
      bg: '#f3f3f3', surface: '#ffffff', surfaceHover: 'rgba(0,0,0,.04)',
      border: 'rgba(0,0,0,.08)', text: '#1c1c1c', dim: '#5d5d5d', tertiary: '#8a8a8a',
    },
    'edge-dark': {
      accent: '#4cc2ff', accentLight: 'rgba(76,194,255,.16)',
      bg: '#1c1c22', surface: '#2c2c2c', surfaceHover: 'rgba(255,255,255,.06)',
      border: 'rgba(255,255,255,.10)', text: '#ffffff', dim: '#c5c5c5', tertiary: '#a0a0a0',
    },
    'pure-light': {
      accent: '#1f1f1f', accentLight: 'rgba(0,0,0,.06)',
      bg: '#ffffff', surface: '#ffffff', surfaceHover: 'rgba(0,0,0,.04)',
      border: 'rgba(0,0,0,.06)', text: '#111111', dim: '#555555', tertiary: '#888888',
    },
    'sepia': {
      accent: '#8a5a2b', accentLight: 'rgba(138,90,43,.10)',
      bg: '#efe1c5', surface: '#f5ebd7', surfaceHover: 'rgba(90,60,30,.06)',
      border: 'rgba(110,75,35,.14)', text: '#3a2a18', dim: '#6b4f30', tertiary: '#97785a',
    },
    'solarized': {
      accent: '#268bd2', accentLight: 'rgba(38,139,210,.10)',
      bg: '#eee8d5', surface: '#fdf6e3', surfaceHover: 'rgba(7,54,66,.05)',
      border: 'rgba(7,54,66,.10)', text: '#073642', dim: '#586e75', tertiary: '#93a1a1',
    },
    'slate': {
      accent: '#b0b8c1', accentLight: 'rgba(176,184,193,.14)',
      bg: '#1c1f24', surface: '#242832', surfaceHover: 'rgba(255,255,255,.05)',
      border: 'rgba(255,255,255,.08)', text: '#e6e8eb', dim: '#aab0b8', tertiary: '#7e848c',
    },
    'rosepine': {
      accent: '#ebbcba', accentLight: 'rgba(235,188,186,.14)',
      bg: '#191724', surface: '#21202e', surfaceHover: 'rgba(255,255,255,.05)',
      border: 'rgba(255,255,255,.08)', text: '#e0def4', dim: '#908caa', tertiary: '#6e6a86',
    },
    'high-contrast': {
      accent: '#ffffff', accentLight: 'rgba(255,255,255,.20)',
      bg: '#000000', surface: '#000000', surfaceHover: 'rgba(255,255,255,.12)',
      border: 'rgba(255,255,255,.50)', text: '#ffffff', dim: '#f0f0f0', tertiary: '#c8c8c8',
    },
  };

  // Minimal engine URL builders so a history click can open the
  // search in a real tab. Keep in sync with ENGINES in script.js.
  const ENGINES = {
    baidu:    { label: 'BAIDU',    url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
    bing:     { label: 'BING',     url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
    google:   { label: 'GOOGLE',   url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
    github:   { label: 'GITHUB',   url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}` },
    wkinfo:   { label: '威科',      url: (q) => `https://law.wkinfo.com.cn/legislation/list?simple=${encodeURIComponent(q)}` },
    bilibili: { label: 'BILIBILI', url: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}` },
  };

  // Recent searches are the popup's primary content, so show a
  // generous slice of the stored history (which is capped at 30).
  const HISTORY_SHOWN = 8;
  const RAINBOW_TIERS = ['off', 'vivid', 'soft', 'morandi'];
  const PATTERNS = ['off', 'grid', 'topo', 'radial'];

  // ----- DOM -----
  const themeGrid = document.getElementById('themeGrid');
  const rainbowSeg = document.getElementById('rainbowSeg');
  const patternSeg = document.getElementById('patternSeg');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const appearance = document.getElementById('appearance');
  const modeTag = document.getElementById('modeTag');
  const openNewTabBtn = document.getElementById('openNewTab');
  const statusEl = document.getElementById('status');

  // ----- State (local mirror of chrome.storage.local "state") -----
  let state = {};

  let statusTimer = null;
  function setStatus(msg, ok) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (ok ? ' ok' : '');
    if (statusTimer) clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 1800);
  }

  function relativeTime(ts) {
    const diff = Date.now() - (ts || 0);
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前';
    if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' 天前';
    return Math.floor(diff / 86_400_000) + ' 天前';
  }

  // ----- Palette: paint the popup like the active theme -----
  function applyPopupPalette() {
    const id = THEMES.some((t) => t.id === state.themeId) ? state.themeId : 'edge-blue';
    const p = PALETTES[id];
    const root = document.documentElement.style;
    // An explicit accent override wins over the preset accent.
    const accent = (typeof state.accentOverride === 'string' &&
                    /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(state.accentOverride))
      ? state.accentOverride
      : p.accent;
    root.setProperty('--accent', accent);
    root.setProperty('--accent-light', `color-mix(in srgb, ${accent} 14%, transparent)`);
    root.setProperty('--bg', p.bg);
    root.setProperty('--surface', p.surface);
    root.setProperty('--surface-hover', p.surfaceHover);
    root.setProperty('--border', p.border);
    root.setProperty('--text', p.text);
    root.setProperty('--text-dim', p.dim);
    root.setProperty('--text-tertiary', p.tertiary);
    const preset = THEMES.find((t) => t.id === id);
    modeTag.textContent = preset.mode === 'dark' ? '暗' : '亮';
  }

  // ----- Theme grid -----
  function renderThemes() {
    themeGrid.innerHTML = '';
    THEMES.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-card';
      btn.dataset.themeId = t.id;
      btn.title = t.label;
      if (state.themeId === t.id) btn.classList.add('active');

      const dot = document.createElement('span');
      dot.className = 'dot';
      // Use the preset's own accent unless the user overrode it, in
      // which case the override applies to every swatch.
      const override = (typeof state.accentOverride === 'string' &&
                        /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(state.accentOverride))
        ? state.accentOverride
        : null;
      dot.style.background = override || PALETTES[t.id].accent;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = t.label;

      btn.append(dot, name);
      btn.addEventListener('click', () => {
        state.themeId = t.id;
        state.themeMode = t.mode; // keep the legacy field in sync
        save({ ok: `主题：${t.label}` });
        applyPopupPalette();
        renderThemes();
      });
      themeGrid.appendChild(btn);
    });
  }

  // ----- Segmented controls -----
  function renderSegments() {
    const rainbow = RAINBOW_TIERS.includes(state.rainbowMode) ? state.rainbowMode : 'off';
    rainbowSeg.querySelectorAll('[data-rainbow]').forEach((b) => {
      b.classList.toggle('active', b.dataset.rainbow === rainbow);
    });
    const pattern = PATTERNS.includes(state.bgPattern) ? state.bgPattern : 'off';
    patternSeg.querySelectorAll('[data-pattern]').forEach((b) => {
      b.classList.toggle('active', b.dataset.pattern === pattern);
    });
  }

  rainbowSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rainbow]');
    if (!btn) return;
    state.rainbowMode = btn.dataset.rainbow;
    save({ ok: '已切换多彩模式' });
    renderSegments();
  });

  patternSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pattern]');
    if (!btn) return;
    state.bgPattern = btn.dataset.pattern;
    save({ ok: '已切换背景图案' });
    renderSegments();
  });

  // ----- History -----
  function renderHistory() {
    const items = Array.isArray(state.history) ? state.history : [];
    historyList.innerHTML = '';
    if (clearHistoryBtn) clearHistoryBtn.hidden = items.length === 0;
    if (!items.length) {
      historyEmpty.hidden = false;
      return;
    }
    historyEmpty.hidden = true;
    items.slice(0, HISTORY_SHOWN).forEach((h) => {
      if (!h || !h.q) return;
      const row = document.createElement('div');
      row.className = 'history-item';
      row.title = `用 ${ENGINES[h.engine] ? ENGINES[h.engine].label : h.engine} 搜索「${h.q}」`;

      const q = document.createElement('span');
      q.className = 'q';
      q.textContent = h.q;

      const eng = document.createElement('span');
      eng.className = 'eng';
      eng.textContent = ENGINES[h.engine] ? ENGINES[h.engine].label : (h.engine || '');

      const when = document.createElement('span');
      when.className = 'when';
      when.textContent = relativeTime(h.ts);

      const rm = document.createElement('button');
      rm.className = 'rm';
      rm.type = 'button';
      rm.title = '删除';
      rm.setAttribute('aria-label', '删除');
      rm.innerHTML =
        '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
        '<path d="M18 6 6 18M6 6l12 12"/></svg>';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove by identity (the list is a slice of the full array).
        const all = Array.isArray(state.history) ? state.history : [];
        const i = all.indexOf(h);
        if (i !== -1) all.splice(i, 1);
        save({ ok: '已删除' });
        renderHistory();
      });

      row.append(q, eng, when, rm);
      row.addEventListener('click', () => {
        const engine = ENGINES[h.engine];
        const url = engine ? engine.url(h.q) : `https://www.bing.com/search?q=${encodeURIComponent(h.q)}`;
        chrome.tabs.create({ url });
        window.close();
      });
      historyList.appendChild(row);
    });
  }

  // ----- Appearance section: collapsed by default -----
  // <details> starts closed because the markup has no `open`
  // attribute, and we deliberately do NOT persist the expanded state —
  // every popup open should lead with the recent searches.
  if (appearance) {
    const hint = appearance.querySelector('.summary-hint');
    appearance.addEventListener('toggle', () => {
      if (hint) hint.textContent = appearance.open ? '点击收起' : '点击展开';
    });
  }

  // ----- Clear all history -----
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      state.history = [];
      save({ ok: '已清空搜索记录' });
      renderHistory();
    });
  }

  // ----- Footer -----
  openNewTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://newtab/' });
    window.close();
  });

  // ----- Storage -----
  function save(opts) {
    chrome.storage.local.set({ state }, () => {
      if (chrome.runtime.lastError) {
        setStatus('保存失败', false);
        return;
      }
      if (opts && opts.ok) setStatus(opts.ok, true);
    });
  }

  function load() {
    chrome.storage.local.get('state', (data) => {
      state = (data && data.state && typeof data.state === 'object') ? data.state : {};
      // Normalise the fields this popup touches.
      if (!THEMES.some((t) => t.id === state.themeId)) {
        state.themeId = state.themeMode === 'dark' ? 'edge-dark' : 'edge-blue';
      }
      if (!RAINBOW_TIERS.includes(state.rainbowMode)) state.rainbowMode = 'off';
      if (!PATTERNS.includes(state.bgPattern)) state.bgPattern = 'off';
      if (!Array.isArray(state.history)) state.history = [];

      applyPopupPalette();
      renderThemes();
      renderSegments();
      renderHistory();
    });
  }

  load();
})();
