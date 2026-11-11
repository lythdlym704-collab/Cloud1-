'use strict';
/**
 * مُنشئ APK: يولّد مشروع أندرويد من كود المستخدم ثم يبنيه باستخدام
 * aapt2 → javac → d8 → zip → zipalign → apksigner
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { createZip, readZip } = require('./zip');
const { makeIcon } = require('./png');
const sdk = require('./sdk');

const KNOWN_PERMISSIONS = {
  INTERNET: 'android.permission.INTERNET',
  ACCESS_NETWORK_STATE: 'android.permission.ACCESS_NETWORK_STATE',
  CAMERA: 'android.permission.CAMERA',
  RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
  VIBRATE: 'android.permission.VIBRATE',
  POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
  READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
  WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
  BLUETOOTH: 'android.permission.BLUETOOTH',
  NFC: 'android.permission.NFC',
  WAKE_LOCK: 'android.permission.WAKE_LOCK',
};

const ICON_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

class BuildError extends Error {}

// ------------------------------------------------------------ validation --

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const JAVA_KEYWORDS = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(' ')
);

function normalizeConfig(input = {}) {
  const cfg = {};
  cfg.mode = input.mode === 'java' ? 'java' : 'web';
  cfg.appName = String(input.appName || 'تطبيقي').trim().slice(0, 50) || 'تطبيقي';
  cfg.packageName = String(input.packageName || 'com.example.myapp').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(cfg.packageName)) {
    throw new BuildError('اسم الحزمة غير صالح. مثال صحيح: com.example.myapp (حروف صغيرة وأرقام ونقاط)');
  }
  if (cfg.packageName.split('.').some((p) => JAVA_KEYWORDS.has(p))) {
    throw new BuildError('اسم الحزمة يحتوي على كلمة محجوزة في جافا');
  }
  cfg.versionName = String(input.versionName || '1.0').trim().slice(0, 20) || '1.0';
  cfg.versionCode = Math.max(1, Math.min(2147483647, parseInt(input.versionCode, 10) || 1));
  cfg.color = /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#4f8cff';
  cfg.orientation = ['portrait', 'landscape', 'unspecified'].includes(input.orientation) ? input.orientation : 'unspecified';
  cfg.permissions = Array.isArray(input.permissions) ? input.permissions.filter((p) => KNOWN_PERMISSIONS[p]) : [];
  cfg.minSdk = 21;
  cfg.targetSdk = 34;
  cfg.iconPng = null;
  if (typeof input.iconBase64 === 'string' && input.iconBase64) {
    const b64 = input.iconBase64.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 2 * 1024 * 1024) throw new BuildError('الأيقونة كبيرة جداً (الحد 2 ميجابايت)');
    if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new BuildError('الأيقونة يجب أن تكون بصيغة PNG');
    cfg.iconPng = buf;
  }
  cfg.files = {
    html: String(input.html || ''),
    css: String(input.css || ''),
    js: String(input.js || ''),
    java: String(input.java || ''),
    layout: String(input.layout || ''),
  };
  const total = Object.values(cfg.files).reduce((n, s) => n + Buffer.byteLength(s), 0);
  if (total > 5 * 1024 * 1024) throw new BuildError('حجم الكود كبير جداً (الحد 5 ميجابايت)');
  if (cfg.mode === 'web' && !cfg.files.html.trim()) throw new BuildError('كود HTML فارغ. أضف كود واجهة التطبيق أولاً');
  if (cfg.mode === 'java' && !cfg.files.java.trim()) throw new BuildError('كود Java فارغ. أضف كود النشاط (Activity) أولاً');
  return cfg;
}

// --------------------------------------------------------------- sources --

function webActivitySource(pkg) {
  return `package ${pkg};

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 33) {
            s.setAlgorithmicDarkeningAllowed(false);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file://") || url.startsWith("http://") || url.startsWith("https://")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (Exception ignored) { }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "Android");

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/www/index.html");
        }
    }

    public class Bridge {
        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, null));
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(ms);
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(() -> finish());
        }

        @JavascriptInterface
        public String getVersion() {
            return "${'$'}{VERSION_NAME}";
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
`;
}

/** يستخرج اسم الحزمة واسم صنف النشاط من كود جافا المقدَّم. */
function inspectJava(src) {
  const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(src);
  const cls = /\b(?:public\s+)?(?:final\s+)?class\s+(\w+)\s+extends\s+(?:[\w.]*\.)?(\w*Activity)\b/.exec(src);
  return { packageName: pkg ? pkg[1] : null, activityClass: cls ? cls[1] : null, extendsClass: cls ? cls[2] : null };
}

