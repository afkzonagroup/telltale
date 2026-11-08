/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { TelltaleError } from '../errors.js';
import { decodeUtf8, utf8 } from './bytes.js';
import type { ResolvedMarkOptions } from './options.js';
import { buildXmpPacket, mergeIntoPacket } from './xmp.js';

/** Supported containers. */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/** What happened to the XMP packet. */
export type MarkAction = 'inserted' | 'merged' | 'replaced' | 'unchanged';

/** Result of {@link markImage}. */
export interface MarkResult {
  /** The marked file. A new array; the input is never modified. */
  readonly bytes: Uint8Array;
  readonly format: ImageFormat;
  readonly action: MarkAction;
}

/** Existing XMP as found in a container. */
export interface ExistingXmp {
  /** Packet bytes, or null when they cannot be used (for example compressed). */
  readonly packet: Uint8Array | null;
}

/** The packet to write, or null when nothing changes. */
export interface PacketDecision {
  readonly packet: Uint8Array | null;
  readonly action: MarkAction;
}

/**
 * Applies the existing-XMP policy. `existing` is null when the file has no XMP.
 */
export function decidePacket(existing: ExistingXmp | null, opts: ResolvedMarkOptions): PacketDecision {
  if (existing === null) return { packet: utf8(buildXmpPacket(opts.values)), action: 'inserted' };
  if (opts.existingXmp === 'error') throw new TelltaleError('XMP_EXISTS', 'The file already has an XMP packet.');
  if (opts.existingXmp === 'replace') return { packet: utf8(buildXmpPacket(opts.values)), action: 'replaced' };
  if (existing.packet === null) {
    throw new TelltaleError('XMP_UNSUPPORTED', 'The existing XMP packet cannot be merged (compressed or legacy chunk). Use existingXmp "replace".');
  }
  const merged = mergeIntoPacket(decodeUtf8(existing.packet), opts.values);
  if (!merged.changed) return { packet: null, action: 'unchanged' };
  return { packet: utf8(merged.xml), action: 'merged' };
}

export function c2paRefused(): TelltaleError {
  return new TelltaleError(
    'C2PA_PRESENT',
    'The file has a C2PA manifest. Adding XMP would invalidate it. Set allowC2paInvalidation only if you re-sign the file.',
  );
}
