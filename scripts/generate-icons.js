// scripts/generate-icons.js
// Generates icon-192.png and icon-512.png using only Node built-ins.
// Design: #0e0b09 background, amber circle (#c4956a) centred.
// Run: node scripts/generate-icons.js  (from project root)

var zlib = require('zlib');
var fs   = require('fs');
var path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
function makeCrcTable() {
  var t = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
}
var CRC_TABLE = makeCrcTable();
function crc32(buf) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk builder ──────────────────────────────────────────────
function buildChunk(type, data) {
  var len  = Buffer.alloc(4);  len.writeUInt32BE(data.length, 0);
  var typeB = Buffer.from(type, 'ascii');
  var crcIn = Buffer.concat([typeB, data]);
  var crcB  = Buffer.alloc(4);  crcB.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// ── Draw icon at given size ────────────────────────────────────────
function createIcon(size, outPath) {
  var w = size, h = size;
  var cx = w / 2, cy = h / 2;
  var radius = Math.round(w * 0.208); // ~40px at 192, ~107px at 512

  // Build raw scanline data (RGBA, filter byte 0 per row)
  var rowBytes = 1 + w * 4; // 1 filter byte + RGBA per pixel
  var raw = Buffer.alloc(h * rowBytes);
  for (var y = 0; y < h; y++) {
    var rowOff = y * rowBytes;
    raw[rowOff] = 0; // filter type: None
    for (var x = 0; x < w; x++) {
      var dx = x - cx, dy = y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var px = rowOff + 1 + x * 4;
      if (dist <= radius) {
        raw[px]   = 196; // R #c4956a
        raw[px+1] = 149; // G
        raw[px+2] = 106; // B
        raw[px+3] = 255; // A
      } else {
        raw[px]   = 14;  // R #0e0b09
        raw[px+1] = 11;  // G
        raw[px+2] = 9;   // B
        raw[px+3] = 255; // A
      }
    }
  }

  var compressed = zlib.deflateSync(raw, { level: 9 });

  // IHDR
  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8]  = 8; // bit depth
  ihdrData[9]  = 6; // colour type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  var sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = buildChunk('IHDR', ihdrData);
  var idat = buildChunk('IDAT', compressed);
  var iend = buildChunk('IEND', Buffer.alloc(0));

  fs.writeFileSync(outPath, Buffer.concat([sig, ihdr, idat, iend]));
  console.log('Created ' + outPath + ' (' + size + 'x' + size + ')');
}

var root = path.join(__dirname, '..');
createIcon(192, path.join(root, 'icon-192.png'));
createIcon(512, path.join(root, 'icon-512.png'));
console.log('Done.');
