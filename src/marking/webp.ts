/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebP support.
 *
 * Specs:
 * - RFC 9649 "WebP Image Format" (also published as the Google "WebP
 *   Container Specification"): RIFF header, chunk padding, VP8X flags
 *   (ICC 0x20, Alpha 0x10, Exif 0x08, XMP 0x04, Animation 0x02), chunk order,
 *   unknown chunks must be preserved; VP8L header (signature 0x2f, 14-bit
 *   width-1, 14-bit height-1, alpha_is_used, 3-bit version that must be 0).
 * - RFC 6386 section 9.1: VP8 key frame header (frame tag, start code
 *   9d 01 2a, 14-bit width and height).
 * - C2PA Technical Specification 2.2, A.3.6: manifests in a 'C2PA' chunk.
 *
 * Simple (VP8 / VP8L) files are converted to the extended layout because
 * only that layout can carry metadata.
 */

import { TelltaleError } from '../errors.js';
import { ascii, concat, hasAscii, u16le, u32le, writeU24le, writeU32le } from './bytes.js';
import { c2paRefused, decidePacket, type ExistingXmp, type MarkResult } from './packet.js';
import type { ResolvedMarkOptions } from './options.js';
import type { ContainerXmp } from './png.js';

const FLAG_ALPHA = 0x10;
const FLAG_XMP = 0x04;
export const MAX_WEBP_CHUNKS = 100_000;
const MAX_RIFF_SIZE = 0xfffffff6; // 2^32 - 10 (RFC 9649, File Size field).
/** Chunks that form the image and must stay before metadata (RFC 9649 section 2.7). */
const IMAGE_CHUNKS = new Set(['VP8X', 'ICCP', 'ANIM', 'ANMF', 'ALPH', 'VP8 ', 'VP8L', 'EXIF']);

interface RiffChunk {
  readonly fourcc: string;
  readonly start: number;
  readonly dataStart: number;
  readonly size: number;
  /** Offset after the payload and its padding byte. */
  readonly end: number;
}

/** Parses the RIFF structure. */
export function parseWebp(b: Uint8Array): RiffChunk[] {
  if (b.length < 12 || !hasAscii(b, 0, 'RIFF') || !hasAscii(b, 8, 'WEBP')) {
    throw new TelltaleError('UNKNOWN_FORMAT', 'Not a WebP file.');
  }
  const riffSize = u32le(b, 4);
  if (riffSize % 2 !== 0 || riffSize < 4) throw new TelltaleError('MALFORMED', 'Invalid RIFF size.');
  if (riffSize + 8 > b.length) throw new TelltaleError('TRUNCATED', 'WebP is shorter than its RIFF size.');
  if (riffSize + 8 < b.length) throw new TelltaleError('TRAILING_DATA', 'Data after the RIFF chunk.');
  const chunks: RiffChunk[] = [];
  let pos = 12;
  while (pos < b.length) {
    if (chunks.length >= MAX_WEBP_CHUNKS) throw new TelltaleError('MALFORMED', 'Too many WebP chunks.');
    if (pos + 8 > b.length) throw new TelltaleError('TRUNCATED', 'WebP ends inside a chunk header.');
    const size = u32le(b, pos + 4);
    const end = pos + 8 + size + (size % 2);
    if (end > b.length) throw new TelltaleError('TRUNCATED', 'WebP ends inside a chunk.');
    const fourcc = String.fromCharCode(b[pos] ?? 0, b[pos + 1] ?? 0, b[pos + 2] ?? 0, b[pos + 3] ?? 0);
    chunks.push({ fourcc, start: pos, dataStart: pos + 8, size, end });
    pos = end;
  }
  const first = chunks[0];
  if (!first) throw new TelltaleError('MALFORMED', 'WebP has no chunks.');
  if (first.fourcc !== 'VP8 ' && first.fourcc !== 'VP8L' && first.fourcc !== 'VP8X') {
    throw new TelltaleError('MALFORMED', 'WebP must start with VP8, VP8L or VP8X.');
  }
  if (first.fourcc === 'VP8X' && first.size < 10) throw new TelltaleError('MALFORMED', 'VP8X chunk too short.');
  return chunks;
}

interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly alpha: boolean;
}

function vp8Canvas(b: Uint8Array, c: RiffChunk): Canvas {
  const d = c.dataStart;
  if (c.size < 10) throw new TelltaleError('MALFORMED', 'VP8 chunk too short.');
  if (((b[d] ?? 1) & 1) !== 0) throw new TelltaleError('MALFORMED', 'VP8 data does not start with a key frame.');
  if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) throw new TelltaleError('MALFORMED', 'Missing VP8 start code.');
  const width = u16le(b, d + 6) & 0x3fff;
  const height = u16le(b, d + 8) & 0x3fff;
  if (width === 0 || height === 0) throw new TelltaleError('MALFORMED', 'VP8 image has zero size.');
  return { width, height, alpha: false };
}

