/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PNG support.
 *
 * Specs:
 * - W3C Portable Network Graphics (PNG) Specification (Third Edition),
 *   https://www.w3.org/TR/png-3/ : chunk layout (5.3), CRC (5.5), iTXt (11.3.3.4),
 *   keyword "XML:com.adobe.xmp" (11.3.3.1).
 * - Adobe XMP Specification Part 3 (2020), section 1.1.5: XMP in an
 *   uncompressed iTXt chunk with empty language tag and translated keyword;
 *   no more than one XMP chunk per file.
 * - C2PA Technical Specification 2.2, A.3.2: manifests live in a 'caBX' chunk.
 */

import { TelltaleError } from '../errors.js';
import { ascii, concat, hasAscii, u32be, writeU32be } from './bytes.js';
import { crc32 } from './crc32.js';
import { c2paRefused, decidePacket, type ExistingXmp, type MarkResult } from './packet.js';
import type { ResolvedMarkOptions } from './options.js';

export const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const XMP_KEYWORD = 'XML:com.adobe.xmp';
const MAX_CHUNK_LENGTH = 0x7fffffff;
/** Real files have a few thousand chunks at most; the cap bounds memory for crafted files. */
export const MAX_PNG_CHUNKS = 100_000;

interface PngChunk {
  readonly type: string;
  /** Offset of the length field. */
  readonly start: number;
  readonly dataStart: number;
  readonly dataLength: number;
  /** Offset just after the CRC. */
  readonly end: number;
}

function isChunkTypeByte(c: number): boolean {
  return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
}

/** Parses and validates the chunk structure, including every CRC. */
export function parsePng(b: Uint8Array): PngChunk[] {
  if (b.length < 8 || !PNG_SIGNATURE.every((v, i) => b[i] === v)) {
    throw new TelltaleError('UNKNOWN_FORMAT', 'Not a PNG file.');
  }
  const chunks: PngChunk[] = [];
  let pos = 8;
  for (;;) {
    if (chunks.length >= MAX_PNG_CHUNKS) throw new TelltaleError('MALFORMED', 'Too many PNG chunks.');
    if (pos + 12 > b.length) throw new TelltaleError('TRUNCATED', 'PNG ends inside a chunk header.');
    const len = u32be(b, pos);
    if (len > MAX_CHUNK_LENGTH) throw new TelltaleError('MALFORMED', 'PNG chunk length exceeds 2^31-1.');
    const dataStart = pos + 8;
    const end = dataStart + len + 4;
    if (end > b.length) throw new TelltaleError('TRUNCATED', 'PNG ends inside a chunk.');
    for (let i = 4; i < 8; i++) {
      if (!isChunkTypeByte(b[pos + i] ?? 0)) throw new TelltaleError('MALFORMED', 'Invalid PNG chunk type.');
    }
    const type = String.fromCharCode(b[pos + 4] ?? 0, b[pos + 5] ?? 0, b[pos + 6] ?? 0, b[pos + 7] ?? 0);
    if (crc32(b, pos + 4, dataStart + len) !== u32be(b, dataStart + len)) {
      throw new TelltaleError('BAD_CRC', 'PNG chunk CRC does not match.');
    }
    if (chunks.length === 0 && (type !== 'IHDR' || len !== 13)) {
      throw new TelltaleError('MALFORMED', 'PNG must start with a 13-byte IHDR chunk.');
    }
    chunks.push({ type, start: pos, dataStart, dataLength: len, end });
    pos = end;
    if (type === 'IEND') {
      if (len !== 0) throw new TelltaleError('MALFORMED', 'IEND must be empty.');
      if (pos !== b.length) throw new TelltaleError('TRAILING_DATA', 'Data after IEND.');
      return chunks;
    }
  }
}

interface XmpChunkInfo {
  readonly index: number;
  /** Packet bytes for an uncompressed iTXt XMP chunk, else null. */
  readonly packet: Uint8Array | null;
}

/** Returns the keyword of a tEXt / zTXt / iTXt chunk if it is the XMP keyword. */
function isXmpTextChunk(b: Uint8Array, c: PngChunk): boolean {
  if (c.type !== 'iTXt' && c.type !== 'tEXt' && c.type !== 'zTXt') return false;
  return c.dataLength > XMP_KEYWORD.length && hasAscii(b, c.dataStart, XMP_KEYWORD) && b[c.dataStart + XMP_KEYWORD.length] === 0;
}

