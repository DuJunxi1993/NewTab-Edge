/* ================================================
   Tools Side Panel — Controller
   Lives inside newtab.html; theme is inherited from
   <html class="theme-..."> (set by main page applyTheme).
   ================================================ */

// ---------- Panel open / close ----------
(function panelController() {
  const panel = document.getElementById('toolsPanel');
  const backdrop = document.getElementById('toolsBackdrop');
  const closeBtn = document.getElementById('toolsSheetClose');
  if (!panel) return;

  function open() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  // Expose for main page (script.js) to call
  window.openToolsPanel = open;
  window.closeToolsPanel = close;

  // Footer Tools button now opens the panel
  const toolsBtn = document.getElementById('toolsBtnTop');
  if (toolsBtn) toolsBtn.addEventListener('click', open);

  // Click backdrop or close button = close
  backdrop.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  // ESC closes the panel when open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
  });
})();

// ---------- Tab switching ----------
(function tabSwitcher() {
  const tabs = document.querySelectorAll('.tools-sheet-tab');
  const panels = document.querySelectorAll('.tool-panel');
  if (!tabs.length) return;

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tool;
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
    });
  });
})();

// ---------- Toast ----------
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ============================================================
// Calculator (with history, max 6)
// ============================================================
(function calculator() {
  const display = document.getElementById('calcDisplay');
  const historyList = document.getElementById('calcHistoryList');
  const historyClear = document.getElementById('calcHistoryClear');
  if (!display) return;

  let current = '0';
  let prev = null;
  let op = null;
  let justEvaluated = false;
  let exprBuf = '';
  let history = [];
  const HISTORY_MAX = 6;

  function setDisplay(v) {
    let s = String(v);
    if (s.length > 14) {
      const n = Number(v);
      if (!isNaN(n)) s = n.toExponential(7);
    }
    display.value = s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    if (history.length === 0) {
      historyList.innerHTML = '<li class="calc-history-empty">尚无记录</li>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<li class="calc-history-item" data-idx="${i}" tabindex="0"><span class="expr">${escapeHtml(h.expr)} =</span><span class="result">${escapeHtml(h.result)}</span></li>`
    ).join('');
    historyList.querySelectorAll('.calc-history-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        if (history[idx]) {
          display.value = history[idx].result;
          current = history[idx].result;
          prev = null; op = null; justEvaluated = true;
        }
      });
    });
  }

  function applyNum(n) {
    if (justEvaluated) { current = '0'; exprBuf = ''; justEvaluated = false; }
    if (current === '0' && n !== '.') current = n;
    else if (n === '.' && current.includes('.')) return;
    else current = current + n;
    setDisplay(current);
  }

  function applyOp(o) {
    const opSym = { '+': '+', '-': '-', '*': '×', '/': '÷' }[o];
    if (prev !== null && op !== null && !justEvaluated) {
      const result = compute(prev, current, op);
      prev = String(result);
      setDisplay(prev);
      current = String(result);
    } else {
      prev = current;
    }
    op = o;
    justEvaluated = false;
    current = '0';
    setDisplay(current);
  }

  function compute(a, b, o) {
    const x = parseFloat(a), y = parseFloat(b);
    if (isNaN(x) || isNaN(y)) return 0;
    if (o === '+') return x + y;
    if (o === '-') return x - y;
    if (o === '*') return x * y;
    if (o === '/') return y === 0 ? 'Error' : x / y;
    return y;
  }

  function clear() {
    current = '0'; prev = null; op = null; justEvaluated = false; exprBuf = '';
    setDisplay(current);
  }
  function sign() {
    if (current !== '0') {
      current = current.startsWith('-') ? current.slice(1) : '-' + current;
      setDisplay(current);
    }
  }
  function percent() {
    const n = parseFloat(current) / 100;
    current = String(n);
    setDisplay(current);
  }
  function dot() {
    if (justEvaluated) { current = '0'; exprBuf = ''; justEvaluated = false; }
    if (!current.includes('.')) current += '.';
    setDisplay(current);
  }
  function equals() {
    if (prev === null || op === null) return;
    const a = prev, b = current, o = op;
    const result = compute(a, b, o);
    const finalResult = String(result);
    const finalExpr = `${a} ${({'+':'+','-':'-','*':'×','/':'÷'})[o]} ${b}`;
    setDisplay(finalResult);
    pushHistory(finalExpr, finalResult);
    current = finalResult;
    prev = null;
    op = null;
    justEvaluated = true;
  }

  document.querySelectorAll('.calc-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const num = btn.dataset.num;
      const opVal = btn.dataset.op;
      const action = btn.dataset.action;
      if (num !== undefined) applyNum(num);
      else if (opVal !== undefined) applyOp(opVal);
      else if (action === 'clear') clear();
      else if (action === 'sign') sign();
      else if (action === 'percent') percent();
      else if (action === 'dot') dot();
      else if (action === 'equals') equals();
    });
  });

  if (historyClear) historyClear.addEventListener('click', () => { history = []; renderHistory(); });

  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('.tool-panel[data-panel="calculator"].active')) return;
    if (e.key >= '0' && e.key <= '9') applyNum(e.key);
    else if (e.key === '.') dot();
    else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') applyOp(e.key);
    else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
    else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') clear();
    else if (e.key === '%') percent();
  });

  renderHistory();
})();

