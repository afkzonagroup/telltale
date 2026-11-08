/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import { markImage, readImageMarking } from '../src/marking/index.js';
import { crc32 } from '../src/marking/crc32.js';
import { MAX_PNG_CHUNKS } from '../src/marking/png.js';
import { MAX_WEBP_CHUNKS } from '../src/marking/webp.js';
import { decodeUtf8, MAX_XMP_PACKET_BYTES } from '../src/marking/bytes.js';
import { fixture } from './helpers/vectors.js';

/** Small deterministic PRNG (mulberry32) so failures are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mutate(input: Uint8Array, r: () => number): Uint8Array {
  const b = Array.from(input);
  const steps = 1 + Math.floor(r() * 4);
  for (let s = 0; s < steps; s++) {
    const pos = Math.floor(r() * (b.length + 1));
    switch (Math.floor(r() * 6)) {
      case 0:
        if (b.length > 0) b[Math.min(pos, b.length - 1)] = Math.floor(r() * 256);
        break;
      case 1:
        b.length = pos;
        break;
      case 2:
        b.splice(pos, 0, ...Array.from({ length: 1 + Math.floor(r() * 16) }, () => Math.floor(r() * 256)));
        break;
      case 3:
        b.splice(pos, Math.floor(r() * 16));
        break;
      case 4: {
        const v = [0xff, 0xff, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff, 0, 0, 0, 0][Math.floor(r() * 12)] ?? 0;
        for (let i = 0; i < 4 && pos + i < b.length; i++) b[pos + i] = v;
        break;
      }
      default:
        b.splice(pos, 0, ...b.slice(0, Math.floor(r() * 64)));
    }
  }
  return Uint8Array.from(b);
}

const DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
const files = [
  'basic.png', 'png-with-xmp.png', 'png-xmp-compressed.png', 'basic.jpg', 'sips.jpg', 'jpeg-with-xmp.jpg',
  'jpeg-extended-xmp.jpg', 'lossy.webp', 'lossless.webp', 'alpha.webp', 'animated.webp', 'webp-with-xmp.webp',
];

describe('fuzzing with mutated files', () => {
  let successes = 0;
  let failures = 0;
  for (const f of files) {
    it(`never throws anything but TelltaleError and never emits an unreadable file: ${f}`, () => {
      const r = rng(0xc0ffee ^ f.length);
      const base = fixture(f);
      for (let i = 0; i < 400; i++) {
        const input = mutate(base, r);
        const copy = input.slice();
        const t = performance.now();
        try {
          const out = markImage(input, { existingXmp: i % 2 === 0 ? 'merge' : 'replace' });
          const read = readImageMarking(out.bytes);
          expect(read.digitalSourceTypes).toContain(DST);
          expect(markImage(out.bytes, { existingXmp: 'merge' }).action).toBe('unchanged');
          successes++;
        } catch (e) {
          if (!(e instanceof TelltaleError)) throw e;
          failures++;
        }
        try {
          readImageMarking(input);
        } catch (e) {
          if (!(e instanceof TelltaleError)) throw e;
        }
        expect(input).toEqual(copy);
        expect(performance.now() - t).toBeLessThan(500);
      }
    });
  }

  it('exercised both the success and the error paths', () => {
    expect(successes).toBeGreaterThan(200);
    expect(failures).toBeGreaterThan(200);
  });

  it('handles random garbage', () => {
    const r = rng(42);
    for (let i = 0; i < 500; i++) {
      const len = Math.floor(r() * 300);
      const b = Uint8Array.from({ length: len }, () => Math.floor(r() * 256));
      if (i % 3 === 0 && len >= 12) b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
      if (i % 3 === 1 && len >= 8) b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (i % 3 === 2 && len >= 3) b.set([0xff, 0xd8, 0xff]);
      expect(() => {
        try {
          markImage(b);
        } catch (e) {
          if (!(e instanceof TelltaleError)) throw e;
        }
      }).not.toThrow();
    }
  });
});

describe('resource limits on crafted files', () => {
  const be32 = (v: number): number[] => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const pngChunk = (type: string, data: number[]): number[] => {
    const td = Uint8Array.from([...Array.from(type, (c) => c.charCodeAt(0)), ...data]);
    return [...be32(data.length), ...td, ...be32(crc32(td))];
  };

  it('parses a PNG with 90k empty ancillary chunks quickly, and refuses more than the cap', () => {
    const b = fixture('basic.png');
    const filler = pngChunk('tEXt', []);
    const tooMany: number[] = [];
    for (let i = 0; i < MAX_PNG_CHUNKS; i++) tooMany.push(...filler);
    expect(() => markImage(Uint8Array.from([...b.subarray(0, 33), ...tooMany, ...b.subarray(33)]))).toThrow(/Too many PNG chunks/);
    const many: number[] = [];
    for (let i = 0; i < 90_000; i++) many.push(...filler);
    const big = Uint8Array.from([...b.subarray(0, 33), ...many, ...b.subarray(33)]);
    const t = performance.now();
    expect(markImage(big).action).toBe('inserted');
    expect(performance.now() - t).toBeLessThan(3000);
  });

  it('rejects many XMP chunks without quadratic scanning', () => {
    const b = fixture('basic.png');
    const kw = Array.from('XML:com.adobe.xmp', (c) => c.charCodeAt(0));
    const chunk = pngChunk('iTXt', [...kw, 0, 0, 0, ...new Array<number>(2000).fill(0x41)]);
    const many: number[] = [];
    for (let i = 0; i < 3000; i++) many.push(...chunk);
    const big = Uint8Array.from([...b.subarray(0, 33), ...many, ...b.subarray(33)]);
    const t = performance.now();
    expect(() => markImage(big)).toThrow(TelltaleError);
    expect(performance.now() - t).toBeLessThan(2000);
  });

  it('refuses to decode an XMP packet larger than the scan limit allows', () => {
    expect(() => decodeUtf8(new Uint8Array(MAX_XMP_PACKET_BYTES + 1))).toThrow(/too large/);
    expect(decodeUtf8(new Uint8Array(4))).toBe('\0\0\0\0');
  });

  it('parses a JPEG with 60k tiny segments quickly', () => {
    const b = fixture('basic.jpg');
    const seg = [0xff, 0xe5, 0x00, 0x02];
    const many: number[] = [];
    for (let i = 0; i < 60_000; i++) many.push(...seg);
    const big = Uint8Array.from([...b.subarray(0, 20), ...many, ...b.subarray(20)]);
    const t = performance.now();
    expect(markImage(big).action).toBe('inserted');
    expect(performance.now() - t).toBeLessThan(3000);
  });

  it('rejects more JPEG segments than the cap', () => {
    const b = fixture('basic.jpg');
    const many: number[] = [];
    for (let i = 0; i < 70_000; i++) many.push(0xff, 0xe5, 0x00, 0x02);
    const big = Uint8Array.from([...b.subarray(0, 20), ...many, ...b.subarray(20)]);
    expect(() => markImage(big)).toThrow(/Too many JPEG segments/);
  });

  it('parses a WebP with 90k empty chunks quickly, and refuses more than the cap', () => {
    const b = fixture('alpha.webp');
    const over: number[] = [];
    for (let i = 0; i < MAX_WEBP_CHUNKS; i++) over.push(0x41, 0x42, 0x43, 0x44, 0, 0, 0, 0);
    const tooBig = Uint8Array.from([...b, ...over]);
    const n = tooBig.length - 8;
    tooBig.set([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24], 4);
    expect(() => markImage(tooBig)).toThrow(/Too many WebP chunks/);
    const many: number[] = [];
    for (let i = 0; i < 90_000; i++) many.push(0x41, 0x42, 0x43, 0x44, 0, 0, 0, 0);
    const big = Uint8Array.from([...b, ...many]);
    const size = big.length - 8;
    big.set([size & 255, (size >>> 8) & 255, (size >>> 16) & 255, size >>> 24], 4);
    const t = performance.now();
    expect(markImage(big).action).toBe('inserted');
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