function xmpChunkInfo(b: Uint8Array, c: PngChunk, index: number): XmpChunkInfo {
  if (c.type !== 'iTXt') return { index, packet: null };
  const dataEnd = c.dataStart + c.dataLength;
  let p = c.dataStart + XMP_KEYWORD.length + 1;
  if (p + 2 > dataEnd) throw new TelltaleError('MALFORMED', 'Truncated iTXt chunk.');
  const compressed = b[p];
  if (compressed !== 0 && compressed !== 1) throw new TelltaleError('MALFORMED', 'Invalid iTXt compression flag.');
  p += 2;
  // Language tag and translated keyword, each null-terminated.
  for (let field = 0; field < 2; field++) {
    // Search only inside this chunk so a crafted file cannot cause quadratic scans.
    const z = b.subarray(p, dataEnd).indexOf(0);
    if (z < 0) throw new TelltaleError('MALFORMED', 'Truncated iTXt chunk.');
    p += z + 1;
  }
  if (compressed === 1) return { index, packet: null };
  return { index, packet: b.subarray(p, dataEnd) };
}

function findXmp(b: Uint8Array, chunks: readonly PngChunk[]): XmpChunkInfo[] {
  const out: XmpChunkInfo[] = [];
  chunks.forEach((c, i) => {
    if (isXmpTextChunk(b, c)) out.push(xmpChunkInfo(b, c, i));
  });
  return out;
}

/** Builds an uncompressed iTXt chunk holding the packet. */
export function buildXmpChunk(packet: Uint8Array): Uint8Array {
  const header = ascii(`${XMP_KEYWORD}\0\0\0\0\0`);
  const dataLength = header.length + packet.length;
  if (dataLength > MAX_CHUNK_LENGTH) throw new TelltaleError('XMP_TOO_LARGE', 'XMP packet too large for a PNG chunk.');
  const chunk = new Uint8Array(12 + dataLength);
  writeU32be(chunk, 0, dataLength);
  chunk.set(ascii('iTXt'), 4);
  chunk.set(header, 8);
  chunk.set(packet, 8 + header.length);
  writeU32be(chunk, 8 + dataLength, crc32(chunk, 4, 8 + dataLength));
  return chunk;
}

/** Adds or updates the XMP packet of a PNG file. */
export function markPng(b: Uint8Array, opts: ResolvedMarkOptions): MarkResult {
  const chunks = parsePng(b);
  if (!opts.allowC2paInvalidation && chunks.some((c) => c.type === 'caBX')) throw c2paRefused();
  const xmp = findXmp(b, chunks);
  if (xmp.length > 1) throw new TelltaleError('DUPLICATE_XMP', 'The PNG has more than one XMP chunk.');
  const found = xmp[0];
  const existing: ExistingXmp | null = found ? { packet: found.packet } : null;
  const decision = decidePacket(existing, opts);
  if (decision.packet === null) return { bytes: b.slice(), format: 'png', action: decision.action };
  const newChunk = buildXmpChunk(decision.packet);
  const ihdr = chunks[0];
  if (!ihdr) throw new TelltaleError('MALFORMED', 'Missing IHDR.');
  let parts: Uint8Array[];
  if (found === undefined) {
    parts = [b.subarray(0, ihdr.end), newChunk, b.subarray(ihdr.end)];
  } else {
    const old = chunks[found.index];
    if (!old) throw new TelltaleError('MALFORMED', 'Internal chunk index error.');
    if (old.type === 'iTXt') {
      parts = [b.subarray(0, old.start), newChunk, b.subarray(old.end)];
    } else {
      // Legacy tEXt / zTXt XMP: remove it, put the new iTXt after IHDR.
      parts = [b.subarray(0, ihdr.end), newChunk, b.subarray(ihdr.end, old.start), b.subarray(old.end)];
    }
  }
  return { bytes: concat(parts), format: 'png', action: decision.action };
}

/** Low-level read result for a PNG. */
export interface ContainerXmp {
  readonly packet: Uint8Array | null;
  readonly xmpCount: number;
  readonly unreadableXmp: boolean;
  readonly c2paPresent: boolean;
}

/** Finds the XMP packet of a PNG file without modifying it. */
export function readPngXmp(b: Uint8Array): ContainerXmp {
  const chunks = parsePng(b);
  const xmp = findXmp(b, chunks);
  const first = xmp[0];
  return {
    packet: first?.packet ?? null,
    xmpCount: xmp.length,
    unreadableXmp: first?.packet === null,
    c2paPresent: chunks.some((c) => c.type === 'caBX'),
  };
}
