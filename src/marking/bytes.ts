/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { TelltaleError } from '../errors.js';

/** Reads a big-endian unsigned 32-bit integer. Caller guarantees bounds. */
export function u32be(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) * 0x1000000) + (((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0));
}

/** Reads a little-endian unsigned 32-bit integer. Caller guarantees bounds. */
export function u32le(b: Uint8Array, o: number): number {
  return ((b[o + 3] ?? 0) * 0x1000000) + (((b[o + 2] ?? 0) << 16) | ((b[o + 1] ?? 0) << 8) | (b[o] ?? 0));
}

/** Reads a big-endian unsigned 16-bit integer. Caller guarantees bounds. */
export function u16be(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}

/** Reads a little-endian unsigned 16-bit integer. Caller guarantees bounds. */
export function u16le(b: Uint8Array, o: number): number {
  return ((b[o + 1] ?? 0) << 8) | (b[o] ?? 0);
}

export function writeU32be(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

export function writeU32le(b: Uint8Array, o: number, v: number): void {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

export function writeU16be(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 8) & 0xff;
  b[o + 1] = v & 0xff;
}

export function writeU24le(b: Uint8Array, o: number, v: number): void {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
}

/** Concatenates byte arrays into a new array. */
export function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** ASCII bytes for a string that is known to be ASCII. */
export function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f;
  return out;
}

/** True when `b` contains the ASCII string `s` at offset `o`. */
export function hasAscii(b: Uint8Array, o: number, s: string): boolean {
  if (o < 0 || o + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) {
    if (b[o + i] !== s.charCodeAt(i)) return false;
  }
  return true;
}

/** Index of the ASCII string `s` within `b[from, to)`, or -1. */
export function indexOfAscii(b: Uint8Array, s: string, from: number, to: number): number {
  const end = Math.min(to, b.length) - s.length;
  for (let i = Math.max(0, from); i <= end; i++) {
    if (hasAscii(b, i, s)) return i;
  }
  return -1;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function utf8(s: string): Uint8Array {
  return utf8Encoder.encode(s);
}

/** Largest XMP packet in bytes that is decoded: 3 bytes per UTF-16 unit of the scan limit (4 Mi). */
export const MAX_XMP_PACKET_BYTES = 3 * 4 * 1024 * 1024;

/** Strict UTF-8 decoding of an XMP packet. Throws {@link TelltaleError} on invalid or oversized input. */
export function decodeUtf8(b: Uint8Array): string {
  if (b.length > MAX_XMP_PACKET_BYTES) throw new TelltaleError('XMP_TOO_LARGE', 'XMP packet is too large to scan.');
  try {
    return utf8Decoder.decode(b);
  } catch {
    throw new TelltaleError('XMP_UNSUPPORTED', 'XMP packet is not valid UTF-8.');
  }
}

/** Default and maximum accepted input sizes. */
export const DEFAULT_MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const HARD_MAX_INPUT_BYTES = 1024 * 1024 * 1024;

/** Validates the input is a Uint8Array within the size limit. */
export function checkInput(input: unknown, maxBytes: number): Uint8Array {
  if (!(input instanceof Uint8Array)) {
    throw new TelltaleError('INVALID_OPTION', 'Input must be a Uint8Array.');
  }
  if (input.length > maxBytes) {
    throw new TelltaleError('INPUT_TOO_LARGE', `Input is larger than the limit of ${maxBytes} bytes.`);
  }
  return input;
}
