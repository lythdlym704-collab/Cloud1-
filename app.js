/* APK Studio — منطق الواجهة */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ------------------------------------------------------------ templates --
  const T = {
    counter: {
      mode: 'web', appName: 'عدّاد', packageName: 'com.example.counter',
      html: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>عدّاد</title>
</head>
<body>
  <main class="card">
    <h1>العدّاد</h1>
    <div id="count">0</div>
    <div class="row">
      <button id="dec">−</button>
      <button id="reset">تصفير</button>
      <button id="inc">+</button>
    </div>
    <p class="hint">يُحفظ الرقم تلقائياً على الجهاز</p>
  </main>
</body>
</html>`,
      css: `body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #eef2ff; }
.card { background: #fff; padding: 32px 28px; border-radius: 20px; box-shadow: 0 10px 30px -10px rgba(0,0,0,.2); text-align: center; width: min(90vw, 320px); }
h1 { margin: 0 0 8px; color: #3b6fe0; font-size: 22px; }
#count { font-size: 72px; font-weight: 800; margin: 8px 0 16px; transition: transform .1s; }
#count.bump { transform: scale(1.15); }
.row { display: flex; gap: 10px; justify-content: center; }
button { flex: 1; font-size: 22px; padding: 12px; border: 0; border-radius: 12px; background: #3b6fe0; color: #fff; cursor: pointer; }
#reset { background: #e5e7eb; color: #333; font-size: 15px; }
.hint { color: #888; font-size: 12px; margin: 14px 0 0; }`,
      js: `let count = Number(localStorage.getItem('count') || 0);
const el = document.getElementById('count');

function render() {
  el.textContent = count;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 100);
}

function saveCount() {
  localStorage.setItem('count', count);
}

function change(delta) {
  count += delta;
  render();
  saveCount();
  if (window.Android && Android.vibrate) Android.vibrate(20);
}

document.getElementById('inc').addEventListener('click', () => change(1));
document.getElementById('dec').addEventListener('click', () => change(-1));
document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  render();
  saveCount();
  if (window.Android && Android.showToast) Android.showToast('تم التصفير');
});

render();`,
      java: '', layout: '', permissions: ['VIBRATE'],
    },
    todo: {
      mode: 'web', appName: 'مهامي', packageName: 'com.example.todo',
      html: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>مهامي</title>
</head>
<body>
  <header><h1>📝 مهامي</h1><span id="stats"></span></header>
  <form id="form">
    <input id="input" placeholder="أضف مهمة جديدة…" autocomplete="off" required>
    <button type="submit">إضافة</button>
  </form>
  <ul id="list"></ul>
  <p id="empty">لا توجد مهام بعد 🎉</p>
</body>
</html>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; background: #f6f7fb; color: #222; }
header { display: flex; justify-content: space-between; align-items: center; padding: 18px 16px 8px; }
h1 { margin: 0; font-size: 20px; } #stats { color: #777; font-size: 13px; }
form { display: flex; gap: 8px; padding: 8px 16px; }
input { flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #ddd; font-size: 15px; }
button { padding: 12px 16px; border: 0; border-radius: 12px; background: #1fb6a6; color: #fff; font-size: 15px; }
ul { list-style: none; margin: 8px 0; padding: 0 16px; }
li { display: flex; align-items: center; gap: 10px; background: #fff; padding: 12px; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 2px 8px -4px rgba(0,0,0,.15); }
li.done span { text-decoration: line-through; color: #999; }
li span { flex: 1; } li .del { background: none; color: #d9534f; font-size: 18px; padding: 0 6px; }
#empty { text-align: center; color: #999; margin-top: 40px; }`,
      js: `const KEY = 'todos';
let todos = JSON.parse(localStorage.getItem(KEY) || '[]');
const list = document.getElementById('list');
const form = document.getElementById('form');
const input = document.getElementById('input');

function save() { localStorage.setItem(KEY, JSON.stringify(todos)); }

function render() {
  list.innerHTML = '';
  todos.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = t.done ? 'done' : '';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = t.done;
    cb.addEventListener('change', () => toggleTodo(i));
    const span = document.createElement('span');
    span.textContent = t.text;
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕';
    del.addEventListener('click', () => deleteTodo(i));
    li.append(cb, span, del);
    list.appendChild(li);
  });
  document.getElementById('empty').style.display = todos.length ? 'none' : 'block';
  const done = todos.filter(t => t.done).length;
  document.getElementById('stats').textContent = todos.length ? done + ' / ' + todos.length + ' مكتملة' : '';
}

function addTodo(text) { todos.push({ text, done: false }); save(); render(); }
function toggleTodo(i) { todos[i].done = !todos[i].done; save(); render(); }
function deleteTodo(i) { todos.splice(i, 1); save(); render(); }

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTodo(text);
  input.value = '';
});

render();`,
      java: '', layout: '', permissions: [],
    },
    calc: {
      mode: 'web', appName: 'آلة حاسبة', packageName: 'com.example.calculator',
      html: `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>آلة حاسبة</title>
</head>
<body>
  <div class="calc">
    <div id="display" dir="ltr">0</div>
    <div class="keys" dir="ltr">
      <button class="op" data-k="C">C</button><button class="op" data-k="⌫">⌫</button><button class="op" data-k="%">%</button><button class="op" data-k="/">÷</button>
      <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="*">×</button>
      <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="-">−</button>
      <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="+">+</button>
      <button class="zero" data-k="0">0</button><button data-k=".">.</button><button class="eq" data-k="=">=</button>
    </div>
  </div>
</body>
</html>`,
      css: `body { margin: 0; min-height: 100vh; display: grid; place-items: end center; background: #111; font-family: system-ui, sans-serif; }
.calc { width: 100%; max-width: 400px; padding: 16px; box-sizing: border-box; }
#display { color: #fff; font-size: 56px; text-align: right; padding: 24px 8px; min-height: 80px; word-break: break-all; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
button { aspect-ratio: 1; border: 0; border-radius: 50%; font-size: 26px; background: #333; color: #fff; }
button.op { background: #a5a5a5; color: #000; } button.eq { background: #ff9f0a; } button.zero { grid-column: span 2; aspect-ratio: auto; border-radius: 40px; }
button:active { filter: brightness(1.4); }`,
      js: `const display = document.getElementById('display');
let expr = '';

function compute(e) {
  // تقييم آمن: أرقام وعوامل فقط
  if (!/^[0-9+\\-*/.% ]+$/.test(e)) return 'خطأ';
  try {
    const tokens = e.replace(/%/g, '/100').match(/(\\d+\\.?\\d*|[-+*/])/g) || [];
    let result = parseFloat(tokens[0]);
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i], n = parseFloat(tokens[i + 1]);
      if (op === '+') result += n; else if (op === '-') result -= n;
      else if (op === '*') result *= n; else if (op === '/') result = n === 0 ? NaN : result / n;
    }
    return Number.isFinite(result) ? String(+result.toFixed(10)) : 'خطأ';
  } catch { return 'خطأ'; }
}

function updateDisplay() { display.textContent = expr || '0'; }

document.querySelectorAll('.keys button').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.k;
  if (k === 'C') expr = '';
  else if (k === '⌫') expr = expr.slice(0, -1);
  else if (k === '=') expr = compute(expr);
  else expr += k;
  updateDisplay();
}));`,
      java: '', layout: '', permissions: [],
    },
    'java-hello': {
      mode: 'java', appName: 'مرحباً', packageName: 'com.example.hello', html: '', css: '', js: '', layout: '',
      java: `package com.example.hello;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private int taps = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#EEF2FF"));

        TextView title = new TextView(this);
        title.setText("مرحباً بالعالم 👋");
        title.setTextSize(28);
        title.setTextColor(Color.parseColor("#3B6FE0"));
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView counter = new TextView(this);
        counter.setText("عدد الضغطات: 0");
        counter.setTextSize(18);
        counter.setPadding(0, 40, 0, 40);
        root.addView(counter);

        Button button = new Button(this);
        button.setText("اضغط هنا");
        button.setOnClickListener(v -> {
            taps++;
            counter.setText("عدد الضغطات: " + taps);
            if (taps % 10 == 0) {
                Toast.makeText(this, "أحسنت! " + taps + " ضغطة", Toast.LENGTH_SHORT).show();
            }
        });
        root.addView(button);

        setContentView(root);
    }
}`,
      permissions: [],
    },
    blank: { mode: 'web', appName: 'تطبيقي', packageName: 'com.example.myapp', html: '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>تطبيقي</title>\n</head>\n<body>\n  <h1>مرحباً</h1>\n</body>\n</html>', css: '', js: '', java: '', layout: '', permissions: [] },
  };

  const FILES = {
    web: [['html', 'index.html'], ['css', 'style.css'], ['js', 'app.js']],
    java: [['java', 'MainActivity.java'], ['layout', 'activity_main.xml']],
  };
  const PERM_LABELS = { INTERNET: 'الإنترنت', ACCESS_NETWORK_STATE: 'حالة الشبكة', CAMERA: 'الكاميرا', RECORD_AUDIO: 'الميكروفون', ACCESS_FINE_LOCATION: 'الموقع الدقيق', ACCESS_COARSE_LOCATION: 'الموقع التقريبي', VIBRATE: 'الاهتزاز', POST_NOTIFICATIONS: 'الإشعارات', READ_MEDIA_IMAGES: 'الصور', WRITE_EXTERNAL_STORAGE: 'كتابة التخزين', READ_EXTERNAL_STORAGE: 'قراءة التخزين', BLUETOOTH: 'بلوتوث', NFC: 'NFC', WAKE_LOCK: 'إبقاء الجهاز مستيقظاً' };

  // --------------------------------------------------------------- state --
  const STORAGE_KEY = 'apkstudio.project.v1';
  let project = load() || structuredClone(T.counter);
  let currentFile = project.mode === 'java' ? 'java' : 'html';
  let sdkReady = false;
  let pollTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        /* ignore quota */
      }
    }, 300);
  }

  // ---------------------------------------------------------------- UI ----
  const editor = $('#editor');
  const gutter = $('#gutter');
  const toastEl = $('#toast');

  function toast(msg, type = '') {
    toastEl.textContent = msg;
    toastEl.className = `toast ${type}`;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => (toastEl.hidden = true), 3500);
  }

  function renderTabs() {
    const tabs = $('#file-tabs');
    tabs.innerHTML = '';
    for (const [key, label] of FILES[project.mode]) {
      const b = document.createElement('button');
      b.className = 'tab' + (key === currentFile ? ' active' : '');
      b.setAttribute('role', 'tab');
      b.textContent = label;
      if (!(project[key] || '').trim()) b.style.opacity = '.6';
      b.addEventListener('click', () => {
        currentFile = key;
        renderTabs();
        loadEditor();
      });
      tabs.appendChild(b);
    }
  }

  function loadEditor() {
    editor.value = project[currentFile] || '';
    updateGutter();
    updateCursor();
    $('#file-info').textContent = `${FILES[project.mode].find(([k]) => k === currentFile)[1]} • ${editor.value.length} حرف`;
  }

  function updateGutter() {
    const lines = editor.value.split('\n').length;
    let s = '';
    for (let i = 1; i <= lines; i++) s += i + '\n';
    gutter.textContent = s;
    gutter.scrollTop = editor.scrollTop;
  }
  function updateCursor() {
    const upTo = editor.value.slice(0, editor.selectionStart);
    const line = upTo.split('\n').length;
    const col = upTo.length - upTo.lastIndexOf('\n');
    $('#cursor-pos').textContent = `سطر ${line}، عمود ${col}`;
  }

  editor.addEventListener('input', () => {
    project[currentFile] = editor.value;
    save();
    updateGutter();
    updateCursor();
    $('#file-info').textContent = `${FILES[project.mode].find(([k]) => k === currentFile)[1]} • ${editor.value.length} حرف`;
  });
  editor.addEventListener('scroll', () => (gutter.scrollTop = editor.scrollTop));
  editor.addEventListener('keyup', updateCursor);
  editor.addEventListener('click', updateCursor);
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart;
      const en = editor.selectionEnd;
      editor.setRangeText('  ', s, en, 'end');
      editor.dispatchEvent(new Event('input'));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      build();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
      toast('تم الحفظ محلياً');
    }
  });

  // settings bindings
  const fields = ['appName', 'packageName', 'versionName', 'versionCode', 'color', 'orientation'];
  function renderSettings() {
    for (const f of fields) $('#' + f).value = project[f] ?? (f === 'versionName' ? '1.0' : f === 'versionCode' ? 1 : f === 'color' ? '#4f8cff' : f === 'orientation' ? 'unspecified' : '');
    $$('input[name="mode"]').forEach((r) => (r.checked = r.value === project.mode));
    renderPermissions();
    renderIcon();
  }
  for (const f of fields) {
    $('#' + f).addEventListener('input', (e) => {
      project[f] = e.target.value;
      save();
    });
  }
  $$('input[name="mode"]').forEach((r) =>
    r.addEventListener('change', () => {
      project.mode = r.value;
      currentFile = FILES[project.mode][0][0];
      if (project.mode === 'java' && !(project.java || '').trim()) project.java = T['java-hello'].java;
      save();
      renderTabs();
      loadEditor();
    })
  );

  function renderPermissions(suggested = []) {
    const wrap = $('#permissions');
    wrap.innerHTML = '';
    const list = Object.keys(PERM_LABELS);
    for (const p of list) {
      const label = document.createElement('label');
      if (suggested.includes(p)) label.classList.add('suggested');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = p;
      cb.checked = (project.permissions || []).includes(p);
      cb.addEventListener('change', () => {
        const set = new Set(project.permissions || []);
        cb.checked ? set.add(p) : set.delete(p);
        project.permissions = [...set];
        save();
        renderPermHint();
      });
      const ar = document.createElement('span');
      ar.className = 'ar';
      ar.textContent = PERM_LABELS[p];
      label.append(cb, document.createTextNode(` ${p} `), ar);
      wrap.appendChild(label);
    }
    renderPermHint();
  }
  function renderPermHint() {
    const n = (project.permissions || []).length;
    $('#perm-hint').textContent = n ? `(${n} مفعّلة)` : '(لا شيء)';
  }

  function renderIcon() {
    const img = $('#icon-preview');
    img.src = project.iconBase64 ? `data:image/png;base64,${project.iconBase64}` : 'icon.svg';
    $('#btn-icon-clear').hidden = !project.iconBase64;
  }
  $('#btn-icon').addEventListener('click', () => $('#icon-input').click());
  /** يحوّل أي صورة (JPG/PNG/WebP/GIF/BMP/SVG) إلى PNG مربّعة بحجم 512×512 مع قصّ الحواف الزائدة. */
  function imageToIconPng(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const SIZE = 512;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) return reject(new Error('تعذّر قراءة الصورة'));
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('الملف ليس صورة صالحة'));
      };
      img.src = url;
    });
  }

  $('#icon-input').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('اختر ملف صورة (JPG أو PNG أو WebP…)', 'error');
    if (f.size > 10 * 1024 * 1024) return toast('الصورة كبيرة جداً (الحد 10MB)', 'error');
    try {
      project.iconBase64 = await imageToIconPng(f);
      save();
      renderIcon();
      toast(f.type === 'image/png' ? 'تم تعيين الأيقونة' : 'تم تحويل الصورة إلى PNG وتعيينها أيقونةً');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  $('#btn-icon-clear').addEventListener('click', () => {
    delete project.iconBase64;
    save();
    renderIcon();
  });

  // templates / import
  $('#template').addEventListener('change', (e) => {
    const key = e.target.value;
    e.target.value = '';
    if (!key) return;
    if (!confirm('سيتم استبدال الكود الحالي بالقالب. متابعة؟')) return;
    project = { ...project, ...structuredClone(T[key]) };
    delete project.iconBase64;
    currentFile = FILES[project.mode][0][0];
    save();
    renderSettings();
    renderTabs();
    loadEditor();
    toast('تم تحميل القالب');
  });
  $('#btn-import').addEventListener('click', () => $('#import-input').click());
  $('#import-input').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const ext = f.name.split('.').pop().toLowerCase();
    const map = { html: 'html', htm: 'html', css: 'css', js: 'js', java: 'java', xml: 'layout' };
    const key = map[ext] || currentFile;
    if (key === 'java' || key === 'layout') {
      project.mode = 'java';
    } else if (project.mode !== 'web') project.mode = 'web';
    project[key] = text;
    currentFile = key;
    save();
    renderSettings();
    renderTabs();
    loadEditor();
    toast(`تم استيراد ${f.name}`);
    e.target.value = '';
  });

  // output tabs
  function showOut(name) {
    $$('.output-panel .tab').forEach((t) => t.classList.toggle('active', t.dataset.out === name));
    $$('.out').forEach((o) => o.classList.toggle('active', o.id === 'out-' + name));
  }
  $$('.output-panel .tab').forEach((t) => t.addEventListener('click', () => showOut(t.dataset.out)));

  // --------------------------------------------------------------- API ----
  async function api(path, body, raw = false) {
    const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (raw) {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `خطأ ${res.status}`);
      return res;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
    return data;
  }

  function payload() {
    return { mode: project.mode, appName: project.appName, packageName: project.packageName, versionName: project.versionName, versionCode: project.versionCode, color: project.color, orientation: project.orientation, permissions: project.permissions || [], iconBase64: project.iconBase64 || null, html: project.html || '', css: project.css || '', js: project.js || '', java: project.java || '', layout: project.layout || '' };
  }

  async function refreshStatus() {
    const el = $('#sdk-status');
    try {
      const s = await api('/api/status');
      sdkReady = s.ready;
      el.className = 'status ' + (s.ready ? 'ok' : 'bad');
      el.querySelector('.status-text').textContent = s.ready ? `أدوات البناء جاهزة • build-tools ${s.buildTools} • ${s.platform}` : `أدوات البناء غير مكتملة (${s.missing.join(', ')}) — يمكنك الفحص والمعاينة والتصدير فقط`;
      el.title = s.ready ? s.sdkRoot : s.hint;
    } catch {
      el.className = 'status bad';
      el.querySelector('.status-text').textContent = 'تعذّر الاتصال بالخادم';
    }
  }

  // ------------------------------------------------------------ analyze ----
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  function renderReport(r) {
    const out = $('#out-report');
    const scoreCls = r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'low';
    const stats = Object.entries(r.stats || {}).map(([k, v]) => `<span class="stat">${esc({ html: 'HTML', css: 'CSS', js: 'JS', java: 'Java', functions: 'دوال', methods: 'دوال', classes: 'أصناف', elements: 'عناصر' }[k] || k)}: <b>${esc(v)}</b>${['html', 'css', 'js', 'java'].includes(k) ? ' سطر' : ''}</span>`).join('');
    const sections = r.sections
      .map((s) => {
        const items = s.items.length
          ? `<ul>${s.items.map((i) => `<li><span class="t">${esc(i.text)}</span>${i.detail ? `<span class="d">${esc(i.detail)}</span>` : ''}${i.badge ? `<span class="b">${esc(i.badge)}</span>` : ''}</li>`).join('')}</ul>`
          : `<div class="empty">${esc(s.empty || '—')}</div>`;
        return `<details class="section" ${s.items.length ? 'open' : ''}><summary>${s.icon || ''} ${esc(s.title)}<span class="n">${s.items.length || ''}</span></summary>${items}</details>`;
      })
      .join('');
    const risks = r.risks.length
      ? `<div class="section" style="border:0"><h3 style="font-size:13px;color:var(--muted);margin:4px 0 8px">⚠️ المخاطر والملاحظات</h3><div style="display:flex;flex-direction:column;gap:6px">${r.risks.map((k) => `<div class="risk ${k.level}"><span>${k.level === 'high' ? '🔴' : k.level === 'medium' ? '🟠' : '🟡'}</span><span>${esc(k.text)}</span></div>`).join('')}</div></div>`
      : `<div class="risk low"><span>✅</span><span>لم تُكتشف مخاطر واضحة في الكود.</span></div>`;
    const perms = r.permissions.length
      ? `<div><h3 style="font-size:13px;color:var(--muted);margin:4px 0 8px">🔐 الصلاحيات التي يحتاجها التطبيق</h3><div class="perm-chips">${r.permissions.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div><p style="margin:8px 0 0;font-size:12.5px;color:var(--muted)"><button class="inline-btn" id="apply-perms">تفعيل هذه الصلاحيات في الإعدادات</button></p></div>`
      : '';
    out.innerHTML = `<div class="report">
      <div class="report-head"><div class="score ${scoreCls}">${r.score}</div><div><h2 style="font-size:16px">نتيجة الفحص</h2><div class="stats">${stats}</div></div></div>
      <div class="summary"><h3>ماذا يفعل هذا الكود؟</h3>${r.summary.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${risks}${perms}${sections}
    </div>`;
    const apply = $('#apply-perms');
    if (apply)
      apply.addEventListener('click', () => {
        project.permissions = [...new Set([...(project.permissions || []), ...r.permissions])];
        save();
        renderPermissions();
        toast('تم تفعيل الصلاحيات المقترحة', 'success');
      });
    renderPermissions(r.permissions);
    showOut('report');
  }

  async function analyzeCode() {
    const btn = $('#btn-analyze');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ الفحص…';
    try {
      const r = await api('/api/analyze', payload());
      renderReport(r);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 فحص الكود';
    }
  }

  // -------------------------------------------------------------- build ----
  function logLineHtml(line) {
    const cls = /❌|فشل|error|Error|ERROR/.test(line) ? 'err' : /✅|✓|succes/i.test(line) ? 'ok' : /^\[[^\]]+\] [①②③④⑤⑥⑦▶]/.test(line) ? 'step' : '';
    const ar = /[؀-ۿ]/.test(line) ? ' ar' : '';
    return `<div class="${cls}${ar}">${esc(line)}</div>`;
  }

  async function build() {
    if (pollTimer) return toast('هناك عملية بناء جارية بالفعل');
    const btn = $('#btn-build');
    const out = $('#out-log');
    showOut('log');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ الصنع…';
    out.innerHTML = `<div class="log-wrap"><div class="progress"><div></div></div><pre class="log" id="log"></pre></div>`;
    const logEl = $('#log');
    const append = (lines) => {
      logEl.insertAdjacentHTML('beforeend', lines.map(logLineHtml).join(''));
      logEl.scrollTop = logEl.scrollHeight;
    };
    try {
      if (!sdkReady) await refreshStatus();
      const { id } = await api('/api/build', payload());
      append([`▶ تم إرسال الطلب (المهمة ${id})`]);
      let since = 0;
      await new Promise((resolve, reject) => {
        pollTimer = setInterval(async () => {
          try {
            const j = await api(`/api/jobs/${id}?since=${since}`);
            if (j.log.length) {
              append(j.log);
              since = j.logLength;
            }
            if (j.status === 'done' || j.status === 'failed') {
              clearInterval(pollTimer);
              pollTimer = null;
              j.status === 'done' ? resolve(j) : reject(new Error(j.error || 'فشل البناء'));
            }
          } catch (e) {
            clearInterval(pollTimer);
            pollTimer = null;
            reject(e);
          }
        }, 800);
      }).then((j) => {
        $('.progress').remove();
        out.querySelector('.log-wrap').insertAdjacentHTML(
          'beforeend',
          `<div class="result"><a class="btn success" href="${j.apkUrl}" download="${esc(j.downloadName)}">⬇ تنزيل ${esc(j.downloadName)}</a><span class="meta">${(j.size / 1024).toFixed(1)} KB • موقّع بمفتاح تطوير • ثبّته على هاتفك من «مصادر غير معروفة»</span></div>`
        );
        toast('تم صنع التطبيق بنجاح 🎉', 'success');
      });
    } catch (e) {
      const p = $('.progress');
      if (p) p.remove();
      append([`❌ ${e.message}`]);
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🛠 صنع التطبيق';
    }
  }

  async function exportProject() {
    try {
      const res = await api('/api/export', payload(), true);
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : 'project.zip';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('تم تصدير المشروع');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function preview() {
    showOut('preview');
    const frame = $('#preview-frame');
    if (project.mode !== 'web') {
      frame.srcdoc = `<html dir="rtl"><body style="font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#555;text-align:center;padding:20px"><div><div style="font-size:40px">☕</div>المعاينة الحية متاحة لتطبيقات الويب فقط.<br>ابنِ تطبيق Java وجرّبه على الهاتف.</div></body></html>`;
      return;
    }
    let html = project.html || '';
    const bridge = `<script>(function(){function mem(){var m={};return{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}}}try{window.localStorage.length}catch(e){Object.defineProperty(window,'localStorage',{value:mem()});Object.defineProperty(window,'sessionStorage',{value:mem()})}})();window.Android={showToast:function(m){var d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 18px;border-radius:999px;font:14px sans-serif;z-index:99999';document.body.appendChild(d);setTimeout(function(){d.remove()},2000)},vibrate:function(ms){if(navigator.vibrate)navigator.vibrate(ms)},share:function(t){if(navigator.share)navigator.share({text:t});else alert(t)},exit:function(){},getVersion:function(){return ${JSON.stringify(String(project.versionName || '1.0'))}}};<\/script>`;
    const css = project.css ? `<style>${project.css}</style>` : '';
    const js = project.js ? `<script>${project.js.replace(/<\/script>/gi, '<\\/script>')}<\/script>` : '';
    html = html.replace(/<link[^>]+href=["']style\.css["'][^>]*>/i, '').replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i, '');
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${bridge}${css}</head>`) : bridge + css + html;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${js}</body>`) : html + js;
    frame.srcdoc = html;
  }

  // ------------------------------------------------------------- wiring ----
  $('#btn-analyze').addEventListener('click', analyzeCode);
  $('#btn-build').addEventListener('click', build);
  $('#btn-export').addEventListener('click', exportProject);
  $('#btn-preview').addEventListener('click', preview);

  renderSettings();
  renderTabs();
  loadEditor();
  refreshStatus();
  setInterval(refreshStatus, 30000);
})();
