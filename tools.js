/* ================================================
   Tools Page — Logic for 10 utilities
   Inherits theme via styles.css vars (no chrome.storage)
   ================================================ */

// ---------- Theme sync ----------
(function syncTheme() {
  // Read from chrome.storage.local (same as main page) or localStorage fallback
  function read() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get('state', (s) => resolve(s.state || {}));
        } else {
          const raw = localStorage.getItem('newtab_state');
          resolve(raw ? JSON.parse(raw) : {});
        }
      } catch (e) { resolve({}); }
    });
  }
  read().then((state) => {
    const mode = state.themeMode || 'auto';
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-light');
    if (mode === 'dark') html.classList.add('theme-dark');
    else if (mode === 'light') html.classList.add('theme-light');
  });
})();

// ---------- Sidebar navigation ----------
document.querySelectorAll('.tool-nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tool;
    document.querySelectorAll('.tool-nav').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tool-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
  });
});

// ---------- Theme toggle button ----------
const themeBtn = document.getElementById('toolsThemeBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('theme-dark');
    html.classList.remove('theme-dark', 'theme-light');
    if (isDark) html.classList.add('theme-light');
    else html.classList.add('theme-dark');
    // Persist
    const mode = isDark ? 'light' : 'dark';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get('state', (s) => {
          const next = { ...(s.state || {}), themeMode: mode };
          chrome.storage.local.set({ state: next });
        });
      } else {
        const raw = localStorage.getItem('newtab_state');
        const data = raw ? JSON.parse(raw) : {};
        data.themeMode = mode;
        localStorage.setItem('newtab_state', JSON.stringify(data));
      }
    } catch (e) { /* ignore */ }
  });
}

// ---------- Calculator ----------
(function calculator() {
  const display = document.getElementById('calcDisplay');
  if (!display) return;
  let current = '0';
  let prev = null;
  let op = null;
  let justEvaluated = false;

  function setDisplay(v) {
    let s = String(v);
    if (s.length > 14) s = Number(v).toExponential(8);
    display.value = s;
  }

  function applyNum(n) {
    if (justEvaluated) { current = '0'; justEvaluated = false; }
    if (current === '0' && n !== '.') current = n;
    else if (n === '.' && current.includes('.')) return;
    else current = current + n;
    setDisplay(current);
  }

  function applyOp(o) {
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
    current = '0'; prev = null; op = null; justEvaluated = false;
    setDisplay(current);
  }

  function sign() {
    if (current !== '0') {
      current = current.startsWith('-') ? current.slice(1) : '-' + current;
      setDisplay(current);
    }
  }

  function percent() {
    current = String(parseFloat(current) / 100);
    setDisplay(current);
  }

  function dot() {
    if (justEvaluated) { current = '0'; justEvaluated = false; }
    if (!current.includes('.')) current += '.';
    setDisplay(current);
  }

  function equals() {
    if (prev === null || op === null) return;
    const result = compute(prev, current, op);
    setDisplay(result);
    current = String(result);
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

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('[data-panel="calculator"].active')) return;
    if (e.key >= '0' && e.key <= '9') applyNum(e.key);
    else if (e.key === '.') dot();
    else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') applyOp(e.key);
    else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
    else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') clear();
    else if (e.key === '%') percent();
  });
})();