function manifestXml(cfg, activityClass) {
  const perms = cfg.permissions.map((p) => `    <uses-permission android:name="${KNOWN_PERMISSIONS[p]}" />`).join('\n');
  const orientation = cfg.orientation !== 'unspecified' ? `\n            android:screenOrientation="${cfg.orientation}"` : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${cfg.packageName}"
    android:versionCode="${cfg.versionCode}"
    android:versionName="${xmlEscape(cfg.versionName)}">

    <uses-sdk android:minSdkVersion="${cfg.minSdk}" android:targetSdkVersion="${cfg.targetSdk}" />
${perms ? perms + '\n' : ''}
    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme">
        <activity
            android:name=".${activityClass}"
            android:exported="true"${orientation}
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
}

function stylesXml(color) {
  const dark = darken(color, 0.2);
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.Material.Light.NoActionBar">
        <item name="android:colorPrimary">${color}</item>
        <item name="android:colorPrimaryDark">${dark}</item>
        <item name="android:colorAccent">${color}</item>
        <item name="android:statusBarColor">${dark}</item>
        <item name="android:windowBackground">@android:color/white</item>
    </style>
</resources>
`;
}

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.round(v * (1 - f))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/**
 * يولّد ملفات المشروع في الذاكرة.
 * @returns {{files: Map<string, Buffer>, activityClass: string}}
 */
function generateProject(cfg) {
  const files = new Map();
  const put = (p, content) => files.set(p, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
  let activityClass = 'MainActivity';

  if (cfg.mode === 'web') {
    put(`src/${cfg.packageName.replace(/\./g, '/')}/MainActivity.java`, webActivitySource(cfg.packageName).replace('${VERSION_NAME}', cfg.versionName.replace(/[\\"]/g, '')));
    let html = cfg.files.html;
    // inject css/js files if the HTML doesn't already reference them
    if (cfg.files.css.trim() && !/href=["']style\.css["']/.test(html)) {
      const link = '<link rel="stylesheet" href="style.css">';
      html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `  ${link}\n</head>`) : link + '\n' + html;
    }
    if (cfg.files.js.trim() && !/src=["']app\.js["']/.test(html)) {
      const script = '<script src="app.js"></script>';
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `  ${script}\n</body>`) : html + '\n' + script;
    }
    put('assets/www/index.html', html);
    if (cfg.files.css.trim()) put('assets/www/style.css', cfg.files.css);
    if (cfg.files.js.trim()) put('assets/www/app.js', cfg.files.js);
  } else {
    const info = inspectJava(cfg.files.java);
    if (!info.activityClass) throw new BuildError('لم يُعثر على صنف يرث من Activity في كود Java (مثال: public class MainActivity extends Activity)');
    if (info.extendsClass === 'AppCompatActivity') {
      throw new BuildError('AppCompatActivity يحتاج مكتبات AndroidX غير المدعومة هنا. استخدم android.app.Activity بدلاً منها');
    }
    activityClass = info.activityClass;
    let java = cfg.files.java;
    if (info.packageName && info.packageName !== cfg.packageName) {
      java = java.replace(/^\s*package\s+[\w.]+\s*;/m, `package ${cfg.packageName};`);
    } else if (!info.packageName) {
      java = `package ${cfg.packageName};\n\n` + java;
    }
    put(`src/${cfg.packageName.replace(/\./g, '/')}/${activityClass}.java`, java);
    if (cfg.files.layout.trim()) put('res/layout/activity_main.xml', cfg.files.layout);
  }

  put('AndroidManifest.xml', manifestXml(cfg, activityClass));
  put('res/values/strings.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${xmlEscape(cfg.appName)}</string>\n</resources>\n`);
  put('res/values/styles.xml', stylesXml(cfg.color));
  for (const [dpi, size] of Object.entries(ICON_SIZES)) {
    put(`res/mipmap-${dpi}/ic_launcher.png`, cfg.iconPng || makeIcon(size, cfg.color));
  }
  put(
    'README.txt',
    `مشروع مولَّد بواسطة APK Studio\n\nالبناء يدوياً (مع Android SDK build-tools و JDK):\n` +
      `  aapt2 compile --dir res -o compiled.zip\n` +
      `  aapt2 link -o base.apk -I $ANDROID_HOME/platforms/android-34/android.jar --manifest AndroidManifest.xml -A assets --java gen compiled.zip\n` +
      `  javac --release 17 -cp $ANDROID_HOME/platforms/android-34/android.jar -d classes $(find src gen -name "*.java")\n` +
      `  d8 --release --lib $ANDROID_HOME/platforms/android-34/android.jar --min-api 21 --output dex $(find classes -name "*.class")\n` +
      `  # أضف dex/classes.dex إلى base.apk ثم: zipalign -f 4 base.apk aligned.apk && apksigner sign --ks debug.keystore aligned.apk\n`
  );
  return { files, activityClass };
}

