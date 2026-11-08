/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JPEG support.
 *
 * Specs:
 * - ITU-T T.81 | ISO/IEC 10918-1, Annex B: marker segments, fill bytes,
 *   length field includes itself.
 * - Adobe XMP Specification Part 3 (2020), section 1.1.3: XMP in an APP1
 *   segment with the namespace "http://ns.adobe.com/xap/1.0/\0" (29 bytes);
 *   the packet can be at most 65502 bytes; XMP APP1 must come before the
 *   first SOF marker; recommended order Exif APP1, XMP APP1, then others.
 *   ExtendedXMP segments use "http://ns.adobe.com/xmp/extension/\0".
 * - C2PA Technical Specification 2.2, A.3.1: manifests live in APP11 (JPEG XT
 *   boxes) with a JUMBF superbox labelled "c2pa".
 * - CIPA DC-007 (Multi-Picture Format): APP2 "MPF\0"; offsets inside it are
 *   relative to the MPF header, so bytes must not be added or removed
 *   between that header and the end of the first image.
 *
 * Only the header segments before Start of Scan (SOS) are parsed. Everything
 * from SOS on is copied unchanged.
 */

import { TelltaleError } from '../errors.js';
import { ascii, concat, hasAscii, indexOfAscii, u16be, writeU16be } from './bytes.js';
import { c2paRefused, decidePacket, type ExistingXmp, type MarkResult } from './packet.js';
import type { ResolvedMarkOptions } from './options.js';
import type { ContainerXmp } from './png.js';

export const XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/\0';
export const EXTENDED_XMP_NAMESPACE = 'http://ns.adobe.com/xmp/extension/\0';
/** Largest XMP packet in one APP1 segment (XMP Specification Part 3, 1.1.3.1). */
export const MAX_JPEG_XMP_PACKET = 65502;
const MAX_SEGMENTS = 65536;

interface Segment {
  readonly marker: number;
  /** Offset of the first 0xFF (including fill bytes). */
  readonly start: number;
  /** Offset of the payload after the length field (equals end for standalone markers). */
  readonly dataStart: number;
  readonly end: number;
}

function isSof(m: number): boolean {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
}

/** Parses header segments up to and including SOS. */
export function parseJpegHeader(b: Uint8Array): Segment[] {
  if (b.length < 3 || b[0] !== 0xff || b[1] !== 0xd8) throw new TelltaleError('UNKNOWN_FORMAT', 'Not a JPEG file.');
  const segments: Segment[] = [];
  let pos = 2;
  let sawSof = false;
  for (;;) {
    if (segments.length >= MAX_SEGMENTS) throw new TelltaleError('MALFORMED', 'Too many JPEG segments.');
    const start = pos;
    if (pos >= b.length) throw new TelltaleError('TRUNCATED', 'JPEG ends before the image data.');
    if (b[pos] !== 0xff) throw new TelltaleError('MALFORMED', 'Expected a JPEG marker.');
    while (pos + 1 < b.length && b[pos + 1] === 0xff) pos++;
    if (pos + 1 >= b.length) throw new TelltaleError('TRUNCATED', 'JPEG ends inside a marker.');
    const marker = b[pos + 1] ?? 0;
    if (marker === 0x00 || marker === 0xd8) throw new TelltaleError('MALFORMED', 'Unexpected JPEG marker.');
    if (marker === 0xd9) throw new TelltaleError('MALFORMED', 'JPEG ends before the image data.');
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      segments.push({ marker, start, dataStart: pos + 2, end: pos + 2 });
      pos += 2;
      continue;
    }
    if (pos + 4 > b.length) throw new TelltaleError('TRUNCATED', 'JPEG ends inside a segment header.');
    const len = u16be(b, pos + 2);
    if (len < 2) throw new TelltaleError('MALFORMED', 'Invalid JPEG segment length.');
    const end = pos + 2 + len;
    if (end > b.length) throw new TelltaleError('TRUNCATED', 'JPEG ends inside a segment.');
    segments.push({ marker, start, dataStart: pos + 4, end });
    if (isSof(marker)) sawSof = true;
    if (marker === 0xda) {
      if (!sawSof) throw new TelltaleError('MALFORMED', 'JPEG has no frame header before the scan.');
      return segments;
    }
    pos = end;
  }
}

function isApp1With(b: Uint8Array, s: Segment, ns: string): boolean {
  return s.marker === 0xe1 && s.end - s.dataStart >= ns.length && hasAscii(b, s.dataStart, ns);
}

function isExif(b: Uint8Array, s: Segment): boolean {
  return isApp1With(b, s, 'Exif\0\0');
}

