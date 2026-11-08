/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/** Web Crypto helpers. Works in Node 22+ and in browsers (secure contexts). */

import { TelltaleError } from '../errors.js';

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) throw new TelltaleError('INVALID_OPTION', 'Web Crypto is not available (a secure context is required).');
  return c.subtle;
}

const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function toBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += (alphabet[(n >>> 18) & 63] ?? '') + (alphabet[(n >>> 12) & 63] ?? '') + (alphabet[(n >>> 6) & 63] ?? '') + (alphabet[n & 63] ?? '');
  }
  const rest = bytes.length - i;
  if (rest > 0) {
    const n = ((bytes[i] ?? 0) << 16) | (rest === 2 ? (bytes[i + 1] ?? 0) << 8 : 0);
    out += (alphabet[(n >>> 18) & 63] ?? '') + (alphabet[(n >>> 12) & 63] ?? '');
    if (rest === 2) out += alphabet[(n >>> 6) & 63] ?? '';
  }
  return out;
}

/** SHA-256 of a UTF-8 string, as 64 lowercase hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(await subtle().digest('SHA-256', encoder.encode(text)));
}

/** Minimum HMAC key length in bytes. */
export const MIN_KEY_BYTES = 32;

export function checkKey(key: unknown): Uint8Array {
  if (!(key instanceof Uint8Array) || key.length < MIN_KEY_BYTES) {
    throw new TelltaleError('INVALID_OPTION', `HMAC keys must be a Uint8Array of at least ${MIN_KEY_BYTES} bytes.`);
  }
  return key;
}

/** HMAC-SHA-256 of a UTF-8 string, as raw bytes. */
export async function hmacSha256(key: Uint8Array, text: string): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', checkKey(key).slice(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, encoder.encode(text)));
}

/** Random bytes from the platform CSPRNG. */
export function randomBytes(n: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c) throw new TelltaleError('INVALID_OPTION', 'Web Crypto is not available.');
  return c.getRandomValues(new Uint8Array(n));
}
