/* ================================================
   Inline search preview panel.
   Pressing Enter in the main search box (or clicking
   the search button) opens this panel instead of
   opening a new tab. The panel renders the chosen
   engine's SERP inside an iframe. State is persisted
   across reloads so the panel survives accidental
   NTP reloads within a session.

   Close on:
     - Esc
     - click on the left mask
     - click the "✕" toolbar button
     - opening the Settings or Tools panel (mutex)
   ================================================ */
(function () {
  'use strict';

  // DOM refs (resolved on DOMContentLoaded; this IIFE runs after
  // <script src="preview.js"> at the end of the body).
  let panel, mask, frameWrap, frameEl, fallbackEl;
  let btnOpen, btnRefresh, btnClose;
  let titleQueryEl, titleEngineEl;

  // Whether the current iframe failed to load (X-Frame-Options, etc.).
  let fallbackVisible = false;

  // Cooldown: ignore rapid re-opens while we tear down the previous
  // iframe — prevents the previous iframe from stealing focus and
  // racing with the new one.
  let pendingClose = false;

  function init() {
    panel = document.getElementById('previewPanel');
    mask = document.getElementById('previewMask');
    if (!panel || !mask) return;

    frameWrap = panel.querySelector('.preview-frame-wrap');
    frameEl = panel.querySelector('.preview-frame');
    fallbackEl = panel.querySelector('.preview-fallback');
    btnOpen = panel.querySelector('.preview-open-newtab');
    btnRefresh = panel.querySelector('.preview-refresh');
    btnClose = panel.querySelector('.preview-toolbar-btn.close');
    titleQueryEl = panel.querySelector('.preview-toolbar-title strong');
    titleEngineEl = panel.querySelector('.preview-toolbar-title .engine-tag');

    // Wire mask / close interactions.
    mask.addEventListener('click', close);
    if (btnClose) btnClose.addEventListener('click', close);
    if (btnOpen) btnOpen.addEventListener('click', onOpenInNewtab);
    if (btnRefresh) btnRefresh.addEventListener('click', onRefresh);

    // Esc closes the panel — but only when the search input isn't
    // actively composing (IME guard), so CJK users confirming a
    // candidate don't accidentally dismiss their just-opened preview.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!panel.classList.contains('open')) return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      close();
    });

    // Mutex with Settings / Tools panels: opening either should
    // close the preview panel.
    ['settingsPanel', 'toolsPanel'].forEach((id) => {
      const p = document.getElementById(id);
      if (!p) return;
      const obs = new MutationObserver(() => {
        if (p.classList.contains('open')) close();
      });
      obs.observe(p, { attributes: true, attributeFilter: ['class'] });
    });

    // No auto-restore on initial NTP load — see script.js init() where
    // preview.open is forced false at startup.
  }

  function setPreviewState(patch) {
    if (!state.preview) state.preview = { open: false, url: '', engine: '', query: '' };
    Object.assign(state.preview, patch);
    if (typeof persist === 'function') persist();
  }

  function isValidPreviewUrl(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url);
  }

  function mountIframe(url) {
    // Tear down any existing iframe so multiple submits don't stack
    // iframes (and so the previous one can't steal focus while the new
    // one is being created).
    if (frameEl) {
      try { frameEl.remove(); } catch (_) {}
      frameEl = null;
    }
    fallbackVisible = false;
    if (fallbackEl) fallbackEl.classList.remove('visible');

    const iframe = document.createElement('iframe');
    iframe.className = 'preview-frame';
    iframe.setAttribute('allow', 'clipboard-write; clipboard-read; autoplay; popups');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.loading = 'eager';
    iframe.title = 'Search results';
    iframe.src = url;

    // Some engines refuse to be framed. After ~5s without a load
    // event, show the fallback card so the user isn't staring at
    // a blank pane.
    let loaded = false;
    const showFallback = () => {
      if (loaded) return;
      fallbackVisible = true;
      if (fallbackEl) {
        const urlEl = fallbackEl.querySelector('.preview-fallback-url');
        if (urlEl) urlEl.textContent = url;
        fallbackEl.classList.add('visible');
      }
    };
    iframe.addEventListener('load', () => {
      loaded = true;
      if (fallbackEl) fallbackEl.classList.remove('visible');
    });
    iframe.addEventListener('error', showFallback);
    setTimeout(showFallback, 5000);

    frameWrap.appendChild(iframe);
    frameEl = iframe;
  }

  function show(query, engine, url) {
    if (!panel || !mask) return;
    pendingClose = false;

    if (titleQueryEl) titleQueryEl.textContent = query || '';
    if (titleEngineEl) titleEngineEl.textContent = engine || '';
    if (fallbackEl) {
      const urlEl = fallbackEl.querySelector('.preview-fallback-url');
      if (urlEl) urlEl.textContent = url || '';
    }

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    mask.classList.add('open');
    document.body.classList.add('preview-open');
    setPreviewState({ open: true, url, engine, query });
    mountIframe(url);
  }

  function close() {
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    mask.classList.remove('open');
    document.body.classList.remove('preview-open');
    setPreviewState({ open: false });
    // Defer iframe removal so the slide-out animation can play
    // without us yanking layout mid-frame.
    if (frameEl) {
      const old = frameEl;
      frameEl = null;
      setTimeout(() => {
        try { old.remove(); } catch (_) {}
      }, 350);
    }
    pendingClose = false;
  }

  function onOpenInNewtab() {
    const url = state.preview && state.preview.url;
    if (!isValidPreviewUrl(url)) return;
    window.open(url, '_blank', 'noopener');
  }

  function onRefresh() {
    const url = state.preview && state.preview.url;
    if (!isValidPreviewUrl(url)) return;
    mountIframe(url);
  }

  // Public API used by script.js's performSearch().
  window.openSearchPreview = function (query, engine, url) {
    if (!isValidPreviewUrl(url)) return false;
    show(query, engine, url);
    return true;
  };

  window.closeSearchPreview = close;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();