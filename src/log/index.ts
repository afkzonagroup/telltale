/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hash-chained disclosure log: evidence that a disclosure was shown.
 *
 * @packageDocumentation
 */

export {
  canonicalJson,
  deriveSessionPseudonym,
  DISCLOSURE_EVENTS,
  DisclosureLog,
  GENESIS_HASH,
  LOG_VERSION,
  MAX_LINE_LENGTH,
  randomSessionPseudonym,
  serializeEntry,
  sha256Hex,
  verifyDisclosureLog,
  type DisclosureEvent,
  type DisclosureLogEntry,
  type DisclosureLogInput,
  type DisclosureLogOptions,
  type HashAlgorithm,
  type LogHead,
  type VerifyOptions,
  type VerifyResult,
} from './chain.js';
