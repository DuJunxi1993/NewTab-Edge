/* ================================================
   Toolbar action popup — "add current page to AI Hub".
   Adds { id, name, url, builtin:false } into the same
   state.aiSites array the AI panel reads, so the new
   site shows up in the AI Lab sidebar immediately.
   Storage key matches script.js: chrome.storage.local
   key "state", shape { state: {...} }.
   ================================================ */
(function () {
  'use strict';

  const domainEl = document.getElementById('siteDomain');
  const titleEl = document.getElementById('siteTitle');
  const addBtn = document.getElementById('addBtn');
  const statusEl = document.getElementById('status');

  const NAME_MAX = 20; // matches ai.js form maxLength
  const norm = (u) => (u || '').replace(/\/+$/, ''); // url.com == url.com/ for dedupe
  let current = null; // { url, title }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setBtn(enabled) {
    addBtn.disabled = !enabled;
  }

  function uid() {
    // Same format as ai.js uid()
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalizeUrl(raw) {
    let u = (raw || '').trim();
    if (!u) return '';
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      parsed.hash = '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function nameFrom(url, title) {
    let name = (title || '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
    if (!name) {
      const host = new URL(url).hostname.replace(/^www\./, '');
      name = host.slice(0, NAME_MAX) || 'New site';
    }
    return name;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const url = normalizeUrl(tab && tab.url);
    const title = (tab && tab.title) || '';
    if (!url) {
      domainEl.textContent = '—';
      titleEl.textContent = '当前页面不支持（需 http/https）';
      setBtn(false);
      setStatus('仅可添加 http / https 页面', 'warn');
      return;
    }
    current = { url, title };
    domainEl.textContent = new URL(url).hostname;
    titleEl.textContent = title || url;
    setBtn(true);
  });

  addBtn.addEventListener('click', () => {
    if (!current) return;
    const url = normalizeUrl(current.url);
    const name = nameFrom(url, current.title);
    setBtn(false);

    chrome.storage.local.get('state', (data) => {
      const state = data && data.state && typeof data.state === 'object'
        ? data.state
        : { aiSites: [] };
      if (!Array.isArray(state.aiSites)) state.aiSites = [];

      const dup = state.aiSites.find((s) => s && norm(s.url) === norm(url));
      if (dup) {
        setStatus('已存在：' + (dup.name || dup.url));
        setBtn(true);
        return;
      }

      state.aiSites.push({ id: uid(), name, url, builtin: false });
      chrome.storage.local.set({ state }, () => {
        setStatus('✓ 已添加到 AI Hub', 'ok');
        addBtn.textContent = '✓ 已添加';
        setTimeout(() => window.close(), 1500);
      });
    });
  });
})();
