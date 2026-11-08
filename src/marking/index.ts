/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Machine-readable marking of generated images (AI Act Article 50(2)) with
 * XMP metadata: `Iptc4xmpExt:DigitalSourceType` set to an IPTC NewsCodes
 * value for generative AI.
 *
 * This is unsigned metadata. Anyone can remove or forge it, and many
 * platforms strip it on upload. It is not a watermark and not a C2PA
 * manifest. On its own it does not meet the multi-layer approach of the
 * Commission's Code of Practice on Transparency of AI-Generated Content
 * (Measure 1.1). See the README.
 *
 * @packageDocumentation
 */

import { TelltaleError } from '../errors.js';
import { ownProperties } from '../own.js';
import { checkInput, DEFAULT_MAX_INPUT_BYTES, decodeUtf8, hasAscii } from './bytes.js';
import { isGenerativeDigitalSourceTypeUri } from './digital-source-type.js';
import { markJpeg, readJpegXmp } from './jpeg.js';
import { resolveMarkOptions, type MarkOptions } from './options.js';
import type { ImageFormat, MarkResult } from './packet.js';
import { markPng, readPngXmp, type ContainerXmp } from './png.js';
import { markWebp, readWebpXmp } from './webp.js';
import { scanXmp } from './xmp.js';

export type { MarkOptions, ExistingXmpPolicy } from './options.js';
export type { ImageFormat, MarkAction, MarkResult } from './packet.js';
export {
  GENERATIVE_DIGITAL_SOURCE_TYPES,
  IPTC_DIGITAL_SOURCE_TYPE_SCHEME,
  IPTC_EXT_NS,
  SCHEMA_ORG_DIGITAL_SOURCE,
  digitalSourceTypeUri,
  isGenerativeDigitalSourceTypeUri,
  type GenerativeDigitalSourceType,
} from './digital-source-type.js';
export { buildXmpPacket, MAX_PROPERTY_LENGTH } from './xmp.js';
export { MAX_JPEG_XMP_PACKET } from './jpeg.js';
export { DEFAULT_MAX_INPUT_BYTES, HARD_MAX_INPUT_BYTES } from './bytes.js';

/** Detects the container from its signature. Returns null if unsupported. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && hasAscii(bytes, 1, 'PNG\r\n\x1a\n')) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP')) return 'webp';
  return null;
}

/**
 * Writes (or merges) an XMP packet that marks the image as AI-generated.
 * Returns a new byte array; the input is never modified. Throws
 * {@link TelltaleError} for malformed or unsupported input.
 *
 * @example
 * ```ts
 * const { bytes } = markImage(png, { digitalSourceType: 'trainedAlgorithmicMedia' });
 * ```
 */
export function markImage(input: Uint8Array, options?: MarkOptions): MarkResult {
  const opts = resolveMarkOptions(options);
  const b = checkInput(input, opts.maxInputBytes);
  switch (detectImageFormat(b)) {
    case 'png':
      return markPng(b, opts);
    case 'jpeg':
      return markJpeg(b, opts);
    case 'webp':
      return markWebp(b, opts);
    case null:
      throw new TelltaleError('UNKNOWN_FORMAT', 'Only PNG, JPEG and WebP are supported.');
  }
}

/** What {@link readImageMarking} found. */
export interface ImageMarking {
  readonly format: ImageFormat;
  /** True when an XMP packet was found. */
  readonly hasXmp: boolean;
  /** Number of XMP packets in the container (more than one is invalid). */
  readonly xmpCount: number;
  /**
   * True when XMP exists but could not be read (compressed, legacy, invalid
   * UTF-8 or unsupported XML), or holds one of the IPTC properties in a form
   * this reader does not understand (for example a structured value).
   */
  readonly xmpUnreadable: boolean;
  /** Distinct `Iptc4xmpExt:DigitalSourceType` values, in document order. */
  readonly digitalSourceTypes: readonly string[];
  /** True when any value is one of the generative AI NewsCodes. */
  readonly generativeAi: boolean;
  readonly aiSystemUsed: readonly string[];
  readonly aiSystemVersionUsed: readonly string[];
  /** True when the container appears to hold a C2PA manifest (not validated). */
  readonly c2paPresent: boolean;
}

/** Options for {@link readImageMarking}. */
export interface ReadOptions {
  /** Maximum input size in bytes. Default 64 MiB. */
  readonly maxInputBytes?: number;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Reads the AI marking from an image. Metadata is informational only: it is
 * easy to strip or forge, so never use it as proof or for access decisions.
 */
export function readImageMarking(input: Uint8Array, options?: ReadOptions): ImageMarking {
  const requested = options === undefined ? undefined : ownProperties(options)['maxInputBytes'];
  const max = resolveMarkOptions({ maxInputBytes: requested ?? DEFAULT_MAX_INPUT_BYTES }).maxInputBytes;
  const b = checkInput(input, max);
  const format = detectImageFormat(b);
  let container: ContainerXmp;
  switch (format) {
    case 'png':
      container = readPngXmp(b);
      break;
    case 'jpeg':
      container = readJpegXmp(b);
      break;
    case 'webp':
      container = readWebpXmp(b);
      break;
    case null:
      throw new TelltaleError('UNKNOWN_FORMAT', 'Only PNG, JPEG and WebP are supported.');
  }
  let unreadable = container.unreadableXmp;
  let dst: string[] = [];
  let sys: string[] = [];
  let ver: string[] = [];
  if (container.packet !== null) {
    try {
      const scan = scanXmp(decodeUtf8(container.packet));
      dst = unique(scan.values.DigitalSourceType);
      sys = unique(scan.values.AISystemUsed);
      ver = unique(scan.values.AISystemVersionUsed);
      if (scan.unreadable.length > 0) unreadable = true;
    } catch (e) {
      if (!(e instanceof TelltaleError)) throw e;
      unreadable = true;
    }
  }
  return {
    format,
    hasXmp: container.xmpCount > 0,
    xmpCount: container.xmpCount,
    xmpUnreadable: unreadable,
    digitalSourceTypes: dst,
    generativeAi: dst.some(isGenerativeDigitalSourceTypeUri),
    aiSystemUsed: sys,
    aiSystemVersionUsed: ver,
    c2paPresent: container.c2paPresent,
  };
}
