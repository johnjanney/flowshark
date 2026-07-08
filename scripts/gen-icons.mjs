/**
 * Generates the app icons (PNG + ICO) without any native dependencies.
 * Draws the FlowShark mark — a white shark fin on a blue rounded square —
 * into a raw RGBA buffer and encodes it as PNG (zlib via node:zlib).
 *
 * Usage: node scripts/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "src-tauri/icons";
mkdirSync(OUT, { recursive: true });

// ---- tiny raster engine -----------------------------------------------------

function makeCanvas(size) {
  return { size, data: new Uint8Array(size * size * 4) };
}

function put(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  const na = a / 255;
  const oa = c.data[i + 3] / 255;
  const outA = na + oa * (1 - na);
  if (outA === 0) return;
  c.data[i] = Math.round((r * na + c.data[i] * oa * (1 - na)) / outA);
  c.data[i + 1] = Math.round((g * na + c.data[i + 1] * oa * (1 - na)) / outA);
  c.data[i + 2] = Math.round((b * na + c.data[i + 2] * oa * (1 - na)) / outA);
  c.data[i + 3] = Math.round(outA * 255);
}

/** Fill using a signed-distance-ish coverage function with 4x supersampling. */
function fill(c, inside, color) {
  const [r, g, b] = color;
  const S = 4;
  for (let y = 0; y < c.size; y++) {
    for (let x = 0; x < c.size; x++) {
      let hits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          if (inside(x + (sx + 0.5) / S, y + (sy + 0.5) / S)) hits++;
        }
      }
      if (hits > 0) put(c, x, y, r, g, b, Math.round((255 * hits) / (S * S)));
    }
  }
}

function roundedRect(size, radius) {
  return (x, y) => {
    const r = radius;
    const cx = Math.max(r, Math.min(size - r, x));
    const cy = Math.max(r, Math.min(size - r, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r)
      ? x >= 0 && x <= size && y >= 0 && y <= size &&
          ((x >= r && x <= size - r) || (y >= r && y <= size - r) || (x - cx) ** 2 + (y - cy) ** 2 <= r * r)
      : false;
  };
}

function pointInPolygon(pts) {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };
}

/** Smooth the fin with a chaikin pass so the polygon looks curved. */
function chaikin(pts, iterations = 3) {
  let out = pts;
  for (let it = 0; it < iterations; it++) {
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out = next;
  }
  return out;
}

function drawIcon(size) {
  const c = makeCanvas(size);
  const u = size / 32; // design grid is 32x32
  fill(c, roundedRect(size, 7 * u), [37, 99, 235]); // #2563eb

  // shark fin
  const fin = chaikin(
    [
      [6, 24], [8, 16], [12, 10], [17, 8], [15.5, 13], [16, 17],
      [24, 13], [22.5, 18], [18, 21.5], [12, 23.5],
    ].map(([x, y]) => [x * u, y * u])
  );
  fill(c, pointInPolygon(fin), [255, 255, 255]);

  // water line
  const wave = chaikin(
    [
      [5, 26.5], [10, 25.5], [16, 26.5], [22, 25.5], [27, 26.5],
      [27, 28], [22, 27], [16, 28], [10, 27], [5, 28],
    ].map(([x, y]) => [x * u, y * u]),
    2
  );
  fill(c, pointInPolygon(wave), [191, 219, 254]);
  return c;
}

// ---- PNG encoding -------------------------------------------------------------

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
      table[n] = cc;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(c) {
  const { size, data } = c;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(data.buffer, y * size * 4, size * 4).copy(
      raw,
      y * (size * 4 + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO container with PNG-encoded images (valid for Vista+). */
function encodeICO(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  const blobs = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    blobs.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

// ---- emit ---------------------------------------------------------------------

const sizes = [16, 32, 48, 128, 256, 512];
const rendered = new Map();
for (const s of sizes) {
  rendered.set(s, encodePNG(drawIcon(s)));
}

writeFileSync(join(OUT, "32x32.png"), rendered.get(32));
writeFileSync(join(OUT, "128x128.png"), rendered.get(128));
writeFileSync(join(OUT, "128x128@2x.png"), rendered.get(256));
writeFileSync(join(OUT, "icon.png"), rendered.get(512));
writeFileSync(
  join(OUT, "icon.ico"),
  encodeICO([16, 32, 48, 256].map((s) => ({ size: s, png: rendered.get(s) })))
);
console.log(`Icons written to ${OUT}/`);
