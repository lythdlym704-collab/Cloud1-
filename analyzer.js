'use strict';
/**
 * محلّل كود ثابت (بدون تنفيذ الكود) يشرح بالعربية ماذا يفعل كود التطبيق:
 * عناصر الواجهة، الدوال والأحداث، الاتصال بالشبكة، التخزين، صلاحيات الجهاز، والمخاطر.
 */

const ARABIC_VERBS = [
  [/^(save|store|persist)/i, 'حفظ البيانات'],
  [/^(load|fetch|get|read|retrieve)/i, 'جلب/قراءة البيانات'],
  [/^(delete|remove|clear|reset)/i, 'حذف أو تفريغ'],
  [/^(add|create|insert|push|new)/i, 'إضافة عنصر جديد'],
  [/^(update|edit|change|set|modify)/i, 'تحديث/تعديل'],
  [/^(render|draw|show|display|paint|print)/i, 'عرض/رسم على الشاشة'],
  [/^(hide|close|dismiss)/i, 'إخفاء/إغلاق'],
  [/^(toggle|switch)/i, 'تبديل الحالة'],
  [/^(init|setup|start|boot|main|run)/i, 'تهيئة/بدء التشغيل'],
  [/^(stop|pause|cancel|end|finish)/i, 'إيقاف/إنهاء'],
  [/^(calc|compute|sum|count|total|convert|parse|format)/i, 'حساب/معالجة قيم'],
  [/^(validate|check|verify|is|has|can)/i, 'تحقق/فحص شرط'],
  [/^(send|post|submit|upload|sync)/i, 'إرسال بيانات'],
  [/^(download|export|import)/i, 'تصدير/استيراد'],
  [/^(login|signin|auth|logout|signout|register|signup)/i, 'تسجيل دخول/حساب'],
  [/^(search|find|filter|sort|query)/i, 'بحث/تصفية/ترتيب'],
  [/^(play|pause|next|prev)/i, 'تحكم بالوسائط'],
  [/^(handle|on)[A-Z_]/, 'معالجة حدث'],
  [/^(navigate|go|open|route)/i, 'تنقّل/فتح شاشة'],
  [/^(generate|random|shuffle)/i, 'توليد قيم عشوائية'],
  [/^(animate|move|scroll)/i, 'حركة/تمرير'],
  [/^(connect|listen|subscribe|emit)/i, 'اتصال/استماع لأحداث'],
];

const EVENT_NAMES = {
  click: 'النقر', dblclick: 'النقر المزدوج', submit: 'إرسال النموذج', input: 'الكتابة في حقل', change: 'تغيير قيمة',
  keydown: 'ضغط مفتاح', keyup: 'رفع مفتاح', keypress: 'ضغط مفتاح', load: 'اكتمال التحميل', DOMContentLoaded: 'جاهزية الصفحة',
  touchstart: 'بدء اللمس', touchend: 'انتهاء اللمس', touchmove: 'تحريك الإصبع', scroll: 'التمرير', resize: 'تغيير حجم الشاشة',
  mouseover: 'مرور المؤشر', mouseout: 'خروج المؤشر', mousedown: 'ضغط الفأرة', mouseup: 'رفع الفأرة', focus: 'التركيز', blur: 'فقدان التركيز',
  dragstart: 'بدء السحب', drop: 'الإفلات', contextmenu: 'القائمة السياقية', online: 'عودة الاتصال', offline: 'انقطاع الاتصال',
  visibilitychange: 'تغيّر ظهور الصفحة', popstate: 'تنقّل في السجل', hashchange: 'تغيّر الرابط', error: 'حدوث خطأ', message: 'استلام رسالة',
  beforeunload: 'قبل مغادرة الصفحة', pointerdown: 'لمس/ضغط', pointerup: 'رفع اللمس', wheel: 'عجلة الفأرة',
};

