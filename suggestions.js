/* ================================================
   Search autocomplete + history popover.

   Public API:
     window.searchSuggestions.fetch(input)         debounced fetch for input
     window.searchSuggestions.openHistory()        toggle history popover
     window.searchSuggestions.recordHistory(q, e)  add a query to history

   History:
     - Lives in state.history (array, newest first, capped at 30)
     - Deduped by lowercased query
     - Persisted via state (chrome.storage.local / localStorage)

   Mutex:
     - History popover and preview drawer are mutually exclusive:
       opening one closes the other.
   ================================================ */
(function () {
  'use strict';

  const HISTORY_LIMIT = 30;

  // ----- DOM refs -----
  let input, suggestList, historyPopover, historyList, historyEmpty;
  let historyCloseBtn, historyClearBtn;
  let titleEl;

  // ----- Suggestion state -----
  let activeIndex = -1;     // highlighted row in the dropdown
  let currentItems = [];    // items currently shown
  let debounceTimer = null;
  let inflightAbort = null; // AbortController for in-flight fetch
  let lastFetchedKey = '';   // dedupe identical consecutive queries

  // ----- History popover state -----
  let historyOpen = false;

  // ----- Utilities -----

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    const re = new RegExp('(' + escapeRegex(escapeHtml(q)) + ')', 'i');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前';
    if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' 天前';
    const d = new Date(ts);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // ----- Suggestions -----

  function showEmpty(msg) {
    suggestList.innerHTML = '<li class="suggest-empty">' + escapeHtml(msg) + '</li>';
    suggestList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function hideSuggestions() {
    suggestList.hidden = true;
    suggestList.innerHTML = '';
    activeIndex = -1;
    currentItems = [];
    input.setAttribute('aria-expanded', 'false');
  }

  function renderSuggestions(items, query) {
    if (!items.length) {
      showEmpty('无搜索建议');
      return;
    }
    const engine = ENGINES[state.engine];
    const engineTag = engine ? engine.label : '';
    suggestList.innerHTML = items.map((text, i) => {
      return (
        '<li class="suggest-item" role="option" data-idx="' + i + '">' +
          (engineTag ? '<span class="suggest-engine">' + escapeHtml(engineTag) + '</span>' : '') +
          '<span class="suggest-text">' + highlight(text, query) + '</span>' +
        '</li>'
      );
    }).join('');
    suggestList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    currentItems = items;
    activeIndex = -1;
  }

  function selectActive() {
    if (activeIndex < 0 || activeIndex >= currentItems.length) return;
    const text = currentItems[activeIndex];
    input.value = text;
    hideSuggestions();
    // Submit immediately
    const form = input.closest('form');
    if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }

  function moveActive(delta) {
    if (!currentItems.length) return;
    if (activeIndex < 0) {
      activeIndex = delta > 0 ? 0 : currentItems.length - 1;
    } else {
      activeIndex = (activeIndex + delta + currentItems.length) % currentItems.length;
    }
    Array.from(suggestList.children).forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
      if (i === activeIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function fetchSuggestions(query) {
    const engine = ENGINES[state.engine];
    if (!engine || !engine.suggestUrl || !engine.parseSuggestions || !query || !query.trim()) {
      hideSuggestions();
      return;
    }
    const key = state.engine + '\u0001' + query;
    if (key === lastFetchedKey) return;
    lastFetchedKey = key;

    if (inflightAbort) inflightAbort.abort();
    const ctl = new AbortController();
    inflightAbort = ctl;

    fetch(engine.suggestUrl(query), {
      signal: ctl.signal,
      credentials: 'omit',
      headers: { 'Accept': 'application/json, text/html, */*' },
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then((raw) => {
        if (ctl.signal.aborted) return;
        const items = engine.parseSuggestions(raw);
        // Filter: suggestions whose lowercase contains the query
        const q = query.trim().toLowerCase();
        const filtered = items.filter((s) => s && s.toLowerCase().includes(q));
        // De-dupe, cap at 8
        const seen = new Set();
        const capped = [];
        for (const s of filtered) {
          const k = s.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          capped.push(s);
          if (capped.length >= 8) break;
        }
        renderSuggestions(capped, query);
      })
      .catch((err) => {
        if (err && err.name === 'AbortError') return;
        hideSuggestions();
      });
  }

  function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(input.value), 150);
  }

  function onKeydown(e) {
    if (suggestList.hidden) {
      // If user hits Down on a non-empty input, fetch immediately
      if (e.key === 'ArrowDown' && input.value.trim()) {
        e.preventDefault();
        lastFetchedKey = ''; // bypass dedupe
        fetchSuggestions(input.value);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectActive();
      }
      // else: let the form submit normally
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideSuggestions();
    }
  }

  function onFocus() {
    if (input.value.trim()) fetchSuggestions(input.value);
  }

  function onBlur() {
    // Delay hiding so click-on-item still registers
    setTimeout(hideSuggestions, 120);
  }

  function onSuggestClick(e) {
    const li = e.target.closest('.suggest-item');
    if (!li) return;
    const idx = Number(li.dataset.idx);
    activeIndex = idx;
    selectActive();
  }

  // ----- History -----

  function recordHistory(query, engineId) {
    const q = String(query || '').trim();
    if (!q) return;
    const engine = engineId || state.engine;
    if (!Array.isArray(state.history)) state.history = [];
    // Drop any existing entry with same (q, engine) and same text
    const qLower = q.toLowerCase();
    state.history = state.history.filter((h) => {
      if (!h) return false;
      if (h.engine !== engine) return true;
      return String(h.q || '').toLowerCase() !== qLower;
    });
    state.history.unshift({ q, engine, ts: Date.now() });
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
    if (typeof persist === 'function') persist();
  }

  function removeHistory(idx) {
    if (!Array.isArray(state.history)) return;
    state.history.splice(idx, 1);
    if (typeof persist === 'function') persist();
    renderHistory();
  }

  function clearHistory() {
    state.history = [];
    if (typeof persist === 'function') persist();
    renderHistory();
  }

  function renderHistory() {
    const items = Array.isArray(state.history) ? state.history : [];
    historyList.innerHTML = '';
    if (!items.length) {
      historyEmpty.classList.add('visible');
      return;
    }
    historyEmpty.classList.remove('visible');
    items.forEach((h, i) => {
      if (!h || !h.q) return;
      const li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.idx = String(i);
      const text = document.createElement('span');
      text.className = 'history-text';
      text.textContent = h.q;
      const engine = document.createElement('span');
      engine.className = 'history-engine';
      engine.textContent = ENGINES[h.engine] ? ENGINES[h.engine].label : (h.engine || '');
      const time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = relativeTime(h.ts || 0);
      const rm = document.createElement('button');
      rm.className = 'history-remove';
      rm.type = 'button';
      rm.title = '删除';
      rm.setAttribute('aria-label', '删除');
      rm.innerHTML =
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M18 6 6 18M6 6l12 12"/></svg>';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        removeHistory(i);
      });
      li.addEventListener('click', () => {
        // Replay this entry: set engine + value, then submit
        if (h.engine && ENGINES[h.engine]) {
          state.engine = h.engine;
          if (typeof renderEngineTabs === 'function') renderEngineTabs();
          if (typeof persist === 'function') persist();
        }
        input.value = h.q;
        closeHistory();
        const form = input.closest('form');
        if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
      li.append(text, engine, time, rm);
      historyList.appendChild(li);
    });
  }

  function openHistory() {
    if (historyOpen) return;
    historyOpen = true;
    // Mutex with preview drawer + settings + tools
    if (typeof window.closeSearchPreview === 'function') window.closeSearchPreview();
    document.getElementById('settingsPanel')?.classList.remove('open');
    document.getElementById('settingsBackdrop')?.classList.remove('open');
    document.getElementById('toolsPanel')?.classList.remove('open');
    document.getElementById('toolsBackdrop')?.classList.remove('open');
    historyPopover.hidden = false;
    // Two RAFs so the transition from display:none kicks in
    requestAnimationFrame(() => requestAnimationFrame(() => {
      historyPopover.classList.add('open');
      historyPopover.setAttribute('aria-hidden', 'false');
    }));
    renderHistory();
  }

  function closeHistory() {
    if (!historyOpen) return;
    historyOpen = false;
    historyPopover.classList.remove('open');
    historyPopover.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!historyOpen) historyPopover.hidden = true; }, 220);
    if (input) input.focus({ preventScroll: true });
  }

  function toggleHistory() {
    if (historyOpen) closeHistory(); else openHistory();
  }

  // ----- Bind -----

  function bind() {
    input = document.getElementById('searchInput');
    suggestList = document.getElementById('suggestList');
    historyPopover = document.getElementById('historyPopover');
    historyList = document.getElementById('historyList');
    historyEmpty = document.getElementById('historyEmpty');
    historyCloseBtn = document.getElementById('historyCloseBtn');
    historyClearBtn = document.getElementById('historyClearBtn');
    titleEl = document.querySelector('.title');

    if (!input || !suggestList || !historyPopover) return;

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    suggestList.addEventListener('mousedown', (e) => e.preventDefault()); // keep input focused
    suggestList.addEventListener('click', onSuggestClick);

    if (historyCloseBtn) historyCloseBtn.addEventListener('click', closeHistory);
    if (historyClearBtn) historyClearBtn.addEventListener('click', clearHistory);

    // Click the dim area to close
    historyPopover.addEventListener('click', (e) => {
      if (e.target === historyPopover) closeHistory();
    });

    // Title click toggles history (replaces the former "AI Lab" affordance)
    if (titleEl) {
      titleEl.style.cursor = 'pointer';
      titleEl.addEventListener('click', toggleHistory);
      titleEl.title = '查看搜索历史';
    }

    // Esc closes the history popover
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && historyOpen) {
        e.preventDefault();
        closeHistory();
      }
    });
  }

  // Public API
  window.searchSuggestions = {
    recordHistory,
    openHistory,
    closeHistory,
    toggleHistory,
    renderHistory,
    hideSuggestions,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();