// ---------------------------------------------------------------- build --

const JAVA_ENV = { JAVA_TOOL_OPTIONS: undefined, _JAVA_OPTIONS: undefined };

function run(cmd, args, { cwd, log, timeout = 180000, env, display } = {}) {
  return new Promise((resolve, reject) => {
    log(`$ ${path.basename(cmd)} ${display || args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
    const merged = { ...process.env, ...env };
    for (const k of Object.keys(env || {})) if (env[k] === undefined) delete merged[k];
    const child = spawn(cmd, args, { cwd, env: merged, windowsHide: true, shell: process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd) });
    let out = '';
    const onData = (d) => {
      const text = d.toString('utf8');
      out += text;
      for (const line of text.split(/\r?\n/)) if (line.trim() && !/^Picked up (JAVA_TOOL_OPTIONS|_JAVA_OPTIONS)/.test(line)) log('  ' + line);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new BuildError(`انتهت مهلة الأمر ${path.basename(cmd)}`));
    }, timeout);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new BuildError(`تعذّر تشغيل ${path.basename(cmd)}: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new BuildError(`فشل الأمر ${path.basename(cmd)} (رمز الخروج ${code})`));
    });
  });
}

async function writeProject(files, dir) {
  for (const [rel, buf] of files) {
    const abs = path.join(dir, rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, buf);
  }
}

async function listFiles(dir, filter) {
  const out = [];
  async function rec(d) {
    let entries = [];
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await rec(p);
      else if (filter(p)) out.push(p);
    }
  }
  await rec(dir);
  return out;
}

