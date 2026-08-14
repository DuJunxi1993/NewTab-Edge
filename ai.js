/* ================================================
   AI Assistant panel
   Embedded chats (Doubao / Qwen / DeepSeek) plus
   user-defined sites, kept in state.aiSites.
   Sites that refuse iframe embedding show a
   fallback bar with an "open in new tab" button.
   ================================================ */
(function () {
  'use strict';

  const BUILTIN_SITES = [
    { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat', builtin: true },
    { id: 'trae', name: 'Trae', url: 'https://work.trae.cn/', builtin: true },
    { id: 'dsh', name: 'DS Harness', url: 'http://127.0.0.1:3080/', builtin: true, local: true },
  ];

  const panel = document.getElementById('aiPanel');
  const backdrop = document.getElementById('aiBackdrop');
  const btn = document.querySelector('.title');
  const closeBtn = document.getElementById('aiPanelClose');
  const nav = document.getElementById('aiNav');
  const content = document.getElementById('aiContent');

  let sites = [];
  let activeId = null;
  const frames = new Map(); // siteId -> { wrap, iframe }

  function uid() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function open() {
    closeOtherFrames();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
    document.body.classList.add('ai-open');
  }

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
    document.body.classList.remove('ai-open');
  }

  // Settings / tools panels are excluded, so we only need to close
  // AI when *they* open (handled in script.js / tools.js).
  function closeOtherFrames() {
    document.querySelectorAll('#settingsPanel, #toolsPanel').forEach((p) => {
      p.classList.remove('open');
    });
    ['settingsBackdrop', 'toolsBackdrop'].forEach((id) => {
      document.getElementById(id)?.classList.remove('open');
    });
    document.body.classList.remove('settings-open', 'tools-open');
  }

  function shellHint() {
    const p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    return {
      shell: p.includes('win') ? 'Windows · PowerShell (pwsh)' : 'macOS / Linux · 终端',
      cmd: 'npx @deepseek-ai/dsh web',
    };
  }

  const isLocalUrl = (url) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);

  function fallbackFor(site, iframe) {
    const bar = document.createElement('div');
    if (site.local) {
      // Startup guide card for local services (e.g. DeepSeek Harness).
      bar.className = 'ai-fallback local';
      const title = document.createElement('div');
      title.className = 'ai-fallback-title';
      title.textContent = '未检测到本地服务';
      const sub = document.createElement('div');
      sub.className = 'ai-fallback-sub';
      sub.textContent = site.url + ' 需要先在终端启动 DeepSeek Harness';
      const hint = shellHint();
      const shellNote = document.createElement('div');
      shellNote.className = 'ai-fallback-shell';
      shellNote.textContent = hint.shell + ' 中运行：';
      const code = document.createElement('code');
      code.className = 'ai-fallback-code';
      code.textContent = hint.cmd;
      const row = document.createElement('div');
      row.className = 'ai-fallback-row';
      const btnCopy = document.createElement('button');
      btnCopy.className = 'form-btn';
      btnCopy.type = 'button';
      btnCopy.textContent = '复制命令';
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(hint.cmd).then(() => {
          btnCopy.textContent = '✓ 已复制';
          setTimeout(() => (btnCopy.textContent = '复制命令'), 1600);
        });
      });
      const btnRetry = document.createElement('button');
      btnRetry.className = 'form-btn form-btn-primary';
      btnRetry.type = 'button';
      btnRetry.textContent = '重试';
      btnRetry.addEventListener('click', () => {
        iframe.src = site.url;
      });
      const btnOpen = document.createElement('button');
      btnOpen.className = 'form-btn';
      btnOpen.type = 'button';
      btnOpen.textContent = '↗ 打开';
      btnOpen.addEventListener('click', () => {
        window.open(site.url, '_blank', 'noopener');
      });
      row.append(btnCopy, btnRetry, btnOpen);
      bar.append(title, sub, shellNote, code, row);
      return bar;
    }
    bar.className = 'ai-fallback';
    const text = document.createElement('span');
    text.textContent = '该站点拒绝内嵌到面板中，可在新标签页打开';
    const btnOpen = document.createElement('button');
    btnOpen.className = 'form-btn form-btn-primary';
    btnOpen.textContent = '↗ 打开';
    btnOpen.addEventListener('click', () => {
      window.open(site.url, '_blank', 'noopener');
    });
    bar.append(text, btnOpen);
    return bar;
  }

  function createFrame(site) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-frame-wrap';
    wrap.dataset.siteId = site.id;
    const iframe = document.createElement('iframe');
    iframe.className = 'ai-frame';
    iframe.setAttribute('allow', 'clipboard-write; clipboard-read; autoplay');
    iframe.title = site.name;
    iframe.src = site.url;
    const bar = fallbackFor(site, iframe);
    let loaded = false;
    let probeOk = false;
    iframe.__polling = false;

    // Local service (e.g. DeepSeek Harness): the fetch probe is the source
    // of truth. Chrome fires a load event even for the connection-refused
    // error page, so iframe events cannot distinguish "server up" from
    // "server down" — only a successful fetch can. Poll every 5s (max 60
    // attempts); on first refusal show the startup guide; once the server
    // answers, reload the iframe and hide the guide.
    let pollTimer = null;
    let attempts = 0;
    function stopPoll() {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      iframe.__polling = false;
    }
    function startPoll() {
      if (pollTimer || loaded) return;
      iframe.__polling = true;
      const poll = () => {
        attempts++;
        fetch(site.url, { mode: 'no-cors' })
          .then(() => {
            probeOk = true;
            loaded = true;
            stopPoll();
            bar.classList.remove('visible');
            iframe.src = site.url;
          })
          .catch(() => {
            bar.classList.add('visible');
            if (attempts < 60) pollTimer = setTimeout(poll, 5000);
            else {
              pollTimer = null;
              iframe.__polling = false;
            }
          });
      };
      poll();
    }

    if (site.local) {
      startPoll();
      // A refused connection still fires a load event for the error page,
      // so never stop the probe from iframe events — the fetch poll is the
      // only source of truth. Just re-hide the guide if the probe succeeded.
      iframe.addEventListener('load', () => {
        if (probeOk) bar.classList.remove('visible');
      });
    } else {
      // X-Frame-Options / CSP refusals fire neither load nor error:
      // show the fallback bar once no load event arrives within 4s.
      let timer = setTimeout(() => {
        if (!loaded) bar.classList.add('visible');
      }, 4000);
      iframe.addEventListener('load', () => {
        loaded = true;
        clearTimeout(timer);
        bar.classList.remove('visible');
      });
      iframe.addEventListener('error', () => {
        clearTimeout(timer);
        bar.classList.add('visible');
      });
    }
    wrap.appendChild(iframe);
    wrap.appendChild(bar);
    return { wrap, iframe, stopPoll };
  }

  function select(id) {
    if (!sites.some((s) => s.id === id)) return;
    if (id !== activeId) activeId = id;
    nav.querySelectorAll('.ai-nav-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === id);
    });
    const site = sites.find((s) => s.id === id);
    let f = frames.get(id);
    if (!f) {
      f = createFrame(site);
      frames.set(id, f);
      content.appendChild(f.wrap);
    }
    content.querySelectorAll('.ai-frame-wrap').forEach((w) => w.classList.remove('active'));
    f.wrap.classList.add('active');
    // Keep placeholder hidden once a site is shown
    content.querySelectorAll('.ai-placeholder').forEach((p) => p.remove());
  }

  function render() {
    frames.clear();
    content.innerHTML = '';
    nav.innerHTML = '';
    activeId = null;

    if (!sites.length) {
      const ph = document.createElement('div');
      ph.className = 'ai-placeholder';
      ph.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3.5" r="1.5"/>' +
        '<path d="M8.5 13h.01M15.5 13h.01"/><path d="M9 16.5c.8.8 1.9 1.2 3 1.2s2.2-.4 3-1.2"/></svg>' +
        '<span>选择左侧站点开始对话，或点击 “+ 添加站点”</span>';
      content.appendChild(ph);
    }

    sites.forEach((site, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ai-nav-item' + (i === 0 ? ' active' : '');
      item.dataset.id = site.id;

      const icon = document.createElement('span');
      icon.className = 'nav-icon';
      icon.textContent = site.name.charAt(0).toUpperCase();

      const name = document.createElement('span');
      name.className = 'nav-name';
      name.textContent = site.name;

      item.appendChild(icon);
      item.appendChild(name);

      if (site.url.startsWith('http')) {
        const ext = document.createElement('span');
        ext.className = 'nav-open';
        ext.title = '在新标签页打开';
        ext.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';
        ext.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(site.url, '_blank', 'noopener');
        });
        item.appendChild(ext);
      }

      if (!site.builtin) {
        const rm = document.createElement('button');
        rm.className = 'nav-remove';
        rm.title = '删除站点';
        rm.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
          '<path d="M18 6 6 18M6 6l12 12"/></svg>';
        rm.addEventListener('click', (e) => {
          e.stopPropagation();
          removeSite(site.id);
        });
        item.appendChild(rm);
      }

      item.addEventListener('click', () => select(site.id));
      nav.appendChild(item);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'ai-nav-add';
    const addBtn = document.createElement('button');
    addBtn.className = 'ai-add-btn';
    addBtn.type = 'button';
    addBtn.textContent = '+ 添加站点';
    addBtn.addEventListener('click', () => form.classList.add('open'));

    const form = document.createElement('div');
    form.className = 'ai-add-form';
    const nameInput = document.createElement('input');
    nameInput.className = 'form-input';
    nameInput.placeholder = '名称，如：ChatGPT';
    nameInput.maxLength = 20;
    const urlInput = document.createElement('input');
    urlInput.className = 'form-input';
    urlInput.placeholder = 'https://...';
    const row = document.createElement('div');
    row.className = 'ai-add-form-row';
    const save = document.createElement('button');
    save.className = 'form-btn form-btn-primary';
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', () => submitAdd());
    const cancel = document.createElement('button');
    cancel.className = 'form-btn';
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => form.classList.remove('open'));
    row.append(save, cancel);
    form.append(nameInput, urlInput, row);
    addWrap.append(addBtn, form);
    nav.appendChild(addWrap);

    function submitAdd() {
      const name = nameInput.value.trim();
      const url = urlInput.value.trim();
      if (!name || !url) return;
      let full = url;
      if (!/^https?:\/\//i.test(full)) full = 'https://' + full;
      if (sites.some((s) => s.url === full)) return;
      const site = { id: uid(), name, url: full, builtin: false };
      sites.push(site);
      state.aiSites.push(site);
      persist();
      render();
      select(site.id);
    }
  }

  function removeSite(id) {
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sites.splice(idx, 1);
    const customIdx = state.aiSites.findIndex((s) => s.id === id);
    if (customIdx !== -1) state.aiSites.splice(customIdx, 1);
    persist();
    if (activeId === id) activeId = null;
    render();
    if (activeId === null && sites.length) select(sites[0].id);
  }

  // Called by script.js after init() resolves state
  window.renderAiPanel = function () {
    const saved = Array.isArray(state.aiSites) ? state.aiSites : [];
    sites = BUILTIN_SITES.map((b) => ({ ...b })).concat(
      saved
        .filter((s) => s && typeof s === 'object' && s.name && s.url && !s.builtin)
        .map((s) => ({ id: String(s.id), name: String(s.name), url: String(s.url), builtin: false }))
    );
    render();
    if (sites.length) select(sites[0].id);
  };

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });

  // If script.js already finished init (state ready) before this script
  // parsed, render immediately; otherwise script.js retries on a timer.
  if (window.__stateReady) window.renderAiPanel();
})();