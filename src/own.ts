/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Copies the own enumerable properties of an options object into an object
 * without a prototype. Options are then read only from what the caller
 * passed, never from a polluted `Object.prototype` (for example a stray
 * `Object.prototype.allowC2paInvalidation = true` set by another library).
 */
export function ownProperties(value: object): Record<string, unknown> {
  const out = Object.create(null) as Record<string, unknown>;
  for (const k of Object.keys(value)) out[k] = (value as Record<string, unknown>)[k];
  return out;
}