// ============================================================
// Base converter
// ============================================================
(function baseConverter() {
  const fields = {
    bin: document.getElementById('baseBin'),
    oct: document.getElementById('baseOct'),
    dec: document.getElementById('baseDec'),
    hex: document.getElementById('baseHex'),
  };
  if (!fields.dec) return;
  function updateFrom(source, value) {
    const v = (value || '').trim().replace(/\s+/g, '');
    if (!v) {
      Object.values(fields).forEach((f) => { if (f !== source) f.value = ''; });
      return;
    }
    let n;
    try {
      if (source === 'bin') n = parseInt(v, 2);
      else if (source === 'oct') n = parseInt(v, 8);
      else if (source === 'dec') n = parseInt(v, 10);
      else if (source === 'hex') n = parseInt(v, 16);
    } catch (e) { return; }
    if (isNaN(n)) return;
    if (source !== 'bin') fields.bin.value = n.toString(2);
    if (source !== 'oct') fields.oct.value = n.toString(8);
    if (source !== 'dec') fields.dec.value = String(n);
    if (source !== 'hex') fields.hex.value = n.toString(16).toUpperCase();
  }
  Object.entries(fields).forEach(([name, el]) => {
    el.addEventListener('input', () => updateFrom(name, el.value));
  });
})();

// ============================================================
// Encode / Decode
// ============================================================
(function encodeTool() {
  const input = document.getElementById('encInput');
  const output = document.getElementById('encOutput');
  if (!input) return;
  document.querySelectorAll('[data-enc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = input.value;
      const action = btn.dataset.enc;
      try {
        if (action === 'base64-encode') output.value = btoa(unescape(encodeURIComponent(v)));
        else if (action === 'base64-decode') output.value = decodeURIComponent(escape(atob(v)));
        else if (action === 'url-encode') output.value = encodeURIComponent(v);
        else if (action === 'url-decode') output.value = decodeURIComponent(v);
        else if (action === 'unicode-escape') {
          let out = '';
          for (const c of v) {
            const code = c.codePointAt(0);
            if (code > 127) out += '\\\\u' + code.toString(16).padStart(4, '0');
            else out += c;
          }
          output.value = out;
        }
      } catch (e) {
        output.value = '编码失败: ' + e.message;
      }
    });
  });
})();

