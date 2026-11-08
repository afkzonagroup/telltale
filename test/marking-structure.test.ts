/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import { u16be, u32be, u32le } from '../src/marking/bytes.js';
import { crc32 } from '../src/marking/crc32.js';
import { buildXmpSegment, MAX_JPEG_XMP_PACKET, parseJpegHeader } from '../src/marking/jpeg.js';
import { detectImageFormat, markImage, readImageMarking } from '../src/marking/index.js';
import { buildXmpChunk, parsePng } from '../src/marking/png.js';
import { buildXmpRiffChunk, parseWebp } from '../src/marking/webp.js';
import { fixture } from './helpers/vectors.js';

const DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

describe('CRC-32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('matches the IEND chunk CRC', () => {
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });
});

describe('format detection', () => {
  it('detects the three containers and nothing else', () => {
    expect(detectImageFormat(fixture('basic.png'))).toBe('png');
    expect(detectImageFormat(fixture('basic.jpg'))).toBe('jpeg');
    expect(detectImageFormat(fixture('lossy.webp'))).toBe('webp');
    expect(detectImageFormat(new Uint8Array(0))).toBeNull();
    expect(detectImageFormat(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBeNull();
  });
});

describe('PNG', () => {
  it('inserts exactly one iTXt chunk after IHDR and changes nothing else', () => {
    const input = fixture('basic.png');
    const out = markImage(input).bytes;
    const chunks = parsePng(out);
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'iTXt', 'pHYs', 'IDAT', 'IEND']);
    const itxt = chunks[1]!;
    const removed = Uint8Array.from([...out.subarray(0, itxt.start), ...out.subarray(itxt.end)]);
    expect(removed).toEqual(input);
    // CRC written correctly.
    expect(crc32(out, itxt.start + 4, itxt.end - 4)).toBe(u32be(out, itxt.end - 4));
    // Header: keyword, null, compression flag 0, method 0, empty language, empty translated keyword.
    const head = new TextDecoder().decode(out.subarray(itxt.dataStart, itxt.dataStart + 22));
    expect(head).toBe('XML:com.adobe.xmp\0\0\0\0\0');
  });

  it('builds a chunk whose CRC verifies', () => {
    const c = buildXmpChunk(new TextEncoder().encode('<x/>'));
    expect(crc32(c, 4, c.length - 4)).toBe(u32be(c, c.length - 4));
  });

  it('keeps an existing packet when merging and replaces it in place', () => {
    const out = markImage(fixture('png-with-xmp.png')).bytes;
    const types = parsePng(out).map((c) => c.type);
    expect(types.filter((t) => t === 'iTXt')).toHaveLength(1);
    const text = new TextDecoder().decode(out);
    expect(text).toContain('Harbour at dusk &amp; boats');
    expect(text).toContain(DST);
  });

  it('moves a legacy tEXt XMP chunk into iTXt on replace', () => {
    const out = markImage(fixture('png-xmp-legacy-text.png'), { existingXmp: 'replace' }).bytes;
    expect(parsePng(out).map((c) => c.type)).toEqual(['IHDR', 'iTXt', 'pHYs', 'IDAT', 'IEND']);
  });
});

describe('JPEG', () => {
  it('inserts the XMP APP1 after JFIF and Exif and leaves all other bytes alone', () => {
    const input = fixture('sips.jpg');
    const out = markImage(input).bytes;
    const segs = parseJpegHeader(out);
    const markers = segs.map((s) => s.marker);
    expect(markers.slice(0, 3)).toEqual([0xe0, 0xe1, 0xe1]);
    const xmp = segs[2]!;
    expect(new TextDecoder().decode(out.subarray(xmp.dataStart, xmp.dataStart + 29))).toBe('http://ns.adobe.com/xap/1.0/\0');
    const removed = Uint8Array.from([...out.subarray(0, xmp.start), ...out.subarray(xmp.end)]);
    expect(removed).toEqual(input);
  });

  it('enforces the 65502-byte packet limit exactly', () => {
    const ok = buildXmpSegment(new Uint8Array(MAX_JPEG_XMP_PACKET));
    // Length field = 2 + 29 + packet; the spec limit keeps it below 65535.
    expect(u16be(ok, 2)).toBe(2 + 29 + MAX_JPEG_XMP_PACKET);
    expect(() => buildXmpSegment(new Uint8Array(MAX_JPEG_XMP_PACKET + 1))).toThrow(TelltaleError);
  });

  it('removes orphaned ExtendedXMP segments on replace but keeps them on merge', () => {
    const ext = 'http://ns.adobe.com/xmp/extension/';
    const merged = new TextDecoder('latin1').decode(markImage(fixture('jpeg-extended-xmp.jpg')).bytes);
    expect(merged).toContain(ext);
    const replaced = new TextDecoder('latin1').decode(markImage(fixture('jpeg-extended-xmp.jpg'), { existingXmp: 'replace' }).bytes);
    expect(replaced).not.toContain(ext);
  });

  it('copies the entropy-coded data unchanged', () => {
    const input = fixture('basic.jpg');
    const out = markImage(input).bytes;
    const tailIn = input.subarray(input.length - 30);
    expect(out.subarray(out.length - 30)).toEqual(tailIn);
  });
});