function vp8lCanvas(b: Uint8Array, c: RiffChunk): Canvas {
  const d = c.dataStart;
  if (c.size < 5) throw new TelltaleError('MALFORMED', 'VP8L chunk too short.');
  if (b[d] !== 0x2f) throw new TelltaleError('MALFORMED', 'Missing VP8L signature.');
  const bits = u32le(b, d + 1);
  if (bits >>> 29 !== 0) throw new TelltaleError('MALFORMED', 'Unsupported VP8L version.');
  return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, alpha: ((bits >>> 28) & 1) === 1 };
}

function vp8xChunk(canvas: Canvas): Uint8Array {
  const out = new Uint8Array(18);
  out.set(ascii('VP8X'), 0);
  writeU32le(out, 4, 10);
  out[8] = FLAG_XMP | (canvas.alpha ? FLAG_ALPHA : 0);
  writeU24le(out, 12, canvas.width - 1);
  writeU24le(out, 15, canvas.height - 1);
  return out;
}

/** Builds an 'XMP ' chunk, padded to an even length. */
export function buildXmpRiffChunk(packet: Uint8Array): Uint8Array {
  const pad = packet.length % 2;
  const out = new Uint8Array(8 + packet.length + pad);
  out.set(ascii('XMP '), 0);
  writeU32le(out, 4, packet.length);
  out.set(packet, 8);
  return out;
}

/** Adds or updates the XMP packet of a WebP file. */
export function markWebp(b: Uint8Array, opts: ResolvedMarkOptions): MarkResult {
  const chunks = parseWebp(b);
  if (!opts.allowC2paInvalidation && chunks.some((c) => c.fourcc === 'C2PA')) throw c2paRefused();
  const xmpIdx: number[] = [];
  chunks.forEach((c, i) => {
    if (c.fourcc === 'XMP ') xmpIdx.push(i);
  });
  if (xmpIdx.length > 1) throw new TelltaleError('DUPLICATE_XMP', 'The WebP has more than one XMP chunk.');
  const foundIdx = xmpIdx[0];
  const found = foundIdx === undefined ? undefined : chunks[foundIdx];
  const existing: ExistingXmp | null = found ? { packet: b.subarray(found.dataStart, found.dataStart + found.size) } : null;
  const decision = decidePacket(existing, opts);
  const first = chunks[0];
  if (!first) throw new TelltaleError('MALFORMED', 'WebP has no chunks.');
  const isExtended = first.fourcc === 'VP8X';
  const flagSet = isExtended && ((b[first.dataStart] ?? 0) & FLAG_XMP) !== 0;
  if (decision.packet === null && flagSet) return { bytes: b.slice(), format: 'webp', action: decision.action };

  const packetChunk = decision.packet === null ? null : buildXmpRiffChunk(decision.packet);
  // Place a new XMP chunk after the last image or Exif chunk, before unknown chunks.
  let insertAfter = 0;
  chunks.forEach((c, i) => {
    if (IMAGE_CHUNKS.has(c.fourcc)) insertAfter = i;
  });
  const parts: Uint8Array[] = [b.subarray(0, 12)];
  chunks.forEach((c, i) => {
    if (i === 0) {
      if (isExtended) {
        const vp8x = b.slice(c.start, c.end);
        vp8x[8] = (vp8x[8] ?? 0) | FLAG_XMP;
        parts.push(vp8x);
      } else {
        parts.push(vp8xChunk(c.fourcc === 'VP8 ' ? vp8Canvas(b, c) : vp8lCanvas(b, c)));
        parts.push(b.subarray(c.start, c.end));
      }
    } else if (i === foundIdx && packetChunk) {
      parts.push(packetChunk);
    } else {
      parts.push(b.subarray(c.start, c.end));
    }
    if (i === insertAfter && foundIdx === undefined && packetChunk) parts.push(packetChunk);
  });
  const out = concat(parts);
  const riffSize = out.length - 8;
  if (riffSize > MAX_RIFF_SIZE) throw new TelltaleError('XMP_TOO_LARGE', 'Result exceeds the RIFF size limit.');
  writeU32le(out, 4, riffSize);
  // An unchanged packet still needed the VP8X XMP flag (or the extended layout); report that as a merge.
  const action = decision.action === 'unchanged' ? 'merged' : decision.action;
  return { bytes: out, format: 'webp', action };
}

/** Finds the XMP packet of a WebP file without modifying it. */
export function readWebpXmp(b: Uint8Array): ContainerXmp {
  const chunks = parseWebp(b);
  const xmp = chunks.filter((c) => c.fourcc === 'XMP ');
  const first = xmp[0];
  return {
    packet: first ? b.subarray(first.dataStart, first.dataStart + first.size) : null,
    xmpCount: xmp.length,
    unreadableXmp: false,
    c2paPresent: chunks.some((c) => c.fourcc === 'C2PA'),
  };
}
