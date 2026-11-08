/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { TelltaleError } from '../errors.js';
import { ownProperties } from '../own.js';
import { DEFAULT_MAX_INPUT_BYTES, HARD_MAX_INPUT_BYTES } from './bytes.js';
import { isGenerativeDigitalSourceType, type GenerativeDigitalSourceType } from './digital-source-type.js';
import { validateTextValue, xmpValues, type XmpValues } from './xmp.js';

/** What to do when the file already holds an XMP packet. */
export type ExistingXmpPolicy = 'merge' | 'replace' | 'error';

/** Options for {@link markImage}. */
export interface MarkOptions {
  /** IPTC digital source type. Default: `trainedAlgorithmicMedia`. */
  readonly digitalSourceType?: GenerativeDigitalSourceType;
  /** Name of the AI system or model (IPTC "AI System Used"). Optional, 1-256 characters. */
  readonly aiSystemUsed?: string;
  /** Version of the AI system (IPTC "AI System Version Used"). Optional, 1-256 characters. */
  readonly aiSystemVersionUsed?: string;
  /**
   * Existing XMP handling. Default `merge`: keep the existing packet and add
   * the properties; identical values are left alone, different values throw
   * XMP_CONFLICT. `replace` discards the existing packet. `error` throws XMP_EXISTS.
   */
  readonly existingXmp?: ExistingXmpPolicy;
  /**
   * A file with an embedded C2PA manifest is refused by default, because
   * changing any byte breaks the manifest's hard binding. Set to true only if
   * you will re-sign the file afterwards.
   */
  readonly allowC2paInvalidation?: boolean;
  /** Maximum input size in bytes. Default 64 MiB, at most 1 GiB. */
  readonly maxInputBytes?: number;
}

/** Options after validation and defaults. */
export interface ResolvedMarkOptions {
  readonly values: XmpValues;
  readonly existingXmp: ExistingXmpPolicy;
  readonly allowC2paInvalidation: boolean;
  readonly maxInputBytes: number;
}

const KNOWN_KEYS = new Set([
  'digitalSourceType',
  'aiSystemUsed',
  'aiSystemVersionUsed',
  'existingXmp',
  'allowC2paInvalidation',
  'maxInputBytes',
]);

/** Validates options at the boundary. Unknown keys are rejected. */
export function resolveMarkOptions(options: unknown): ResolvedMarkOptions {
  if (options === undefined) options = {};
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TelltaleError('INVALID_OPTION', 'Options must be an object.');
  }
  const o = ownProperties(options);
  for (const k of Object.keys(o)) {
    if (!KNOWN_KEYS.has(k)) throw new TelltaleError('INVALID_OPTION', `Unknown option "${k.slice(0, 40)}".`);
  }
  const dst = o['digitalSourceType'] ?? 'trainedAlgorithmicMedia';
  if (!isGenerativeDigitalSourceType(dst)) {
    throw new TelltaleError('INVALID_OPTION', 'digitalSourceType must be one of the generative AI codes.');
  }
  const aiSystemUsed = o['aiSystemUsed'] === undefined ? undefined : validateTextValue('aiSystemUsed', o['aiSystemUsed']);
  const aiSystemVersionUsed =
    o['aiSystemVersionUsed'] === undefined ? undefined : validateTextValue('aiSystemVersionUsed', o['aiSystemVersionUsed']);
  const existingXmp = o['existingXmp'] ?? 'merge';
  if (existingXmp !== 'merge' && existingXmp !== 'replace' && existingXmp !== 'error') {
    throw new TelltaleError('INVALID_OPTION', 'existingXmp must be "merge", "replace" or "error".');
  }
  const allow = o['allowC2paInvalidation'] ?? false;
  if (typeof allow !== 'boolean') throw new TelltaleError('INVALID_OPTION', 'allowC2paInvalidation must be a boolean.');
  const max = o['maxInputBytes'] ?? DEFAULT_MAX_INPUT_BYTES;
  if (typeof max !== 'number' || !Number.isSafeInteger(max) || max < 1 || max > HARD_MAX_INPUT_BYTES) {
    throw new TelltaleError('INVALID_OPTION', `maxInputBytes must be an integer from 1 to ${HARD_MAX_INPUT_BYTES}.`);
  }
  return {
    values: xmpValues(dst, aiSystemUsed, aiSystemVersionUsed),
    existingXmp,
    allowC2paInvalidation: allow,
    maxInputBytes: max,
  };
}