// ============================================================
// Amount to Chinese uppercase
// ============================================================
(function amountTool() {
  const input = document.getElementById('amountInput');
  const output = document.getElementById('amountOutput');
  const btn = document.getElementById('amountConvert');
  if (!btn) return;

  function numToChinese(num) {
    if (num === 0) return '零元整';
    const sign = num < 0 ? '负' : '';
    num = Math.abs(num);
    const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const units = ['', '拾', '佰', '仟'];
    const bigUnits = ['', '万', '亿', '万亿'];
    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);
    function intToCn(n) {
      if (n === 0) return '';
      let s = ''; let group = 0;
      while (n > 0) {
        const chunk = n % 10000;
        if (chunk !== 0) {
          let cs = '';
          let temp = chunk;
          for (let i = 0; i < 4; i++) {
            const d = temp % 10;
            if (d !== 0) cs = digits[d] + units[i] + cs;
            else if (cs && !cs.startsWith('零')) cs = '零' + cs;
            temp = Math.floor(temp / 10);
          }
          cs = cs.replace(/零+$/, '');
          s = cs + bigUnits[group] + s;
        } else if (s && !s.startsWith('零')) {
          s = '零' + s;
        }
        n = Math.floor(n / 10000);
        group++;
      }
      return s;
    }
    let result = sign + intToCn(intPart) + '元';
    if (decPart === 0) result += '整';
    else {
      const jiao = Math.floor(decPart / 10);
      const fen = decPart % 10;
      result += (jiao ? digits[jiao] + '角' : '零') + (fen ? digits[fen] + '分' : '');
    }
    return result + '整';
  }

  btn.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { output.value = ''; return; }
    const num = parseFloat(raw);
    if (isNaN(num)) { output.value = '请输入有效数字'; return; }
    output.value = numToChinese(num);
  });
})();

// ============================================================
// Color picker
// ============================================================
(function colorTool() {
  const picker = document.getElementById('colorPicker');
  const hexInput = document.getElementById('colorHex');
  const swatches = document.getElementById('colorSwatches');
  const paletteCount = document.getElementById('paletteCount');
  const preview = document.getElementById('colorPreview');
  const colorR = document.getElementById('colorR');
  const colorG = document.getElementById('colorG');
  const colorB = document.getElementById('colorB');
  const info = document.getElementById('colorInfo');
  if (!picker) return;

  const basePalette = [
    '#000000', '#1f2937', '#4b5563', '#9ca3af', '#ffffff', '#f3f4f6', '#dbeafe', '#fee2e2',
    '#1e3a8a', '#0067c0', '#4cc2ff', '#16a34a', '#dc2626', '#f59e0b', '#facc15', '#fb923c',
    '#8b5cf6', '#ec4899', '#f43f5e', '#f8f4f1', '#fef3c7', '#dcfce7', '#0f766e', '#1f2937',
  ];
  paletteCount.textContent = `${basePalette.length} colors`;

  basePalette.forEach((hex) => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = hex;
    sw.title = hex;
    sw.addEventListener('click', () => updateFromHex(hex));
    swatches.appendChild(sw);
  });

  function hexToRgb(hex) {
    const m = hex.replace('#', '');
    return { r: parseInt(m.substr(0, 2), 16), g: parseInt(m.substr(2, 2), 16), b: parseInt(m.substr(4, 2), 16) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function clamp255(n) { return Math.max(0, Math.min(255, n | 0)); }

  function updateFromHex(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    picker.value = hex;
    hexInput.value = hex.toUpperCase();
    preview.style.background = hex;
    const { r, g, b } = hexToRgb(hex);
    colorR.value = r; colorG.value = g; colorB.value = b;
    const { h, s, l } = rgbToHsl(r, g, b);
    info.textContent =
      `HEX: ${hex.toUpperCase()}\n` +
      `RGB: rgb(${r}, ${g}, ${b})\n` +
      `HSL: hsl(${h}, ${s}%, ${l}%)\n` +
      `CSS: ${hex}`;
  }

  function updateFromRgb() {
    const r = clamp255(parseInt(colorR.value, 10));
    const g = clamp255(parseInt(colorG.value, 10));
    const b = clamp255(parseInt(colorB.value, 10));
    const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
    updateFromHex(hex);
  }

  picker.addEventListener('input', () => updateFromHex(picker.value));
  hexInput.addEventListener('input', () => {
    let v = hexInput.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    updateFromHex(v);
  });
  [colorR, colorG, colorB].forEach((el) => el.addEventListener('input', updateFromRgb));
  updateFromHex(picker.value);
})();

// ============================================================
// Random picker
// ============================================================
(function randomTool() {
  const inputs = Array.from(document.querySelectorAll('#randomInputs input'));
  const btn = document.getElementById('randomGo');
  const result = document.getElementById('randomResult');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const options = inputs.map((i) => i.value.trim()).filter(Boolean);
    if (options.length === 0) {
      result.classList.add('empty');
      result.innerHTML = '<span class="random-result-placeholder">请至少填入 1 个选项</span>';
      return;
    }
    result.classList.remove('empty');
    let count = 0;
    const maxCycles = 14;
    const tick = setInterval(() => {
      result.textContent = options[Math.floor(Math.random() * options.length)];
      count++;
      if (count >= maxCycles) {
        clearInterval(tick);
        const finalChoice = options[Math.floor(Math.random() * options.length)];
        result.textContent = finalChoice;
        toast('已选出: ' + finalChoice);
      }
    }, 60);
  });
})();