function isMpf(b: Uint8Array, s: Segment): boolean {
  return s.marker === 0xe2 && hasAscii(b, s.dataStart, 'MPF\0');
}

/** Heuristic C2PA detection: JPEG XT box ("JP") whose JUMBF description carries "c2pa". */
function isC2pa(b: Uint8Array, s: Segment): boolean {
  if (s.marker !== 0xeb || !hasAscii(b, s.dataStart, 'JP')) return false;
  return indexOfAscii(b, 'c2pa', s.dataStart, Math.min(s.end, s.dataStart + 64)) >= 0;
}

/** Builds an APP1 XMP segment. Throws XMP_TOO_LARGE above 65502 packet bytes. */
export function buildXmpSegment(packet: Uint8Array): Uint8Array {
  if (packet.length > MAX_JPEG_XMP_PACKET) {
    throw new TelltaleError('XMP_TOO_LARGE', `XMP packet exceeds ${MAX_JPEG_XMP_PACKET} bytes; ExtendedXMP is not written.`);
  }
  const ns = ascii(XMP_NAMESPACE);
  const seg = new Uint8Array(4 + ns.length + packet.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  writeU16be(seg, 2, 2 + ns.length + packet.length);
  seg.set(ns, 4);
  seg.set(packet, 4 + ns.length);
  return seg;
}

/** Adds or updates the XMP packet of a JPEG file. */
export function markJpeg(b: Uint8Array, opts: ResolvedMarkOptions): MarkResult {
  const segs = parseJpegHeader(b);
  if (!opts.allowC2paInvalidation && segs.some((s) => isC2pa(b, s))) throw c2paRefused();
  const xmpIdx: number[] = [];
  segs.forEach((s, i) => {
    if (isApp1With(b, s, XMP_NAMESPACE)) xmpIdx.push(i);
  });
  if (xmpIdx.length > 1) throw new TelltaleError('DUPLICATE_XMP', 'The JPEG has more than one standard XMP segment.');
  const foundIdx = xmpIdx[0];
  const found = foundIdx === undefined ? undefined : segs[foundIdx];
  const existing: ExistingXmp | null = found ? { packet: b.subarray(found.dataStart + XMP_NAMESPACE.length, found.end) } : null;
  const decision = decidePacket(existing, opts);
  if (decision.packet === null) return { bytes: b.slice(), format: 'jpeg', action: decision.action };
  const newSeg = buildXmpSegment(decision.packet);

  // Indices of segments that will be removed or replaced, and where to insert.
  const touched = new Set<number>();
  let insertAt: number;
  if (foundIdx !== undefined) {
    touched.add(foundIdx);
    insertAt = foundIdx;
    if (decision.action === 'replaced') {
      // The new packet has no xmpNote:HasExtendedXMP, so old ExtendedXMP segments would be orphans.
      segs.forEach((s, i) => {
        if (isApp1With(b, s, EXTENDED_XMP_NAMESPACE)) touched.add(i);
      });
    }
  } else {
    insertAt = 0;
    while (insertAt < segs.length) {
      const s = segs[insertAt];
      if (s === undefined || !(s.marker === 0xe0 || isExif(b, s))) break;
      insertAt++;
    }
  }
  const mpfIdx = segs.findIndex((s) => isMpf(b, s));
  if (mpfIdx >= 0 && (insertAt > mpfIdx || [...touched].some((i) => i > mpfIdx))) {
    throw new TelltaleError('UNSUPPORTED_LAYOUT', 'Changing this JPEG would shift Multi-Picture Format offsets.');
  }

  const parts: Uint8Array[] = [b.subarray(0, 2)];
  segs.forEach((s, i) => {
    if (i === insertAt) parts.push(newSeg);
    if (!touched.has(i)) parts.push(b.subarray(s.start, s.end));
  });
  const last = segs[segs.length - 1];
  parts.push(b.subarray(last ? last.end : 2));
  return { bytes: concat(parts), format: 'jpeg', action: decision.action };
}

/** Finds the standard XMP packet of a JPEG file without modifying it. */
export function readJpegXmp(b: Uint8Array): ContainerXmp {
  const segs = parseJpegHeader(b);
  const xmp = segs.filter((s) => isApp1With(b, s, XMP_NAMESPACE));
  const first = xmp[0];
  return {
    packet: first ? b.subarray(first.dataStart + XMP_NAMESPACE.length, first.end) : null,
    xmpCount: xmp.length,
    unreadableXmp: false,
    c2paPresent: segs.some((s) => isC2pa(b, s)),
  };
}
