/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VECTOR_ROOT = fileURLToPath(new URL('../../test-vectors/', import.meta.url));

export interface Op {
  readonly op: 'truncate' | 'set' | 'xor' | 'append' | 'insert' | 'remove';
  readonly offset?: number;
  readonly length?: number;
  readonly hex?: string;
}

export type VectorInput = string | { readonly base: string | null; readonly ops: readonly Op[] };

export interface MarkVector {
  readonly id: string;
  readonly input: VectorInput;
  readonly options: Record<string, unknown>;
  readonly expect: { readonly error: string } | { readonly action: string; readonly format: string; readonly length: number; readonly sha256: string };
}

export interface ReadVector {
  readonly id: string;
  readonly input: VectorInput;
  readonly markOptions?: Record<string, unknown>;
  readonly expect: Record<string, unknown>;
}

export interface Vectors {
  readonly version: number;
  readonly mark: readonly MarkVector[];
  readonly read: readonly ReadVector[];
}

export function loadVectors(): Vectors {
  return JSON.parse(readFileSync(VECTOR_ROOT + 'marking.json', 'utf8')) as Vectors;
}

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(VECTOR_ROOT + 'fixtures/' + name));
}

function hex(s: string | undefined): Uint8Array {
  return s === undefined ? new Uint8Array(0) : Uint8Array.from(Buffer.from(s, 'hex'));
}

/** Same semantics as scripts/generate-vectors.mjs and python/tests/vectors.py. */
export function materialise(input: VectorInput): Uint8Array {
  if (typeof input === 'string') return new Uint8Array(readFileSync(VECTOR_ROOT + input));
  let b = input.base === null ? new Uint8Array(0) : new Uint8Array(readFileSync(VECTOR_ROOT + input.base));
  for (const op of input.ops) {
    const h = hex(op.hex);
    const offset = op.offset ?? 0;
    switch (op.op) {
      case 'truncate':
        b = b.slice(0, op.length);
        break;
      case 'set':
        b = b.slice();
        b.set(h, offset);
        break;
      case 'xor':
        b = b.slice();
        h.forEach((m, i) => {
          b[offset + i] = (b[offset + i] ?? 0) ^ m;
        });
        break;
      case 'append':
        b = Uint8Array.from([...b, ...h]);
        break;
      case 'insert':
        b = Uint8Array.from([...b.subarray(0, offset), ...h, ...b.subarray(offset)]);
        break;
      case 'remove':
        b = Uint8Array.from([...b.subarray(0, offset), ...b.subarray(offset + (op.length ?? 0))]);
        break;
    }
  }
  return b;
}

export function sha256(b: Uint8Array): string {
  return createHash('sha256').update(b).digest('hex');
}
