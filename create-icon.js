const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'assets');

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- 图形绘制 ---------- */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function renderIcon(size) {
  const SS = 4;
  const W = size * SS;
  const k = W / 256;
  const canvas = Buffer.alloc(W * W * 4);

  const setPixel = (x, y, r, g, b) => {
    const i = (y * W + x) * 4;
    canvas[i] = r;
    canvas[i + 1] = g;
    canvas[i + 2] = b;
    canvas[i + 3] = 255;
  };

  // 圆角矩形 + 蓝色渐变底
  const x0 = 6 * k;
  const y0 = 6 * k;
  const x1 = 250 * k;
  const y1 = 250 * k;
  const radius = 60 * k;
  const topColor = [46, 139, 230];
  const bottomColor = [11, 79, 135];

  const start = Math.floor(Math.min(x0, y0));
  const end = Math.ceil(Math.max(x1, y1));

  for (let y = start; y < end; y++) {
    for (let x = start; x < end; x++) {
      if (x < 0 || y < 0 || x >= W || y >= W) continue;

      const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius));
      const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius));

      if (dx * dx + dy * dy <= radius * radius) {
        const t = (y - y0) / (y1 - y0);
        const r = Math.round(topColor[0] + (bottomColor[0] - topColor[0]) * t);
        const g = Math.round(topColor[1] + (bottomColor[1] - topColor[1]) * t);
        const b = Math.round(topColor[2] + (bottomColor[2] - topColor[2]) * t);
        setPixel(x, y, r, g, b);
      }
    }
  }

  // 白色 V 字形
  const thickness = 30 * k;
  const half = thickness / 2;
  const ax = 84 * k;
  const ay = 76 * k;
  const bx = 128 * k;
  const by = 182 * k;
  const cx = 172 * k;
  const cy = 76 * k;

  const minX = Math.max(0, Math.floor(ax - half));
  const maxX = Math.min(W - 1, Math.ceil(cx + half));
  const minY = Math.max(0, Math.floor(ay - half));
  const maxY = Math.min(W - 1, Math.ceil(by + half));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.min(
        distToSegment(x, y, ax, ay, bx, by),
        distToSegment(x, y, bx, by, cx, cy)
      );
      if (d <= half) {
        setPixel(x, y, 255, 255, 255);
      }
    }
  }

  // 降采样，得到抗锯齿效果
  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          const alpha = canvas[i + 3] / 255;
          r += canvas[i] * alpha;
          g += canvas[i + 1] * alpha;
          b += canvas[i + 2] * alpha;
          a += alpha;
        }
      }

      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / samples) * 255);
    }
  }

  return out;
}

/* ---------- ICO 封装（内含多尺寸 PNG，供 Windows 使用） ---------- */
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dirs = [];
  const blobs = [];
  let offset = 6 + entries.length * 16;

  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(entry.png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    blobs.push(entry.png);
    offset += entry.png.length;
  }

  return Buffer.concat([header, ...dirs, ...blobs]);
}

/* ---------- 输出文件 ---------- */
try {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const appIconSize = 256;
  fs.writeFileSync(
    path.join(OUT_DIR, 'icon.png'),
    encodePNG(appIconSize, appIconSize, renderIcon(appIconSize))
  );

  const trayIconSize = 32;
  fs.writeFileSync(
    path.join(OUT_DIR, 'tray.png'),
    encodePNG(trayIconSize, trayIconSize, renderIcon(trayIconSize))
  );

  const icoSizes = [16, 32, 48, 64, 128, 256];
  fs.writeFileSync(
    path.join(OUT_DIR, 'icon.ico'),
    encodeICO(icoSizes.map(size => ({
      size,
      png: encodePNG(size, size, renderIcon(size))
    })))
  );

  console.log('图标生成完成: assets/icon.png, assets/tray.png, assets/icon.ico');
} catch (error) {
  console.error('生成图标失败:', error);
  process.exit(1);
}