// ============================================================
// JSON formatter
// ============================================================
(function jsonTool() {
  const input = document.getElementById('jsonInput');
  const output = document.getElementById('jsonOutput');
  const status = document.getElementById('jsonStatus');
  const formatBtn = document.getElementById('jsonFormat');
  const minifyBtn = document.getElementById('jsonMinify');
  if (!formatBtn) return;
  function process(mode) {
    try {
      const obj = JSON.parse(input.value);
      output.value = mode === 'minify' ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
      status.textContent = '✓ 有效 JSON';
      status.className = 'status-line success';
    } catch (e) {
      status.textContent = '✗ JSON 解析失败: ' + e.message;
      status.className = 'status-line error';
      output.value = '';
    }
  }
  formatBtn.addEventListener('click', () => process('format'));
  minifyBtn.addEventListener('click', () => process('minify'));
})();

// ============================================================
// UUID generator
// ============================================================
(function uuidTool() {
  const count = document.getElementById('uuidCount');
  const output = document.getElementById('uuidOutput');
  const gen = document.getElementById('uuidGen');
  const copy = document.getElementById('uuidCopy');
  if (!gen) return;
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  gen.addEventListener('click', () => {
    let n = parseInt(count.value, 10) || 1;
    n = Math.max(1, Math.min(20, n));
    count.value = n;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(uuid());
    output.value = ids.join('\n');
  });
  if (copy) {
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(output.value);
        toast('已复制到剪贴板');
      } catch (e) {
        output.select(); document.execCommand('copy');
        toast('已复制');
      }
    });
  }
  gen.click();
})();

// ============================================================
// Timestamp
// ============================================================
(function timestampTool() {
  const unixEl = document.getElementById('tsNowUnix');
  const isoEl = document.getElementById('tsNowIso');
  const localEl = document.getElementById('tsNowLocal');
  const tsInput = document.getElementById('tsInput');
  const tsOut = document.getElementById('tsToDateOut');
  const dateInput = document.getElementById('tsDateInput');
  const dateOut = document.getElementById('tsToUnixOut');
  if (!unixEl) return;
  function tick() {
    const now = new Date();
    unixEl.textContent = Math.floor(now.getTime() / 1000).toString();
    isoEl.textContent = now.toISOString();
    localEl.textContent = now.toLocaleString('zh-CN', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
  document.getElementById('tsToDate').addEventListener('click', () => {
    const v = tsInput.value.trim();
    if (!v) { tsOut.textContent = ''; return; }
    let n = parseInt(v, 10);
    if (isNaN(n)) { tsOut.textContent = '请输入有效时间戳'; return; }
    if (v.length <= 10) n = n * 1000;
    const d = new Date(n);
    tsOut.textContent = d.toLocaleString('zh-CN', { hour12: false }) + '\n' + d.toISOString();
  });
  document.getElementById('tsToUnix').addEventListener('click', () => {
    const v = dateInput.value.trim();
    if (!v) { dateOut.textContent = ''; return; }
    let d = new Date(v);
    if (isNaN(d.getTime())) d = new Date(v.replace(' ', 'T'));
    if (isNaN(d.getTime())) { dateOut.textContent = '无法解析该日期格式'; return; }
    dateOut.textContent = Math.floor(d.getTime() / 1000).toString() + ' 秒\n' + d.getTime() + ' 毫秒';
  });
})();
