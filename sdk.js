'use strict';
/** اكتشاف أدوات Android SDK و JDK المطلوبة لبناء APK. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const IS_WIN = process.platform === 'win32';

function candidatesSdkRoots() {
  const list = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.cwd(), 'android-sdk'),
    path.join(__dirname, '..', 'android-sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    '/opt/android-sdk',
    '/usr/lib/android-sdk',
  ];
  return list.filter(Boolean);
}

function latestDir(parent) {
  try {
    const dirs = fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return dirs.length ? path.join(parent, dirs[0]) : null;
  } catch {
    return null;
  }
}

function which(cmd) {
  const exts = IS_WIN ? ['.exe', '.bat', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function tool(dir, name, wrapperExt) {
  if (!dir) return null;
  const candidates = IS_WIN ? [name + (wrapperExt || '.exe'), name + '.bat', name + '.exe'] : [name];
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function javaVersion(javacPath) {
  try {
    const out = execFileSync(javacPath, ['-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out.trim();
  } catch {
    return null;
  }
}

/** @returns {{ok:boolean, sdkRoot:string|null, tools:object, missing:string[], java:string|null}} */
function detect() {
  let sdkRoot = null;
  let buildTools = null;
  let platform = null;
  for (const root of candidatesSdkRoots()) {
    const bt = latestDir(path.join(root, 'build-tools'));
    const pl = latestDir(path.join(root, 'platforms'));
    if (bt && pl && fs.existsSync(path.join(pl, 'android.jar'))) {
      sdkRoot = root;
      buildTools = bt;
      platform = pl;
      break;
    }
  }
  const javac = which('javac') || (process.env.JAVA_HOME ? tool(path.join(process.env.JAVA_HOME, 'bin'), 'javac') : null);
  const keytool = which('keytool') || (process.env.JAVA_HOME ? tool(path.join(process.env.JAVA_HOME, 'bin'), 'keytool') : null);
  const tools = {
    aapt2: tool(buildTools, 'aapt2'),
    d8: tool(buildTools, 'd8', '.bat'),
    apksigner: tool(buildTools, 'apksigner', '.bat'),
    zipalign: tool(buildTools, 'zipalign'),
    androidJar: platform ? path.join(platform, 'android.jar') : null,
    javac,
    keytool,
  };
  const missing = Object.entries(tools)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return {
    ok: missing.length === 0,
    sdkRoot,
    buildTools: buildTools ? path.basename(buildTools) : null,
    platform: platform ? path.basename(platform) : null,
    tools,
    missing,
    java: javac ? javaVersion(javac) : null,
  };
}

module.exports = { detect };
