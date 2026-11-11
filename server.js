'use strict';
/**
 * APK Studio — خادم تطبيق صناعة ملفات APK
 * بدون اعتماديات خارجية (Node.js >= 18)
 *
 * Environment:
 *   PORT          منفذ الاستماع (افتراضي 3000)
 *   HOST          عنوان الربط (افتراضي 0.0.0.0)
 *   ANDROID_HOME  مسار Android SDK (يحتوي build-tools و platforms)
 *   DATA_DIR      مجلد البيانات (مفتاح التوقيع ومخرجات البناء) افتراضي ./.data
 */
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const sdk = require('./lib/sdk');
const { buildApk, exportProjectZip, BuildError, KNOWN_PERMISSIONS } = require('./lib/builder');
const { analyze } = require('./lib/analyzer');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '.data'));
const BUILDS_DIR = path.join(DATA_DIR, 'builds');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 12 * 1024 * 1024;
const MAX_JOBS_KEPT = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ------------------------------------------------------------------ jobs --

/** @type {Map<string, {id:string,status:string,log:string[],created:number,apkPath?:string,downloadName?:string,size?:number,error?:string}>} */
const jobs = new Map();
let building = false;
const queue = [];

function newJob() {
  const id = crypto.randomBytes(8).toString('hex');
  const job = { id, status: 'queued', log: [], created: Date.now() };
  jobs.set(id, job);
  // keep the map bounded
  if (jobs.size > MAX_JOBS_KEPT) {
    const oldest = [...jobs.values()].sort((a, b) => a.created - b.created)[0];
    if (oldest && oldest.id !== id && oldest.status !== 'running') {
      jobs.delete(oldest.id);
      if (oldest.apkPath) fsp.rm(oldest.apkPath, { force: true }).catch(() => {});
    }
  }
  return job;
}

async function runJob(job, config) {
  building = true;
  job.status = 'running';
  const log = (line) => job.log.push(`[${new Date().toLocaleTimeString('ar-EG', { hour12: false })}] ${line}`);
  let workDir = null;
  try {
    const result = await buildApk(config, { dataDir: DATA_DIR, log });
    workDir = result.workDir;
    await fsp.mkdir(BUILDS_DIR, { recursive: true });
    const dest = path.join(BUILDS_DIR, `${job.id}.apk`);
    await fsp.copyFile(result.apkPath, dest);
    job.apkPath = dest;
    job.downloadName = result.downloadName;
    job.size = result.size;
    job.status = 'done';
  } catch (e) {
    job.status = 'failed';
    job.error = e instanceof BuildError ? e.message : `خطأ غير متوقع: ${e.message}`;
    log(`❌ ${job.error}`);
    if (!(e instanceof BuildError)) console.error(e);
  } finally {
    if (workDir) fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    building = false;
    const next = queue.shift();
    if (next) runJob(next.job, next.config);
  }
}

function enqueue(config) {
  const job = newJob();
  if (building) {
    job.log.push('⏳ في الانتظار: هناك عملية بناء أخرى قيد التنفيذ…');
    queue.push({ job, config });
  } else {
    runJob(job, config);
  }
  return job;
}

// --------------------------------------------------------------- helpers --

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'حجم الطلب كبير جداً'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON غير صالح'));
      }
    });
    req.on('error', reject);
  });
}

function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** فحص صياغة JavaScript دون تنفيذه عبر node --check */
async function checkJsSyntax(code) {
  const tmp = path.join(os.tmpdir(), `apkstudio-check-${crypto.randomBytes(6).toString('hex')}.js`);
  await fsp.writeFile(tmp, code);
  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--check', tmp], { windowsHide: true });
      let err = '';
      child.stderr.on('data', (d) => (err += d));
      const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve({ ok: true });
        const m = /:(\d+)\n([\s\S]*?)\n\n(SyntaxError: .*)/.exec(err) || /:(\d+)[\s\S]*?(SyntaxError: .*)/.exec(err);
        resolve({ ok: false, line: m ? Number(m[1]) : null, message: m ? (m[3] || m[2]).trim() : err.trim().split('\n').pop() });
      });
    });
  } finally {
    fsp.rm(tmp, { force: true }).catch(() => {});
  }
}

function sdkStatusPayload() {
  const env = sdk.detect();
  return {
    ready: env.ok,
    sdkRoot: env.sdkRoot,
    buildTools: env.buildTools,
    platform: env.platform,
    java: env.java,
    missing: env.missing,
    hint: env.ok ? null : 'شغّل scripts/setup-android-sdk.sh (أو setup-android-sdk.ps1 على ويندوز) أو عيّن ANDROID_HOME إلى مسار SDK يحتوي build-tools و platforms',
    permissions: Object.keys(KNOWN_PERMISSIONS),
    building,
    queued: queue.length,
  };
}