async function ensureKeystore(dataDir, keytool, log) {
  const ks = path.join(dataDir, 'debug.keystore');
  if (fs.existsSync(ks)) return ks;
  await fsp.mkdir(dataDir, { recursive: true });
  log('إنشاء مفتاح توقيع (debug keystore) لأول مرة…');
  await run(
    keytool,
    ['-genkeypair', '-keystore', ks, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=APK Studio Debug,O=APK Studio,C=US'],
    { log }
  );
  return ks;
}

/**
 * ينفّذ عملية البناء كاملة.
 * @param {object} rawConfig إعدادات وكود المستخدم
 * @param {{dataDir:string, log:(line:string)=>void}} opts
 * @returns {Promise<{apkPath:string, downloadName:string, workDir:string, size:number, activityClass:string}>}
 */
async function buildApk(rawConfig, { dataDir, log = () => {} }) {
  const cfg = normalizeConfig(rawConfig);
  const env = sdk.detect();
  if (!env.ok) {
    throw new BuildError(`أدوات البناء غير مكتملة. المفقود: ${env.missing.join(', ')}. شغّل scripts/setup-android-sdk.sh أو عيّن ANDROID_HOME`);
  }
  const t = env.tools;
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'apkstudio-'));
  const proj = path.join(work, 'project');
  log(`▶ بدء البناء: ${cfg.appName} (${cfg.packageName}) — الوضع: ${cfg.mode === 'web' ? 'ويب (WebView)' : 'جافا أصلي'}`);
  log(`   SDK: ${env.sdkRoot} | build-tools ${env.buildTools} | ${env.platform} | ${env.java}`);

  const { files, activityClass } = generateProject(cfg);
  await writeProject(files, proj);
  log(`✓ تم توليد ${files.size} ملفاً للمشروع`);

  const compiled = path.join(work, 'compiled.zip');
  const baseApk = path.join(work, 'base.apk');
  const gen = path.join(work, 'gen');
  const classes = path.join(work, 'classes');
  const dex = path.join(work, 'dex');
  await Promise.all([gen, classes, dex].map((d) => fsp.mkdir(d, { recursive: true })));

  log('① ترجمة الموارد (aapt2 compile)…');
  await run(t.aapt2, ['compile', '--dir', path.join(proj, 'res'), '-o', compiled], { cwd: work, log });

  log('② ربط الموارد والمانيفست (aapt2 link)…');
  const linkArgs = ['link', '-o', baseApk, '-I', t.androidJar, '--manifest', path.join(proj, 'AndroidManifest.xml'), '--java', gen, '--min-sdk-version', String(cfg.minSdk), '--target-sdk-version', String(cfg.targetSdk), '--version-code', String(cfg.versionCode), '--version-name', cfg.versionName, '--auto-add-overlay'];
  if (fs.existsSync(path.join(proj, 'assets'))) linkArgs.push('-A', path.join(proj, 'assets'));
  linkArgs.push(compiled);
  await run(t.aapt2, linkArgs, { cwd: work, log });

  log('③ ترجمة كود Java (javac)…');
  const javaFiles = [...(await listFiles(path.join(proj, 'src'), (p) => p.endsWith('.java'))), ...(await listFiles(gen, (p) => p.endsWith('.java')))];
  const argFile = path.join(work, 'javac.args');
  await fsp.writeFile(argFile, javaFiles.map((f) => `"${f.replace(/\\/g, '/')}"`).join('\n'));
  await run(t.javac, ['--release', '17', '-encoding', 'UTF-8', '-Xlint:none', '-proc:none', '-cp', t.androidJar, '-d', classes, `@${argFile}`], { cwd: work, log, env: JAVA_ENV, display: `--release 17 -cp android.jar -d classes (${javaFiles.length} java files)` });

  log('④ تحويل إلى DEX (d8)…');
  const classFiles = await listFiles(classes, (p) => p.endsWith('.class'));
  await run(t.d8, ['--release', '--lib', t.androidJar, '--min-api', String(cfg.minSdk), '--output', dex, ...classFiles], { cwd: work, log, env: JAVA_ENV, display: `--release --lib android.jar --min-api ${cfg.minSdk} --output dex (${classFiles.length} class files)` });

  log('⑤ تجميع حزمة APK…');
  const baseEntries = readZip(await fsp.readFile(baseApk));
  const entries = baseEntries.map((e) => ({ name: e.name, data: e.data, store: e.name === 'resources.arsc' || /\.(png|jpg|jpeg|gif|webp|mp3|mp4|ogg|wav)$/i.test(e.name), align: 4 }));
  const dexFiles = (await listFiles(dex, (p) => p.endsWith('.dex'))).sort();
  if (!dexFiles.length) throw new BuildError('لم يُنتج d8 أي ملف DEX');
  for (const f of dexFiles) entries.push({ name: path.basename(f), data: await fsp.readFile(f) });
  const unaligned = path.join(work, 'unaligned.apk');
  await fsp.writeFile(unaligned, createZip(entries));

  log('⑥ محاذاة (zipalign)…');
  const aligned = path.join(work, 'aligned.apk');
  await run(t.zipalign, ['-f', '-p', '4', unaligned, aligned], { cwd: work, log });

  log('⑦ التوقيع (apksigner)…');
  const ks = await ensureKeystore(dataDir, t.keytool, log);
  const apkPath = path.join(work, 'app-signed.apk');
  const downloadName = `${cfg.appName.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').slice(0, 40) || 'app'}-v${cfg.versionName.replace(/[^\w.]+/g, '_')}.apk`;
  await run(t.apksigner, ['sign', '--ks', ks, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--ks-key-alias', 'androiddebugkey', '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--out', apkPath, aligned], { cwd: work, log, env: JAVA_ENV });
  await run(t.apksigner, ['verify', '--print-certs', apkPath], { cwd: work, log, env: JAVA_ENV });

  const size = (await fsp.stat(apkPath)).size;
  log(`✅ اكتمل البناء بنجاح: ${downloadName} (${(size / 1024).toFixed(1)} KB)`);
  return { apkPath, downloadName, workDir: work, size, activityClass, config: cfg };
}

/** يولّد المشروع ويعيده كملف ZIP (بدون بناء). */
function exportProjectZip(rawConfig) {
  const cfg = normalizeConfig(rawConfig);
  const { files } = generateProject(cfg);
  const entries = [...files.entries()].map(([name, data]) => ({ name, data }));
  return { zip: createZip(entries), config: cfg };
}

module.exports = { buildApk, exportProjectZip, normalizeConfig, generateProject, inspectJava, BuildError, KNOWN_PERMISSIONS };
