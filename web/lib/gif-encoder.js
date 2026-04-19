/**
 * gif-encoder.js — Minimal GIF89a encoder with LZW compression
 *
 * Produces animated GIFs from RGBA pixel data.
 * Handles color quantization (popularity-based in 15-bit color space),
 * LZW compression, and the full GIF89a file format.
 */

export class GIFEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.out = [];
    this.palette = null;  // Uint8Array(768) — 256 RGB triplets
    this.lookup = null;   // Uint8Array(32768) — 15-bit color → palette index
  }

  /**
   * Build a global 256-color palette from sampled RGBA pixel arrays.
   * Uses popularity-based quantization in 15-bit color space (5 bits/channel).
   * @param {Uint8Array[]} samples - Array of RGBA pixel buffers to sample from
   */
  buildPalette(samples) {
    // Count colors in reduced 15-bit color space
    const hist = new Uint32Array(32768);
    for (const rgba of samples) {
      for (let i = 0; i < rgba.length; i += 4) {
        const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
        hist[key]++;
      }
    }

    // Collect non-zero entries, sort by frequency descending
    const entries = [];
    for (let i = 0; i < 32768; i++) {
      if (hist[i] > 0) entries.push(i);
    }
    entries.sort((a, b) => hist[b] - hist[a]);

    // Build palette: top 256 colors, expanded back to 8-bit.
    // Use (v5 << 3) | (v5 >> 2) for accurate 5→8 bit expansion (maps 31 → 255).
    this.palette = new Uint8Array(768); // 256 * 3
    const count = Math.min(256, entries.length);
    for (let i = 0; i < count; i++) {
      const key = entries[i];
      const r5 = (key >> 10) & 31, g5 = (key >> 5) & 31, b5 = key & 31;
      this.palette[i * 3]     = (r5 << 3) | (r5 >> 2);
      this.palette[i * 3 + 1] = (g5 << 3) | (g5 >> 2);
      this.palette[i * 3 + 2] = (b5 << 3) | (b5 >> 2);
    }

    // Build fast lookup table: for every 15-bit color, find nearest palette index
    this.lookup = new Uint8Array(32768);
    for (let c = 0; c < 32768; c++) {
      const r5 = (c >> 10) & 31, g5 = (c >> 5) & 31, b5 = c & 31;
      const r = (r5 << 3) | (r5 >> 2);
      const g = (g5 << 3) | (g5 >> 2);
      const b = (b5 << 3) | (b5 >> 2);
      let minDist = Infinity;
      let best = 0;
      for (let k = 0; k < count; k++) {
        const dr = r - this.palette[k * 3];
        const dg = g - this.palette[k * 3 + 1];
        const db = b - this.palette[k * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < minDist) {
          minDist = d;
          best = k;
          if (d === 0) break;
        }
      }
      this.lookup[c] = best;
    }
  }

  /**
   * Quantize an RGBA pixel buffer to palette-indexed pixels.
   * @param {Uint8Array} rgba - RGBA pixel data (width * height * 4 bytes)
   * @returns {Uint8Array} Indexed pixel data (width * height bytes)
   */
  quantize(rgba) {
    const n = this.width * this.height;
    const indexed = new Uint8Array(n);
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
      indexed[j] = this.lookup[key];
    }
    return indexed;
  }

  /**
   * Encode indexed frames into a GIF89a byte stream.
   * @param {{ indexed: Uint8Array, delay: number }[]} frames
   *   Each frame has `indexed` (palette-indexed pixels) and `delay` (centiseconds).
   * @returns {Uint8Array} Complete GIF file data
   */
  encode(frames) {
    this.out = [];

    // ---- Header ----
    this._writeStr('GIF89a');

    // ---- Logical Screen Descriptor ----
    this._writeU16(this.width);
    this._writeU16(this.height);
    // Packed: GCT=1, ColorRes=7 (8 bpc), Sort=0, GCT Size=7 (256 entries)
    this._writeU8(0xF7);
    this._writeU8(0); // Background color index
    this._writeU8(0); // Pixel aspect ratio

    // ---- Global Color Table (256 × 3 = 768 bytes) ----
    for (let i = 0; i < 768; i++) {
      this._writeU8(this.palette[i]);
    }

    // ---- Netscape Application Extension (infinite loop) ----
    this._writeU8(0x21); // Extension introducer
    this._writeU8(0xFF); // Application extension label
    this._writeU8(11);   // Block size
    this._writeStr('NETSCAPE2.0');
    this._writeU8(3);    // Sub-block size
    this._writeU8(1);    // Sub-block ID
    this._writeU16(0);   // Loop count: 0 = infinite
    this._writeU8(0);    // Block terminator

    // ---- Frames ----
    for (const frame of frames) {
      // Graphic Control Extension
      this._writeU8(0x21); // Extension introducer
      this._writeU8(0xF9); // GCE label
      this._writeU8(4);    // Block size
      this._writeU8(0x00); // Packed: disposal=0, no user input, no transparency
      this._writeU16(frame.delay);
      this._writeU8(0);    // Transparent color index (unused)
      this._writeU8(0);    // Block terminator

      // Image Descriptor
      this._writeU8(0x2C); // Image separator
      this._writeU16(0);   // Left
      this._writeU16(0);   // Top
      this._writeU16(this.width);
      this._writeU16(this.height);
      this._writeU8(0);    // Packed: no LCT, no interlace

      // LZW Minimum Code Size + compressed pixel data
      this._writeLZW(frame.indexed);
    }

    // ---- Trailer ----
    this._writeU8(0x3B);

    return new Uint8Array(this.out);
  }

  // ---- LZW Compression ----

  _writeLZW(indexed) {
    const MIN_CODE_SIZE = 8;
    this._writeU8(MIN_CODE_SIZE);

    const CLEAR = 256;
    const EOI = 257;

    let codeSize = 9;
    let nextCode = 258;
    let codeMask = 512; // 1 << codeSize

    let table = new Map();

    // Bit-packing state
    let bits = 0;
    let bitCount = 0;
    let block = [];
    const self = this;

    function emit(code) {
      bits |= (code << bitCount);
      bitCount += codeSize;
      while (bitCount >= 8) {
        block.push(bits & 0xFF);
        bits >>>= 8;
        bitCount -= 8;
        if (block.length === 255) {
          self._writeU8(255);
          for (let i = 0; i < 255; i++) self._writeU8(block[i]);
          block = [];
        }
      }
    }

    function resetTable() {
      table = new Map();
      codeSize = MIN_CODE_SIZE + 1;
      nextCode = EOI + 1;
      codeMask = 1 << codeSize;
    }

    // Start with a clear code
    emit(CLEAR);
    resetTable();

    let prefix = indexed[0];

    for (let i = 1; i < indexed.length; i++) {
      const suffix = indexed[i];
      const key = (prefix << 8) | suffix;

      if (table.has(key)) {
        prefix = table.get(key);
      } else {
        emit(prefix);

        if (nextCode < 4096) {
          table.set(key, nextCode);
          nextCode++;
          if (nextCode > codeMask && codeSize < 12) {
            codeSize++;
            codeMask = 1 << codeSize;
          }
        } else {
          // Table full → clear and reset
          emit(CLEAR);
          resetTable();
        }

        prefix = suffix;
      }
    }

    // Emit final prefix + EOI
    emit(prefix);
    emit(EOI);

    // Flush remaining bits
    if (bitCount > 0) {
      block.push(bits & 0xFF);
    }
    if (block.length > 0) {
      self._writeU8(block.length);
      for (let i = 0; i < block.length; i++) self._writeU8(block[i]);
    }

    // Block terminator
    this._writeU8(0);
  }

  // ---- Low-level writers ----

  _writeU8(v) { this.out.push(v & 0xFF); }

  _writeU16(v) {
    this.out.push(v & 0xFF);
    this.out.push((v >> 8) & 0xFF);
  }

  _writeStr(s) {
    for (let i = 0; i < s.length; i++) {
      this.out.push(s.charCodeAt(i));
    }
  }
}
