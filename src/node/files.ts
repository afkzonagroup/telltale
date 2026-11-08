/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/** File helpers with size limits, symlink checks and atomic replace. */

import { constants } from 'node:fs';
import { link, lstat, open, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { TelltaleError } from '../errors.js';

/** `O_NOFOLLOW` where the platform has it (not on Windows). */
export const O_NOFOLLOW: number = (constants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;

/**
 * Reads a regular file, refusing anything larger than `maxBytes`. Symlinks are
 * followed for reading (the user named the file); the target must be a regular file.
 */
export async function readRegularFile(path: string, maxBytes: number): Promise<Uint8Array> {
  const fh = await open(path, constants.O_RDONLY);
  try {
    const st = await fh.stat();
    if (!st.isFile()) throw new TelltaleError('INVALID_OPTION', 'Not a regular file.');
    if (st.size > maxBytes) throw new TelltaleError('INPUT_TOO_LARGE', `File is larger than ${maxBytes} bytes.`);
    const buf = new Uint8Array(st.size);
    let off = 0;
    while (off < buf.length) {
      const { bytesRead } = await fh.read(buf, off, buf.length - off, off);
      if (bytesRead === 0) break;
      off += bytesRead;
    }
    if (off !== st.size) throw new TelltaleError('TRUNCATED', 'File changed while reading.');
    return buf;
  } finally {
    await fh.close();
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}

/**
 * Writes bytes to `path` atomically: a new temporary file in the same
 * directory (created exclusively, never following symlinks), then a rename.
 * Refuses to replace an existing file unless `overwrite` is true, and never
 * writes through a symlink at `path`. Without `overwrite`, the file is put
 * in place with a hard link, which fails if `path` appeared in the meantime;
 * on file systems without hard links it falls back to a checked rename.
 */
export async function writeFileAtomic(path: string, bytes: Uint8Array, overwrite: boolean, mode = 0o644): Promise<void> {
  if (await exists(path)) {
    const st = await lstat(path);
    if (st.isSymbolicLink()) throw new TelltaleError('INVALID_OPTION', 'Refusing to write through a symbolic link.');
    if (!st.isFile()) throw new TelltaleError('INVALID_OPTION', 'Output exists and is not a regular file.');
    if (!overwrite) throw outputExists();
  }
  const tmp = join(dirname(path), `.${basename(path).slice(0, 100)}.telltale-${randomBytes(8).toString('hex')}.tmp`);
  const fh = await open(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW, mode);
  try {
    await fh.writeFile(bytes);
    await fh.sync();
  } catch (e) {
    await fh.close();
    await unlink(tmp).catch(() => undefined);
    throw e;
  }
  await fh.close();
  try {
    if (overwrite || !(await placeExclusive(tmp, path))) {
      if (!overwrite && (await exists(path))) throw outputExists();
      await rename(tmp, path);
    }
  } catch (e) {
    await unlink(tmp).catch(() => undefined);
    throw e;
  }
}

function outputExists(): TelltaleError {
  return new TelltaleError('INVALID_OPTION', 'Output exists (use --force to replace it).');
}

/** Error codes of file systems that do not support hard links. */
const NO_HARD_LINKS = new Set(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV']);

/**
 * Links `tmp` to `path` (fails atomically if `path` exists) and removes `tmp`.
 * Returns false when the file system has no hard links. Exported for tests.
 */
export async function placeExclusive(tmp: string, path: string): Promise<boolean> {
  try {
    await link(tmp, path);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw outputExists();
    if (code !== undefined && NO_HARD_LINKS.has(code)) return false;
    throw e;
  }
  await unlink(tmp);
  return true;
}
