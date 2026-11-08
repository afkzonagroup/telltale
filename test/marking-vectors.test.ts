/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import { markImage, readImageMarking } from '../src/marking/index.js';
import { loadVectors, materialise, sha256 } from './helpers/vectors.js';

const vectors = loadVectors();

describe('shared marking vectors (also run by the Python package)', () => {
  it('has a meaningful number of cases', () => {
    expect(vectors.version).toBe(1);
    expect(vectors.mark.length).toBeGreaterThan(100);
    expect(vectors.read.length).toBeGreaterThan(50);
  });

  for (const v of vectors.mark) {
    it(`mark ${v.id}`, () => {
      const input = materialise(v.input);
      const before = input.slice();
      const run = (): ReturnType<typeof markImage> => markImage(input, v.options);
      if ('error' in v.expect) {
        let caught: unknown;
        try {
          run();
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(TelltaleError);
        expect((caught as TelltaleError).code).toBe(v.expect.error);
      } else {
        const r = run();
        expect(r.action).toBe(v.expect.action);
        expect(r.format).toBe(v.expect.format);
        expect(r.bytes.length).toBe(v.expect.length);
        expect(sha256(r.bytes)).toBe(v.expect.sha256);
        expect(r.bytes).not.toBe(input);
      }
      // The input array is never modified.
      expect(input).toEqual(before);
    });
  }

  for (const v of vectors.read) {
    it(`read ${v.id}`, () => {
      let bytes = materialise(v.input);
      if (v.markOptions) bytes = markImage(bytes, v.markOptions).bytes;
      if ('error' in v.expect) {
        expect(() => readImageMarking(bytes)).toThrow(TelltaleError);
      } else {
        expect({ ...readImageMarking(bytes) }).toEqual(v.expect);
      }
    });
  }
});