describe('WebP', () => {
  it('converts simple lossy WebP to the extended layout with the right canvas', () => {
    const out = markImage(fixture('lossy.webp')).bytes;
    const chunks = parseWebp(out);
    expect(chunks.map((c) => c.fourcc)).toEqual(['VP8X', 'VP8 ', 'XMP ']);
    const vp8x = chunks[0]!;
    expect(out[vp8x.dataStart]).toBe(0x04);
    const w = (out[vp8x.dataStart + 4]! | (out[vp8x.dataStart + 5]! << 8) | (out[vp8x.dataStart + 6]! << 16)) + 1;
    const h = (out[vp8x.dataStart + 7]! | (out[vp8x.dataStart + 8]! << 8) | (out[vp8x.dataStart + 9]! << 16)) + 1;
    expect([w, h]).toEqual([16, 12]);
    expect(u32le(out, 4)).toBe(out.length - 8);
  });

  it('sets the alpha flag when a lossless image uses alpha', () => {
    const out = markImage(fixture('alpha-lossless.webp')).bytes;
    expect(out[20]).toBe(0x14);
    const noAlpha = markImage(fixture('lossless.webp')).bytes;
    expect(noAlpha[20]).toBe(0x04);
  });

  it('places XMP after EXIF and before unknown chunks, preserving padding', () => {
    expect(parseWebp(markImage(fixture('webp-exif.webp')).bytes).map((c) => c.fourcc)).toEqual(['VP8X', 'VP8 ', 'EXIF', 'XMP ']);
    const out = markImage(fixture('webp-unknown-chunk.webp')).bytes;
    expect(parseWebp(out).map((c) => c.fourcc)).toEqual(['VP8X', 'ALPH', 'VP8 ', 'XMP ', 'ABCD']);
    expect(out.length % 2).toBe(0);
  });

  it('pads odd-length packets with a zero byte', () => {
    const c = buildXmpRiffChunk(Uint8Array.of(1, 2, 3));
    expect(c.length).toBe(12);
    expect(c[11]).toBe(0);
    expect(u32le(c, 4)).toBe(3);
  });

  it('keeps animation chunks in order', () => {
    const out = markImage(fixture('animated.webp')).bytes;
    expect(parseWebp(out).map((c) => c.fourcc)).toEqual(['VP8X', 'ANIM', 'ANMF', 'ANMF', 'XMP ']);
    expect(out[20]! & 0x02).toBe(0x02);
  });
});

describe('round trip', () => {
  const files = ['basic.png', 'basic.jpg', 'sips.jpg', 'lossy.webp', 'lossless.webp', 'alpha.webp', 'animated.webp'];
  for (const f of files) {
    it(`marks and reads back ${f}, and a second mark is a no-op`, () => {
      const once = markImage(fixture(f), { aiSystemUsed: 'Example Model', aiSystemVersionUsed: '1.0' });
      const read = readImageMarking(once.bytes);
      expect(read.generativeAi).toBe(true);
      expect(read.digitalSourceTypes).toEqual([DST]);
      expect(read.aiSystemUsed).toEqual(['Example Model']);
      expect(read.aiSystemVersionUsed).toEqual(['1.0']);
      const twice = markImage(once.bytes, { aiSystemUsed: 'Example Model', aiSystemVersionUsed: '1.0' });
      expect(twice.action).toBe('unchanged');
      expect(twice.bytes).toEqual(once.bytes);
    });
  }

  it('reports an unmarked file as not generative', () => {
    const r = readImageMarking(fixture('basic.png'));
    expect(r).toMatchObject({ hasXmp: false, generativeAi: false, digitalSourceTypes: [] });
  });

  it('reports unreadable XMP instead of throwing', () => {
    expect(readImageMarking(fixture('png-xmp-doctype.png')).xmpUnreadable).toBe(true);
    expect(readImageMarking(fixture('png-xmp-compressed.png')).xmpUnreadable).toBe(true);
  });

  it('rejects a non-Uint8Array input', () => {
    expect(() => markImage('not bytes' as unknown as Uint8Array)).toThrow(TelltaleError);
    expect(() => readImageMarking([1, 2, 3] as unknown as Uint8Array)).toThrow(TelltaleError);
  });

  it('applies the size limit to reading too', () => {
    expect(() => readImageMarking(fixture('basic.png'), { maxInputBytes: 10 })).toThrow(/limit/);
    expect(() => readImageMarking(fixture('basic.png'), { maxInputBytes: -1 })).toThrow(TelltaleError);
  });

  it('rejects non-object options', () => {
    expect(() => markImage(fixture('basic.png'), 'x' as unknown as object)).toThrow(TelltaleError);
    expect(() => markImage(fixture('basic.png'), [] as unknown as object)).toThrow(TelltaleError);
    expect(() => markImage(fixture('basic.png'), null as unknown as object)).toThrow(TelltaleError);
  });
});