// ---------- Base converter ----------
(function baseConverter() {
  const fields = {
    bin: document.getElementById('baseBin'),
    oct: document.getElementById('baseOct'),
    dec: document.getElementById('baseDec'),
    hex: document.getElementById('baseHex'),
  };
  if (!fields.dec) return;

  function updateFrom(source, value) {
    const v = (value || '').trim();
    if (!v) {
      Object.values(fields).forEach((f) => { if (f !== source) f.value = ''; });
      return;
    }
    let n;
    try {
      if (source === 'bin') n = parseInt(v.replace(/\s+/g, ''), 2);
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

// ---------- Encode / Decode ----------
(function encodeTool() {
  const input = document.getElementById('encInput');
  const output = document.getElementById('encOutput');
  if (!input) return;

  document.querySelectorAll('[data-enc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = input.value;
      const action = btn.dataset.enc;
      try {
        if (action === 'base64-encode') {
          output.value = btoa(unescape(encodeURIComponent(v)));
        } else if (action === 'base64-decode') {
          output.value = decodeURIComponent(escape(atob(v)));
        } else if (action === 'url-encode') {
          output.value = encodeURIComponent(v);
        } else if (action === 'url-decode') {
          output.value = decodeURIComponent(v);
        } else if (action === 'unicode-escape') {
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

// ---------- Amount to Chinese uppercase ----------
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
      let s = '';
      let group = 0;
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

// ---------- Color picker ----------
(function colorTool() {
  const picker = document.getElementById('colorPicker');
  const hexInput = document.getElementById('colorHex');
  const swatches = document.getElementById('colorSwatches');
  const info = document.getElementById('colorInfo');
  if (!picker) return;

  // Generate palette
  const basePalette = [
    '#000000', '#ffffff', '#f3f3f3', '#0067c0', '#4cc2ff',
    '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899',
    '#0891b2', '#65a30d', '#ea580c', '#1f2937', '#94a3b8',
    '#f8f4f1', '#fef3c7', '#dbeafe', '#dcfce7', '#fee2e2',
  ];
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
    return {
      r: parseInt(m.substr(0, 2), 16),
      g: parseInt(m.substr(2, 2), 16),
      b: parseInt(m.substr(4, 2), 16),
    };
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
  function updateFromHex(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    picker.value = hex;
    hexInput.value = hex;
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    info.textContent =
      `HEX: ${hex.toUpperCase()}\n` +
      `RGB: rgb(${r}, ${g}, ${b})\n` +
      `HSL: hsl(${h}, ${s}%, ${l}%)\n` +
      `CSS: ${hex}`;
  }
  function updateFromPicker() {
    updateFromHex(picker.value);
  }

  picker.addEventListener('input', updateFromPicker);
  hexInput.addEventListener('input', () => {
    let v = hexInput.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    updateFromHex(v);
  });

  updateFromHex(picker.value);
})();

// ---------- Random picker ----------
(function randomTool() {
  const inputs = Array.from(document.querySelectorAll('#randomInputs input'));
  const btn = document.getElementById('randomGo');
  const result = document.getElementById('randomResult');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const options = inputs.map((i) => i.value.trim()).filter(Boolean);
    if (options.length === 0) {
      result.textContent = '请至少填入 1 个选项';
      result.classList.add('empty');
      return;
    }
    result.classList.remove('empty');
    result.textContent = '...';
    // Simple animation
    let count = 0;
    const maxCycles = 12;
    const tick = setInterval(() => {
      result.textContent = options[Math.floor(Math.random() * options.length)];
      count++;
      if (count >= maxCycles) {
        clearInterval(tick);
        const finalChoice = options[Math.floor(Math.random() * options.length)];
        result.textContent = '🎯 ' + finalChoice;
      }
    }, 70);
  });
})();

// ---------- QR code ----------
(function qrTool() {
  const input = document.getElementById('qrInput');
  const output = document.getElementById('qrOutput');
  const btn = document.getElementById('qrGen');
  if (!btn) return;

  // Minimal QR code generator (renders to canvas using a basic implementation)
  // Using a tiny embedded QR library via dynamic import from CDN fallback
  // For simplicity, use a web API or a minimal pure-JS implementation

  // Use a lightweight approach: load qrcode-svg via CDN text rendering
  function generateQR(text, size = 240) {
    output.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    output.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Pure JS QR encoder: implement via minimal algorithm
    // For simplicity, we use a known minimal implementation pattern
    // Inline a tiny QR encoder; if text too long, error
    try {
      QRCode.toCanvas(canvas, text, { width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    } catch (e) {
      output.innerHTML = '<div style="color:red">生成失败: ' + e.message + '</div>';
    }
  }

  // Load qrcode.js from CDN
  if (!window.QRCode) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    script.onload = () => {
      btn.disabled = false;
      if (input.value) generateQR(input.value);
    };
    script.onerror = () => {
      btn.disabled = true;
      output.textContent = '无法加载二维码库（需要联网）';
    };
    document.head.appendChild(script);
    btn.disabled = true;
  }

  btn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { output.innerHTML = '<div style="color:#888">请输入文本</div>'; return; }
    if (window.QRCode) generateQR(text);
    else output.textContent = '二维码库还在加载中...';
  });
})();

// ---------- JSON formatter ----------
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
      output.value = mode === 'minify'
        ? JSON.stringify(obj)
        : JSON.stringify(obj, null, 2);
      status.textContent = '✓ 有效 JSON';
      status.className = 'tool-status success';
    } catch (e) {
      status.textContent = '✗ JSON 解析失败: ' + e.message;
      status.className = 'tool-status error';
      output.value = '';
    }
  }
  formatBtn.addEventListener('click', () => process('format'));
  minifyBtn.addEventListener('click', () => process('minify'));
})();

// ---------- UUID generator ----------
(function uuidTool() {
  const count = document.getElementById('uuidCount');
  const output = document.getElementById('uuidOutput');
  const btn = document.getElementById('uuidGen');
  if (!btn) return;

  function uuid() {
    // RFC 4122 v4
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  btn.addEventListener('click', () => {
    let n = parseInt(count.value, 10) || 1;
    n = Math.max(1, Math.min(20, n));
    count.value = n;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(uuid());
    output.value = ids.join('\n');
  });

  // Generate one initially
  btn.click();
})();

// ---------- Timestamp ----------
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
    // Accept seconds or milliseconds
    let n = parseInt(v, 10);
    if (isNaN(n)) { tsOut.textContent = '请输入有效时间戳'; return; }
    if (v.length <= 10) n = n * 1000;
    const d = new Date(n);
    tsOut.textContent = d.toLocaleString('zh-CN', { hour12: false }) + '\n' + d.toISOString();
  });

  document.getElementById('tsToUnix').addEventListener('click', () => {
    const v = dateInput.value.trim();
    if (!v) { dateOut.textContent = ''; return; }
    // Try ISO first, then various formats
    let d = new Date(v);
    if (isNaN(d.getTime())) {
      // Try YYYY-MM-DD HH:MM:SS
      d = new Date(v.replace(' ', 'T'));
    }
    if (isNaN(d.getTime())) { dateOut.textContent = '无法解析该日期格式'; return; }
    dateOut.textContent = Math.floor(d.getTime() / 1000).toString() + ' 秒\n' + d.getTime() + ' 毫秒';
  });
})();