// ------------------------------------------------------------------- api --

async function handleApi(req, res, url) {
  const route = url.pathname.slice(4);
  const m = req.method;

  if (route === '/status' && m === 'GET') return sendJson(res, 200, sdkStatusPayload());

  if (route === '/analyze' && m === 'POST') {
    const body = await readJson(req);
    const report = analyze(body);
    if (report.mode === 'web' && body.js && String(body.js).trim()) {
      const syntax = await checkJsSyntax(String(body.js));
      report.syntax = syntax;
      if (!syntax.ok) report.risks.unshift({ level: 'high', text: `خطأ في صياغة JavaScript${syntax.line ? ` عند السطر ${syntax.line}` : ''}: ${syntax.message}` });
    }
    return sendJson(res, 200, report);
  }

  if (route === '/build' && m === 'POST') {
    const body = await readJson(req);
    const env = sdk.detect();
    if (!env.ok) throw new HttpError(503, `أدوات البناء غير متوفرة على هذا الجهاز (المفقود: ${env.missing.join(', ')}). ثبّت Android SDK عبر scripts/setup-android-sdk.sh أو صدّر المشروع وابنِه على جهاز مجهّز.`);
    // validate early for an immediate, clear error
    try {
      require('./lib/builder').normalizeConfig(body);
    } catch (e) {
      if (e instanceof BuildError) throw new HttpError(400, e.message);
      throw e;
    }
    const job = enqueue(body);
    return sendJson(res, 202, { id: job.id, status: job.status });
  }

  if (route.startsWith('/jobs/') && m === 'GET') {
    const [id, sub] = route.slice(6).split('/');
    const job = jobs.get(id);
    if (!job) throw new HttpError(404, 'المهمة غير موجودة');
    if (sub === 'apk') {
      if (job.status !== 'done' || !job.apkPath) throw new HttpError(409, 'الملف غير جاهز بعد');
      const st = await fsp.stat(job.apkPath);
      res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': st.size, 'Content-Disposition': contentDisposition(job.downloadName || 'app.apk'), 'Cache-Control': 'no-store' });
      return pipeline(fs.createReadStream(job.apkPath), res);
    }
    const since = Number(url.searchParams.get('since') || 0);
    return sendJson(res, 200, { id: job.id, status: job.status, log: job.log.slice(since), logLength: job.log.length, error: job.error || null, size: job.size || null, downloadName: job.downloadName || null, apkUrl: job.status === 'done' ? `/api/jobs/${job.id}/apk` : null });
  }

  if (route === '/export' && m === 'POST') {
    const body = await readJson(req);
    let out;
    try {
      out = exportProjectZip(body);
    } catch (e) {
      if (e instanceof BuildError) throw new HttpError(400, e.message);
      throw e;
    }
    const name = `${(out.config.appName || 'app').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_')}-project.zip`;
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': out.zip.length, 'Content-Disposition': contentDisposition(name), 'Cache-Control': 'no-store' });
    return res.end(out.zip);
  }

  throw new HttpError(404, 'المسار غير موجود');
}

async function serveStatic(req, res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const abs = path.join(PUBLIC_DIR, path.normalize(file));
  if (!abs.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(404, 'غير موجود');
  let st;
  try {
    st = await fsp.stat(abs);
  } catch {
    throw new HttpError(404, 'غير موجود');
  }
  if (!st.isFile()) throw new HttpError(404, 'غير موجود');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  return pipeline(fs.createReadStream(abs), res);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url.pathname);
  throw new HttpError(405, 'الطريقة غير مسموحة');
}

function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      if (res.headersSent) return res.destroy();
      sendJson(res, status, { error: err instanceof HttpError ? err.message : 'خطأ داخلي في الخادم' });
    });
  });
}

if (require.main === module) {
  fs.mkdirSync(BUILDS_DIR, { recursive: true });
  const env = sdk.detect();
  createServer().listen(PORT, HOST, () => {
    const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`📱 APK Studio يعمل على http://${shown}:${PORT}`);
    if (env.ok) console.log(`   ✓ أدوات البناء جاهزة: ${env.sdkRoot} (build-tools ${env.buildTools}, ${env.platform}, ${env.java})`);
    else console.log(`   ⚠ أدوات البناء غير مكتملة (المفقود: ${env.missing.join(', ')}). شغّل scripts/setup-android-sdk.sh أو عيّن ANDROID_HOME.`);
  });
}

module.exports = { createServer };
