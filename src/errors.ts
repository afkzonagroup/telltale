/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Stable error codes. The Python package uses the same codes, and the shared
 * test vectors refer to them.
 */
export type TelltaleErrorCode =
  | 'INVALID_OPTION'
  | 'INPUT_TOO_LARGE'
  | 'UNKNOWN_FORMAT'
  | 'TRUNCATED'
  | 'MALFORMED'
  | 'BAD_CRC'
  | 'TRAILING_DATA'
  | 'DUPLICATE_XMP'
  | 'XMP_EXISTS'
  | 'XMP_CONFLICT'
  | 'XMP_UNSUPPORTED'
  | 'XMP_TOO_LARGE'
  | 'C2PA_PRESENT'
  | 'UNSUPPORTED_LAYOUT'
  | 'LOG_INVALID'
  | 'LOG_TAMPERED';

/**
 * The only error type thrown on bad input. `code` is stable; `message` is
 * human readable and never contains input bytes.
 */
export class TelltaleError extends Error {
  readonly code: TelltaleErrorCode;

  constructor(code: TelltaleErrorCode, message: string) {
    super(message);
    this.name = 'TelltaleError';
    this.code = code;
  }
}

/** Type guard for {@link TelltaleError}. */
export function isTelltaleError(value: unknown): value is TelltaleError {
  return value instanceof TelltaleError;
}
