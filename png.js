'use strict';
/** مولّد PNG بسيط لإنشاء أيقونة افتراضية للتطبيق (مربع بزوايا دائرية مع سحابة). */
const zlib = require('zlib');
const { crc32 } = require('./zip');

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return [79, 140, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** يرسم أيقونة مربعة بحجم size بلون أساسي color مع رمز سحابة أبيض. */
function makeIcon(size, color = '#4f8cff') {
  const [r, g, b] = hexToRgb(color);
  const radius = size * 0.22;
  const rows = [];
  const inCloud = (x, y) => {
    const cx = x / size;
    const cy = y / size;
    const circles = [
      [0.38, 0.58, 0.17],
      [0.55, 0.47, 0.2],
      [0.68, 0.6, 0.15],
    ];
    if (cx > 0.22 && cx < 0.82 && cy > 0.58 && cy < 0.74) return true;
    return circles.some(([a, b2, rad]) => (cx - a) ** 2 + (cy - b2) ** 2 <= rad * rad);
  };
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      // rounded corners
      let alpha = 255;
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (dx * dx + dy * dy > radius * radius) alpha = 0;
      const t = y / size;
      let pr = Math.round(r * (1 - t * 0.25));
      let pg = Math.round(g * (1 - t * 0.15));
      let pb = Math.round(b * (1 - t * 0.05));
      if (alpha && inCloud(x, y)) {
        pr = pg = pb = 255;
      }
      const o = 1 + x * 4;
      row[o] = pr;
      row[o + 1] = pg;
      row[o + 2] = pb;
      row[o + 3] = alpha;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { makeIcon };