function count(re, s) {
  const m = s.match(re);
  return m ? m.length : 0;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function stripComments(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

function stripStrings(js) {
  return js.replace(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""');
}

function extractUrls(code) {
  const urls = code.match(/https?:\/\/[^\s"'`<>)]+/g) || [];
  return uniq(urls.map((u) => u.replace(/[.,;]+$/, '')));
}

function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

function describeName(name) {
  for (const [re, desc] of ARABIC_VERBS) if (re.test(name)) return desc;
  return null;
}

/** يستخرج جسم كتلة تبدأ عند أول '{' بعد الموضع start (مطابقة أقواس بسيطة). */
function blockAt(code, start) {
  const open = code.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return code.slice(open + 1);
}

function behaviorsOf(body) {
  const b = [];
  if (/\bfetch\s*\(|XMLHttpRequest|axios\.|\$\.ajax|\.get\(|\.post\(/.test(body)) b.push('يتصل بالخادم/الإنترنت');
  if (/localStorage|sessionStorage|indexedDB|document\.cookie|openDatabase/.test(body)) b.push('يحفظ أو يقرأ بيانات محلية');
  if (/\.(innerHTML|innerText|textContent|value)\s*=|createElement|appendChild|insertAdjacentHTML|\.append\(|\.remove\(\)|classList\./.test(body)) b.push('يغيّر محتوى الشاشة');
  if (/alert\(|confirm\(|prompt\(|Android\.showToast/.test(body)) b.push('يعرض رسالة للمستخدم');
  if (/setTimeout|setInterval|requestAnimationFrame/.test(body)) b.push('يعمل بتوقيت/تكرار زمني');
  if (/Math\.random/.test(body)) b.push('يستخدم أرقاماً عشوائية');
  if (/new Date|Date\.now/.test(body)) b.push('يتعامل مع الوقت والتاريخ');
  if (/JSON\.(parse|stringify)/.test(body)) b.push('يحوّل بيانات JSON');
  if (/navigator\.geolocation/.test(body)) b.push('يقرأ موقع الجهاز');
  if (/getUserMedia|mediaDevices/.test(body)) b.push('يستخدم الكاميرا/الميكروفون');
  if (/navigator\.vibrate|Android\.vibrate/.test(body)) b.push('يهزّ الجهاز');
  if (/Notification|Android\.share|navigator\.share/.test(body)) b.push('يرسل إشعاراً أو يشارك محتوى');
  if (/location\.(href|assign|replace)|window\.open|history\.push/.test(body)) b.push('ينتقل إلى صفحة/رابط');
  if (/\b(for|while|forEach|map|filter|reduce)\b/.test(body)) b.push('يكرّر على مجموعة بيانات');
  if (/\bif\s*\(|switch\s*\(|\?[^.]/.test(body)) b.push('يتخذ قرارات شرطية');
  if (/canvas|getContext\(/.test(body)) b.push('يرسم رسوميات');
  if (/\.play\(\)|\.pause\(\)|new Audio/.test(body)) b.push('يشغّل صوتاً/فيديو');
  if (/console\.(log|error|warn)/.test(body)) b.push('يطبع في سجل التصحيح');
  return b;
}

// ------------------------------------------------------------------- HTML --

function analyzeHtml(html) {
  const res = { title: null, elements: [], external: [], inlineHandlers: [], forms: 0, notes: [] };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (t) res.title = t[1].trim();
  const els = [
    ['button', /<button\b|type=["'](?:button|submit)["']/gi, 'زر'],
    ['input', /<input\b(?![^>]*type=["'](?:button|submit|hidden)["'])/gi, 'حقل إدخال'],
    ['textarea', /<textarea\b/gi, 'مربع نص'],
    ['select', /<select\b/gi, 'قائمة اختيار'],
    ['form', /<form\b/gi, 'نموذج'],
    ['a', /<a\b[^>]*href/gi, 'رابط'],
    ['img', /<img\b/gi, 'صورة'],
    ['video', /<video\b/gi, 'فيديو'],
    ['audio', /<audio\b/gi, 'صوت'],
    ['canvas', /<canvas\b/gi, 'لوحة رسم'],
    ['table', /<table\b/gi, 'جدول'],
    ['ul', /<(?:ul|ol)\b/gi, 'قائمة'],
    ['iframe', /<iframe\b/gi, 'إطار مضمّن'],
    ['heading', /<h[1-6]\b/gi, 'عنوان'],
    ['svg', /<svg\b/gi, 'رسم SVG'],
  ];
  for (const [key, re, label] of els) {
    const n = count(re, html);
    if (n) res.elements.push({ key, label, count: n });
  }
  res.forms = count(/<form\b/gi, html);
  const ext = html.match(/<(?:script|link|img|iframe|video|audio|source)\b[^>]*(?:src|href)=["'](https?:\/\/[^"']+)["']/gi) || [];
  res.external = uniq(ext.map((m) => /["'](https?:\/\/[^"']+)["']/.exec(m)[1]));
  const handlers = html.match(/\son(\w+)=["'][^"']*["']/gi) || [];
  res.inlineHandlers = uniq(handlers.map((h) => /on(\w+)=/i.exec(h)[1].toLowerCase()));
  if (!/<meta[^>]+viewport/i.test(html)) res.notes.push('لا يوجد وسم viewport؛ قد تظهر الواجهة صغيرة على الهاتف. أضف: <meta name="viewport" content="width=device-width, initial-scale=1">');
  if (/dir=["']rtl["']/i.test(html)) res.notes.push('الواجهة بتخطيط من اليمين إلى اليسار (RTL).');
  if (!/<html[^>]*lang=/i.test(html)) res.notes.push('لم تُحدَّد لغة الصفحة في وسم <html lang="…">.');
  if (/<!doctype/i.test(html) === false) res.notes.push('لا يوجد <!doctype html> في بداية الملف.');
  return res;
}

// -------------------------------------------------------------------- CSS --

function analyzeCss(css) {
  const c = stripComments(css);
  return {
    rules: count(/\{/g, c),
    mediaQueries: count(/@media/g, c),
    animations: count(/@keyframes/g, c) + count(/\banimation\s*:/g, c) + count(/\btransition\s*:/g, c),
    flex: /display\s*:\s*flex/.test(c),
    grid: /display\s*:\s*grid/.test(c),
    darkMode: /prefers-color-scheme\s*:\s*dark/.test(c),
    variables: count(/--[\w-]+\s*:/g, c),
    fonts: uniq((c.match(/@import\s+url\(["']?(https?:[^"')]+)/g) || []).map((m) => /https?:[^"')]+/.exec(m)[0])),
  };
}

// --------------------------------------------------------------------- JS --

function analyzeJs(jsRaw) {
  const js = stripComments(jsRaw);
  const noStr = stripStrings(js);
  const r = { functions: [], listeners: [], network: [], storage: [], device: [], features: [], risks: [], classes: [], globals: [] };

  // functions
  const fnRes = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)/g,
    /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm, // class methods / object shorthand
  ];
  const seen = new Set();
  for (const re of fnRes) {
    let m;
    while ((m = re.exec(js))) {
      const name = m[1];
      if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'constructor'].includes(name) || seen.has(name)) continue;
      seen.add(name);
      const params = (m[2] || m[3] || m[4] || '').split(',').map((p) => p.trim()).filter(Boolean);
      const body = blockAt(js, m.index + m[0].length - 1);
      r.functions.push({ name, params, purpose: describeName(name), behaviors: behaviorsOf(body), lines: body.split('\n').length });
    }
  }
  const classRe = /\bclass\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([\w.$]+))?/g;
  let cm;
  while ((cm = classRe.exec(js))) r.classes.push({ name: cm[1], extends: cm[2] || null });

  // event listeners
  const evRe = /addEventListener\s*\(\s*["'](\w+)["']/g;
  let em;
  const evCounts = {};
  while ((em = evRe.exec(js))) evCounts[em[1]] = (evCounts[em[1]] || 0) + 1;
  const propRe = /\.on(\w+)\s*=\s*(?:function|\(|[A-Za-z_$])/g;
  while ((em = propRe.exec(js))) evCounts[em[1]] = (evCounts[em[1]] || 0) + 1;
  for (const [ev, n] of Object.entries(evCounts)) r.listeners.push({ event: ev, label: EVENT_NAMES[ev] || ev, count: n });

  // network
  const urls = extractUrls(jsRaw);
  if (/\bfetch\s*\(/.test(noStr)) r.network.push({ api: 'fetch', label: 'طلبات HTTP عبر fetch', count: count(/\bfetch\s*\(/g, noStr) });
  if (/XMLHttpRequest/.test(noStr)) r.network.push({ api: 'xhr', label: 'طلبات HTTP عبر XMLHttpRequest', count: count(/XMLHttpRequest/g, noStr) });
  if (/new\s+WebSocket/.test(noStr)) r.network.push({ api: 'websocket', label: 'اتصال مباشر WebSocket', count: count(/new\s+WebSocket/g, noStr) });
  if (/EventSource/.test(noStr)) r.network.push({ api: 'sse', label: 'بث أحداث من الخادم (SSE)', count: 1 });
  if (/axios\./.test(noStr)) r.network.push({ api: 'axios', label: 'طلبات عبر مكتبة axios', count: count(/axios\./g, noStr) });
  if (/firebase|firestore/i.test(js)) r.network.push({ api: 'firebase', label: 'خدمة Firebase السحابية', count: 1 });
  r.hosts = uniq(urls.map(hostOf));
  r.urls = urls;

  // storage
  if (/localStorage/.test(noStr)) r.storage.push({ api: 'localStorage', label: 'تخزين دائم على الجهاز (localStorage)', keys: uniq((js.match(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g) || []).map((m) => /["']([^"']+)["']/.exec(m)[1])) });
  if (/sessionStorage/.test(noStr)) r.storage.push({ api: 'sessionStorage', label: 'تخزين مؤقت للجلسة', keys: [] });
  if (/indexedDB/.test(noStr)) r.storage.push({ api: 'indexedDB', label: 'قاعدة بيانات محلية IndexedDB', keys: [] });
  if (/document\.cookie/.test(noStr)) r.storage.push({ api: 'cookie', label: 'ملفات تعريف الارتباط (cookies)', keys: [] });
  if (/caches\.open|serviceWorker/.test(noStr)) r.storage.push({ api: 'cache', label: 'ذاكرة تخزين مؤقت / عامل خدمة', keys: [] });

  // device APIs → permissions
  const dev = [
    [/navigator\.geolocation/, 'الموقع الجغرافي (GPS)', 'ACCESS_FINE_LOCATION'],
    [/getUserMedia|mediaDevices/, 'الكاميرا أو الميكروفون', 'CAMERA'],
    [/MediaRecorder|audio:\s*true/, 'تسجيل الصوت', 'RECORD_AUDIO'],
    [/navigator\.vibrate|Android\.vibrate/, 'اهتزاز الجهاز', 'VIBRATE'],
    [/new\s+Notification|Notification\.requestPermission/, 'الإشعارات', 'POST_NOTIFICATIONS'],
    [/navigator\.clipboard/, 'الحافظة (نسخ/لصق)', null],
    [/DeviceMotionEvent|DeviceOrientationEvent|devicemotion|deviceorientation/, 'مستشعرات الحركة', null],
    [/navigator\.share|Android\.share/, 'مشاركة محتوى مع تطبيقات أخرى', null],
    [/navigator\.onLine/, 'حالة الاتصال بالإنترنت', 'ACCESS_NETWORK_STATE'],
    [/navigator\.bluetooth/, 'بلوتوث', 'BLUETOOTH'],
    [/speechSynthesis|SpeechRecognition/, 'النطق/التعرّف على الكلام', 'RECORD_AUDIO'],
    [/<input[^>]*type=["']file|\.files\b|FileReader/, 'اختيار ملفات من الجهاز', null],
    [/Android\.showToast/, 'رسائل Toast عبر جسر أندرويد', null],
    [/Android\.exit/, 'إغلاق التطبيق عبر جسر أندرويد', null],
  ];
  for (const [re, label, perm] of dev) if (re.test(jsRaw)) r.device.push({ label, permission: perm });

  // general features
  if (/\basync\b|\bawait\b|\.then\(/.test(noStr)) r.features.push('برمجة غير متزامنة (Promises/async)');
  if (/try\s*\{/.test(noStr)) r.features.push('معالجة الأخطاء (try/catch)');
  if (/setInterval/.test(noStr)) r.features.push('مهام متكررة زمنياً (setInterval)');
  if (/setTimeout/.test(noStr)) r.features.push('مؤقتات (setTimeout)');
  if (/requestAnimationFrame/.test(noStr)) r.features.push('حلقة رسم/حركة (requestAnimationFrame)');
  if (/getContext\(\s*["'](2d|webgl)/.test(js)) r.features.push('رسوميات Canvas');
  if (/new\s+Audio|\.play\(\)/.test(noStr)) r.features.push('تشغيل صوت/فيديو');
  if (/JSON\.parse|JSON\.stringify/.test(noStr)) r.features.push('قراءة/كتابة JSON');
  if (/Math\.random/.test(noStr)) r.features.push('قيم عشوائية');
  if (/new\s+Date|Date\.now/.test(noStr)) r.features.push('التاريخ والوقت');
  if (/Intl\.|toLocale/.test(noStr)) r.features.push('تنسيق محلي (أرقام/تواريخ)');
  if (/import\s+.*from|require\(/.test(noStr)) r.features.push('استيراد وحدات (modules)');
  if (/history\.pushState|location\.hash|hashchange/.test(noStr)) r.features.push('تنقّل بين شاشات داخل التطبيق');
  if (/\bclass\s+\w+/.test(noStr)) r.features.push(`برمجة كائنية (${r.classes.length} صنف)`);

  // risks
  if (/\beval\s*\(/.test(noStr)) r.risks.push({ level: 'high', text: 'استخدام eval() ينفّذ نصاً ككود وقد يسمح بحقن أكواد خبيثة.' });
  if (/new\s+Function\s*\(/.test(noStr)) r.risks.push({ level: 'high', text: 'استخدام new Function() ينفّذ نصوصاً ككود.' });
  if (/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(noStr)) r.risks.push({ level: 'medium', text: 'الكتابة عبر innerHTML/document.write قد تسبب ثغرة XSS إذا كان المحتوى من مصدر خارجي أو من المستخدم.' });
  const secret = /(api[_-]?key|secret|token|password|passwd|apikey)\s*[:=]\s*["'][^"']{6,}["']/i.exec(jsRaw);
  if (secret) r.risks.push({ level: 'high', text: `يبدو أن هناك مفتاحاً سرياً أو كلمة مرور مكتوبة داخل الكود (${secret[1]}). أي شخص يفكّ APK يمكنه قراءتها.` });
  const insecure = urls.filter((u) => u.startsWith('http://') && !/localhost|127\.0\.0\.1|10\.|192\.168\./.test(u));
  if (insecure.length) r.risks.push({ level: 'medium', text: `اتصال غير مشفّر (http://) بـ ${insecure.map(hostOf).join('، ')}؛ يُفضَّل استخدام https.` });
  if (/debugger\b/.test(noStr)) r.risks.push({ level: 'low', text: 'توجد تعليمة debugger متروكة في الكود.' });
  if (count(/console\.log/g, noStr) > 10) r.risks.push({ level: 'low', text: 'عدد كبير من console.log؛ احذفها قبل النشر.' });
  if (/while\s*\(\s*true\s*\)/.test(noStr) && !/await|break/.test(noStr)) r.risks.push({ level: 'medium', text: 'حلقة while(true) بدون break قد تجمّد التطبيق.' });
  if (/(^|[^.\w])(\w+)\s*=\s*[^=]/m.test(noStr)) {
    const g = uniq((noStr.match(/^(?!\s*(?:const|let|var|function|class|if|for|while|return|\/\/))\s*([A-Za-z_$][\w$]*)\s*=[^=]/gm) || []).map((m) => m.trim().split(/\s*=/)[0]).filter((n) => !['window', 'document', 'module', 'exports', 'this', 'self'].includes(n)));
    if (g.length) r.globals = g.slice(0, 10);
  }
  r.stats = { lines: jsRaw.split('\n').length, chars: jsRaw.length, functions: r.functions.length, comments: count(/\/\/|\/\*/g, jsRaw) };
  return r;
}

// ------------------------------------------------------------------- Java --

function analyzeJava(src) {
  const code = stripComments(src);
  const r = { package: null, classes: [], activities: [], widgets: [], features: [], permissions: [], risks: [], methods: [], intents: [] };
  const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(code);
  r.package = pkg ? pkg[1] : null;
  const classRe = /\bclass\s+(\w+)(?:\s+extends\s+([\w.]+))?/g;
  let m;
  while ((m = classRe.exec(code))) {
    r.classes.push({ name: m[1], extends: m[2] || null });
    if (/Activity$/.test(m[2] || '')) r.activities.push(m[1]);
  }
  const widgets = [
    ['TextView', 'نص'], ['Button', 'زر'], ['EditText', 'حقل إدخال'], ['ImageView', 'صورة'], ['ListView', 'قائمة'], ['RecyclerView', 'قائمة متقدمة'],
    ['CheckBox', 'مربع اختيار'], ['Switch', 'مفتاح تبديل'], ['RadioButton', 'زر اختيار'], ['Spinner', 'قائمة منسدلة'], ['ProgressBar', 'شريط تقدم'],
    ['WebView', 'متصفح مضمّن'], ['LinearLayout', 'تخطيط خطي'], ['RelativeLayout', 'تخطيط نسبي'], ['FrameLayout', 'تخطيط إطار'], ['ScrollView', 'تمرير'],
    ['SeekBar', 'شريط تمرير قيم'], ['Toast', 'رسالة Toast'], ['AlertDialog', 'نافذة حوار'], ['Snackbar', 'شريط رسائل'],
  ];
  for (const [w, label] of widgets) {
    const n = count(new RegExp(`\\b${w}\\b`, 'g'), code);
    if (n) r.widgets.push({ key: w, label, count: n });
  }
  const methodRe = /\b(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:[\w<>\[\],]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\{/g;
  while ((m = methodRe.exec(code))) {
    const name = m[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'synchronized'].includes(name)) continue;
    const body = blockAt(code, m.index + m[0].length - 1);
    const behaviors = [];
    if (/setContentView|setText|setVisibility|addView|setBackground/.test(body)) behaviors.push('يبني/يحدّث الواجهة');
    if (/Toast\.makeText|AlertDialog|Snackbar/.test(body)) behaviors.push('يعرض رسالة للمستخدم');
    if (/startActivity|Intent/.test(body)) behaviors.push('يفتح شاشة أو تطبيقاً آخر');
    if (/HttpURLConnection|OkHttp|Socket|URL\(/.test(body)) behaviors.push('يتصل بالإنترنت');
    if (/SharedPreferences|SQLite|openFileOutput|FileOutputStream|Room/.test(body)) behaviors.push('يحفظ بيانات');
    if (/Thread|Handler|AsyncTask|Executor|postDelayed/.test(body)) behaviors.push('ينفّذ عملاً في الخلفية/مؤقتاً');
    if (/setOnClickListener|OnClick/.test(body)) behaviors.push('يربط أحداث النقر');
    if (/Log\.[dieWv]/.test(body)) behaviors.push('يطبع في السجل');
    const lifecycle = { onCreate: 'يُستدعى عند فتح الشاشة', onResume: 'عند عودة الشاشة للواجهة', onPause: 'عند مغادرة الشاشة مؤقتاً', onDestroy: 'عند إغلاق الشاشة', onStart: 'عند ظهور الشاشة', onStop: 'عند اختفاء الشاشة', onBackPressed: 'عند ضغط زر الرجوع', onSaveInstanceState: 'لحفظ الحالة قبل الإغلاق', onRequestPermissionsResult: 'بعد ردّ المستخدم على طلب صلاحية', onActivityResult: 'عند عودة نتيجة من شاشة أخرى' };
    r.methods.push({ name, params: m[2].split(',').map((p) => p.trim()).filter(Boolean), purpose: lifecycle[name] || describeName(name), behaviors, lines: body.split('\n').length });
  }
  const intentRe = /Intent\.(ACTION_\w+)/g;
  while ((m = intentRe.exec(code))) r.intents.push(m[1]);
  r.intents = uniq(r.intents);
  const feats = [
    [/HttpURLConnection|OkHttp|Retrofit|Volley|URL\(/, 'اتصال بالإنترنت', 'INTERNET'],
    [/ConnectivityManager/, 'فحص حالة الشبكة', 'ACCESS_NETWORK_STATE'],
    [/SharedPreferences/, 'حفظ إعدادات بسيطة (SharedPreferences)', null],
    [/SQLiteDatabase|SQLiteOpenHelper|Room/, 'قاعدة بيانات محلية SQLite', null],
    [/Camera|ImageCapture|MediaStore\.ACTION_IMAGE_CAPTURE/, 'الكاميرا', 'CAMERA'],
    [/LocationManager|FusedLocation|getLastKnownLocation/, 'الموقع الجغرافي', 'ACCESS_FINE_LOCATION'],
    [/MediaRecorder|AudioRecord/, 'تسجيل الصوت', 'RECORD_AUDIO'],
    [/Vibrator/, 'الاهتزاز', 'VIBRATE'],
    [/NotificationManager|NotificationCompat/, 'الإشعارات', 'POST_NOTIFICATIONS'],
    [/SensorManager/, 'المستشعرات', null],
    [/BluetoothAdapter/, 'بلوتوث', 'BLUETOOTH'],
    [/MediaPlayer|SoundPool|ExoPlayer/, 'تشغيل الوسائط', null],
    [/WebView/, 'عرض صفحات ويب داخل التطبيق', 'INTERNET'],
    [/Thread|Handler|AsyncTask|Executor|Coroutine/, 'عمل في الخلفية', null],
    [/BroadcastReceiver/, 'الاستماع لأحداث النظام', null],
    [/Service\b/, 'خدمة تعمل في الخلفية', null],
    [/AlarmManager/, 'منبهات/جدولة', null],
    [/Environment\.getExternalStorage|getExternalFilesDir/, 'الوصول إلى التخزين الخارجي', 'READ_EXTERNAL_STORAGE'],
    [/getSharedPreferences|getPreferences/, 'تفضيلات المستخدم', null],
  ];
  for (const [re, label, perm] of feats) {
    if (re.test(code)) {
      r.features.push(label);
      if (perm) r.permissions.push(perm);
    }
  }
  r.permissions = uniq(r.permissions);
  if (/AppCompatActivity|androidx\.|android\.support\./.test(code)) r.risks.push({ level: 'high', text: 'الكود يستخدم مكتبات AndroidX/AppCompat غير المتوفرة في البناء المبسّط. استخدم android.app.Activity و الواجهات الأساسية فقط.' });
  if (/Runtime\.getRuntime\(\)\.exec|ProcessBuilder/.test(code)) r.risks.push({ level: 'high', text: 'تنفيذ أوامر نظام (exec) — خطر أمني.' });
  if (/setJavaScriptEnabled\(true\)/.test(code) && /addJavascriptInterface/.test(code)) r.risks.push({ level: 'medium', text: 'WebView مع واجهة JavaScript؛ لا تحمّل صفحات غير موثوقة.' });
  if (/(password|secret|api[_-]?key|token)\s*=\s*"[^"]{6,}"/i.test(code)) r.risks.push({ level: 'high', text: 'يوجد مفتاح أو كلمة مرور مكتوبة نصياً داخل الكود.' });
  if (/Thread\.sleep\(/.test(code) && /onCreate/.test(code)) r.risks.push({ level: 'medium', text: 'Thread.sleep داخل الخيط الرئيسي يجمّد الواجهة.' });
  if (/\.printStackTrace\(\)/.test(code)) r.risks.push({ level: 'low', text: 'printStackTrace يطبع تفاصيل الأخطاء؛ استخدم Log بدلاً منه.' });
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(code)) r.risks.push({ level: 'low', text: 'كتل catch فارغة تُخفي الأخطاء.' });
  r.stats = { lines: src.split('\n').length, chars: src.length, methods: r.methods.length, classes: r.classes.length };
  return r;
}

// ------------------------------------------------------------- summary ----

function plural(n, one, two, few, many = few) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

const ELEMENT_PLURALS = { 'زر': ['زر واحد', 'زران', 'أزرار', 'زراً'], 'حقل إدخال': ['حقل إدخال واحد', 'حقلا إدخال', 'حقول إدخال', 'حقل إدخال'], 'مربع نص': ['مربع نص واحد', 'مربعا نص', 'مربعات نص', 'مربع نص'], 'قائمة اختيار': ['قائمة اختيار واحدة', 'قائمتا اختيار', 'قوائم اختيار', 'قائمة اختيار'], 'نموذج': ['نموذج واحد', 'نموذجان', 'نماذج', 'نموذجاً'], 'رابط': ['رابط واحد', 'رابطان', 'روابط', 'رابطاً'], 'صورة': ['صورة واحدة', 'صورتان', 'صور', 'صورة'], 'فيديو': ['مقطع فيديو واحد', 'مقطعا فيديو', 'مقاطع فيديو', 'مقطع فيديو'], 'صوت': ['مقطع صوتي واحد', 'مقطعان صوتيان', 'مقاطع صوتية', 'مقطعاً صوتياً'], 'لوحة رسم': ['لوحة رسم واحدة', 'لوحتا رسم', 'لوحات رسم', 'لوحة رسم'], 'جدول': ['جدول واحد', 'جدولان', 'جداول', 'جدولاً'], 'قائمة': ['قائمة واحدة', 'قائمتان', 'قوائم', 'قائمة'], 'إطار مضمّن': ['إطار مضمّن واحد', 'إطاران مضمّنان', 'إطارات مضمّنة', 'إطاراً مضمّناً'], 'عنوان': ['عنوان واحد', 'عنوانان', 'عناوين', 'عنواناً'], 'رسم SVG': ['رسم SVG واحد', 'رسما SVG', 'رسوم SVG', 'رسم SVG'] };

function countLabel(n, label) {
  const f = ELEMENT_PLURALS[label];
  return f ? plural(n, f[0], f[1], f[2], f[3]) : `${n} ${label}`;
}

function summarizeWeb(cfg, h, c, j) {
  const s = [];
  const name = cfg.appName ? `«${cfg.appName}»` : 'هذا التطبيق';
  s.push(`${name} تطبيق ويب يعمل داخل أندرويد عبر WebView؛ أي أن واجهته مبنية بـ HTML وCSS وJavaScript وتُعرض كتطبيق كامل الشاشة${h.title ? ` بعنوان «${h.title}»` : ''}.`);
  const ui = h.elements.filter((e) => ['button', 'input', 'textarea', 'select', 'form', 'img', 'video', 'canvas', 'table', 'a'].includes(e.key));
  if (ui.length) s.push(`الواجهة تحتوي على ${ui.map((e) => countLabel(e.count, e.label)).join('، ')}.`);
  else s.push('الواجهة بسيطة بلا عناصر تفاعلية واضحة (نصوص وعناوين فقط).');
  const evs = j.listeners.map((l) => l.label).concat(h.inlineHandlers.map((e) => EVENT_NAMES[e] || e));
  if (evs.length) s.push(`يتفاعل مع المستخدم عند: ${uniq(evs).join('، ')}.`);
  if (j.functions.length) {
    const main = j.functions.slice(0, 6).map((f) => f.purpose ? `${f.name} (${f.purpose})` : f.name);
    s.push(`يُعرّف الكود ${plural(j.functions.length, 'دالة واحدة', 'دالتين', 'دوال', 'دالة')}${main.length ? `، أبرزها: ${main.join('، ')}` : ''}.`);
  }
  if (j.network.length) s.push(`يتصل بالإنترنت (${j.network.map((n) => n.label).join('، ')})${j.hosts.length ? ` مع: ${j.hosts.join('، ')}` : ''}؛ لذا يحتاج صلاحية INTERNET.`);
  else if (!h.external.length) s.push('لا يتصل بالإنترنت؛ يعمل بالكامل دون اتصال.');
  if (h.external.length) s.push(`يحمّل موارد خارجية من: ${uniq(h.external.map(hostOf)).join('، ')} (يتطلب اتصالاً بالإنترنت).`);
  if (j.storage.length) s.push(`يحفظ بيانات على الجهاز عبر ${j.storage.map((x) => x.api).join(' و')}${j.storage[0].keys && j.storage[0].keys.length ? ` (مفاتيح مثل: ${j.storage[0].keys.slice(0, 5).join('، ')})` : ''}، فتبقى بياناته بعد إغلاق التطبيق.`);
  if (j.device.length) s.push(`يستخدم إمكانات الجهاز: ${j.device.map((d) => d.label).join('، ')}.`);
  if (c.mediaQueries || c.flex || c.grid) s.push(`التصميم متجاوب${c.darkMode ? ' ويدعم الوضع الداكن' : ''}${c.animations ? ' ويتضمن حركات وانتقالات' : ''}.`);
  if (j.risks.some((r) => r.level === 'high')) s.push('⚠ توجد ملاحظات أمنية مهمة في قسم المخاطر يجب مراجعتها قبل النشر.');
  return s;
}

function summarizeJava(cfg, j) {
  const s = [];
  const name = cfg.appName ? `«${cfg.appName}»` : 'هذا التطبيق';
  s.push(`${name} تطبيق أندرويد أصلي مكتوب بلغة Java${j.package ? ` في الحزمة ${j.package}` : ''}${j.activities.length ? `، شاشته الرئيسية هي ${j.activities.join(' و')}` : ''}.`);
  if (j.widgets.length) s.push(`يبني واجهته من: ${j.widgets.slice(0, 8).map((w) => `${w.label} (${w.key})`).join('، ')}.`);
  if (j.methods.length) {
    const main = j.methods.slice(0, 8).map((f) => (f.purpose ? `${f.name}: ${f.purpose}` : f.name));
    s.push(`يحتوي على ${plural(j.methods.length, 'دالة واحدة', 'دالتين', 'دوال', 'دالة')}، منها: ${main.join('؛ ')}.`);
  }
  if (j.features.length) s.push(`الإمكانات المستخدمة: ${j.features.join('، ')}.`);
  if (j.intents.length) s.push(`يستخدم نوايا (Intents) من نوع: ${j.intents.join('، ')}.`);
  if (j.permissions.length) s.push(`الصلاحيات التي يحتاجها على الأرجح: ${j.permissions.join('، ')}.`);
  if (j.risks.some((r) => r.level === 'high')) s.push('⚠ توجد ملاحظات مهمة في قسم المخاطر قد تمنع البناء أو تشكّل خطراً.');
  return s;
}

/** نقطة الدخول: تحليل مشروع كامل وإرجاع تقرير منظّم. */
function analyze(input = {}) {
  const mode = input.mode === 'java' ? 'java' : 'web';
  const cfg = { appName: input.appName || '', packageName: input.packageName || '' };
  const report = { mode, summary: [], sections: [], permissions: [], risks: [], stats: {} };
  const neededPerms = new Set();

  if (mode === 'web') {
    const html = String(input.html || '');
    const css = String(input.css || '');
    const js = String(input.js || '') + '\n' + (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || []).map((s) => s.replace(/<\/?script[^>]*>/gi, '')).join('\n');
    const inlineCss = (html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || []).map((s) => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');
    const h = analyzeHtml(html);
    const c = analyzeCss(css + '\n' + inlineCss);
    const j = analyzeJs(js);
    report.summary = summarizeWeb(cfg, h, c, j);
    report.sections.push({ title: 'عناصر الواجهة', icon: '🧩', items: h.elements.map((e) => ({ text: `${e.label}`, badge: String(e.count) })) , empty: 'لا توجد عناصر واجهة مكتشفة' });
    report.sections.push({ title: 'الدوال وما تفعله', icon: '⚙️', items: j.functions.map((f) => ({ text: `${f.name}(${f.params.join(', ')})`, detail: [f.purpose, ...f.behaviors].filter(Boolean).join(' • ') || 'منطق عام', badge: `${f.lines} سطر` })), empty: 'لم تُعرَّف دوال' });
    report.sections.push({ title: 'الأحداث والتفاعل', icon: '👆', items: [...j.listeners.map((l) => ({ text: `عند ${l.label}`, detail: `addEventListener("${l.event}")`, badge: String(l.count) })), ...h.inlineHandlers.map((e) => ({ text: `عند ${EVENT_NAMES[e] || e}`, detail: `on${e}= داخل HTML` }))], empty: 'لا يستجيب لأحداث المستخدم' });
    report.sections.push({ title: 'الاتصال بالشبكة', icon: '🌐', items: [...j.network.map((n) => ({ text: n.label, badge: String(n.count) })), ...uniq([...j.hosts, ...h.external.map(hostOf)]).map((hst) => ({ text: hst, detail: 'عنوان خارجي' }))], empty: 'لا يتصل بالإنترنت' });
    report.sections.push({ title: 'التخزين والبيانات', icon: '💾', items: j.storage.map((x) => ({ text: x.label, detail: x.keys && x.keys.length ? `المفاتيح: ${x.keys.join('، ')}` : '' })), empty: 'لا يخزّن بيانات على الجهاز' });
    report.sections.push({ title: 'إمكانات الجهاز', icon: '📱', items: j.device.map((d) => ({ text: d.label, detail: d.permission ? `يتطلب صلاحية ${d.permission}` : '' })), empty: 'لا يستخدم عتاد الجهاز' });
    report.sections.push({ title: 'تقنيات مستخدمة', icon: '🧪', items: [...j.features.map((t) => ({ text: t })), ...(c.flex ? [{ text: 'تخطيط Flexbox' }] : []), ...(c.grid ? [{ text: 'تخطيط Grid' }] : []), ...(c.mediaQueries ? [{ text: `استعلامات وسائط متجاوبة`, badge: String(c.mediaQueries) }] : []), ...(c.darkMode ? [{ text: 'دعم الوضع الداكن' }] : []), ...(c.animations ? [{ text: 'حركات وانتقالات CSS', badge: String(c.animations) }] : [])], empty: '—' });
    if (h.notes.length) report.sections.push({ title: 'ملاحظات على HTML', icon: '📝', items: h.notes.map((n) => ({ text: n })) });
    if (j.globals.length) report.sections.push({ title: 'متغيرات عامة بدون تعريف', icon: '🌍', items: j.globals.map((g) => ({ text: g, detail: 'يُنصح بتعريفها بـ let أو const' })) });
    report.risks = j.risks;
    if (j.network.length || h.external.length) neededPerms.add('INTERNET');
    for (const d of j.device) if (d.permission) neededPerms.add(d.permission);
    report.stats = { html: html.split('\n').length, css: css.split('\n').length, js: String(input.js || '').split('\n').length, functions: j.functions.length, elements: h.elements.reduce((n, e) => n + e.count, 0) };
  } else {
    const src = String(input.java || '');
    const j = analyzeJava(src);
    report.summary = summarizeJava(cfg, j);
    report.sections.push({ title: 'الأصناف والشاشات', icon: '🏛️', items: j.classes.map((c) => ({ text: c.name, detail: c.extends ? `يرث من ${c.extends}` : '', badge: j.activities.includes(c.name) ? 'Activity' : '' })), empty: 'لا توجد أصناف' });
    report.sections.push({ title: 'الدوال وما تفعله', icon: '⚙️', items: j.methods.map((f) => ({ text: `${f.name}(${f.params.join(', ')})`, detail: [f.purpose, ...f.behaviors].filter(Boolean).join(' • ') || 'منطق عام', badge: `${f.lines} سطر` })), empty: 'لم تُعرَّف دوال' });
    report.sections.push({ title: 'عناصر الواجهة', icon: '🧩', items: j.widgets.map((w) => ({ text: `${w.label} (${w.key})`, badge: String(w.count) })), empty: 'لا توجد عناصر واجهة' });
    report.sections.push({ title: 'الإمكانات والخدمات', icon: '🧪', items: j.features.map((t) => ({ text: t })), empty: '—' });
    if (j.intents.length) report.sections.push({ title: 'النوايا (Intents)', icon: '🔀', items: j.intents.map((i) => ({ text: i })) });
    report.risks = j.risks;
    for (const p of j.permissions) neededPerms.add(p);
    report.stats = { java: src.split('\n').length, methods: j.methods.length, classes: j.classes.length };
    if (!j.activities.length) report.risks.unshift({ level: 'high', text: 'لا يوجد صنف يرث من Activity؛ لن يتمكن البناء من تحديد الشاشة الرئيسية.' });
  }
  report.permissions = [...neededPerms];
  report.score = Math.max(0, 100 - report.risks.reduce((n, r) => n + (r.level === 'high' ? 25 : r.level === 'medium' ? 10 : 3), 0));
  return report;
}

module.exports = { analyze, analyzeJs, analyzeHtml, analyzeCss, analyzeJava };
