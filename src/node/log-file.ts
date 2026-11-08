/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { constants, type Stats } from 'node:fs';
import { lstat, open, stat, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { TelltaleError } from '../errors.js';
import { ownProperties } from '../own.js';
import {
  DisclosureLog,
  verifyDisclosureLog,
  type DisclosureLogEntry,
  type DisclosureLogInput,
  type LogHead,
} from '../log/index.js';
import { O_NOFOLLOW } from './files.js';

/** File names allowed for logs: no separators, no leading dot. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface OpenLogFileOptions {
  /** Directory that holds the log. Must exist. */
  readonly dir: string;
  /** File name only, e.g. `disclosures.jsonl`. */
  readonly name: string;
  /** HMAC key (at least 32 bytes) for keyed chains. Keep it outside the log directory. */
  readonly hmacKey?: Uint8Array;
  /** Head stored elsewhere; opening fails if the file does not end there. */
  readonly expectedHead?: LogHead;
  /** Largest file that will be read for verification (default 256 MiB). */
  readonly maxBytes?: number;
  /** Call fdatasync after every entry (slower, survives power loss). */
  readonly sync?: boolean;
  /**
   * What to do when an existing log file is writable by its group or by others, so another account
   * could rewrite it: `refuse` (default) fails to open, `fix` restricts it to 0600, `allow` keeps it.
   * Ignored on Windows, which has no POSIX mode bits.
   */
  readonly permissions?: 'refuse' | 'fix' | 'allow';
}

/** Group- or world-writable mode bits. */
const SHARED_WRITE = 0o022;
const PERMISSION_POLICIES: ReadonlySet<string> = new Set(['refuse', 'fix', 'allow']);

/**
 * Append-only writer for a disclosure log file. One writer per file:
 * there is no cross-process locking. The existing file is verified on open.
 * New files are created with mode 0600; an existing file that its group or others
 * can write is refused unless `permissions` says otherwise.
 */
export class DisclosureLogFile {
  readonly #fh: FileHandle;
  readonly #log: DisclosureLog;
  readonly #sync: boolean;
  #queue: Promise<unknown> = Promise.resolve();
  #broken = false;
  #closed = false;

  private constructor(fh: FileHandle, log: DisclosureLog, sync: boolean) {
    this.#fh = fh;
    this.#log = log;
    this.#sync = sync;
  }

  /** Opens (or creates) a log file after checking the whole chain. */
  static async open(options: OpenLogFileOptions): Promise<DisclosureLogFile> {
    const own = ownProperties(options) as Partial<OpenLogFileOptions>;
    const { dir, name, hmacKey, expectedHead, sync = false, permissions = 'refuse' } = own;
    if (!PERMISSION_POLICIES.has(permissions)) {
      throw new TelltaleError('INVALID_OPTION', 'permissions must be "refuse", "fix" or "allow".');
    }
    const maxBytes = own.maxBytes ?? 256 * 1024 * 1024;
    if (typeof dir !== 'string') throw new TelltaleError('INVALID_OPTION', 'dir must be a string.');
    if (typeof name !== 'string' || !SAFE_NAME.test(name)) throw new TelltaleError('INVALID_OPTION', 'Unsafe log file name.');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TelltaleError('INVALID_OPTION', 'Invalid maxBytes.');
    const root = resolve(dir);
    if (!(await stat(root)).isDirectory()) throw new TelltaleError('INVALID_OPTION', 'Log directory does not exist.');
    const path = join(root, name);

    let existing: Stats | null = null;
    try {
      existing = await lstat(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    if (existing && (existing.isSymbolicLink() || !existing.isFile())) {
      throw new TelltaleError('INVALID_OPTION', 'Log path is not a regular file.');
    }

    const fh = await open(path, constants.O_RDWR | constants.O_APPEND | constants.O_CREAT | O_NOFOLLOW, 0o600);
    try {
      const st = await fh.stat();
      if (!st.isFile()) throw new TelltaleError('INVALID_OPTION', 'Log path is not a regular file.');
      if (st.size > maxBytes) throw new TelltaleError('INPUT_TOO_LARGE', 'Log file is larger than maxBytes; rotate it.');
      if (process.platform !== 'win32' && (st.mode & SHARED_WRITE) !== 0) {
        if (permissions === 'refuse') {
          throw new TelltaleError('INVALID_OPTION', 'Log file is writable by its group or by others; restrict it to 0600 or open it with permissions: "fix".');
        }
        if (permissions === 'fix') await fh.chmod(0o600);
      }
      const buf = new Uint8Array(st.size);
      let off = 0;
      while (off < buf.length) {
        const { bytesRead } = await fh.read(buf, off, buf.length - off, off);
        if (bytesRead === 0) break;
        off += bytesRead;
      }
      if (off !== st.size) throw new TelltaleError('LOG_INVALID', 'Log file changed while reading.');
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      } catch {
        throw new TelltaleError('LOG_INVALID', 'Log file is not valid UTF-8.');
      }
      if (text.length > 0 && !text.endsWith('\n')) throw new TelltaleError('LOG_INVALID', 'Last line is incomplete.');
      const result = await verifyDisclosureLog(text, {
        ...(hmacKey === undefined ? {} : { hmacKey }),
        ...(expectedHead === undefined ? {} : { expectedHead }),
      });
      if (!result.ok) throw new TelltaleError(result.code, `Line ${result.line}: ${result.reason}`);
      const log = new DisclosureLog({
        ...(result.head === null ? {} : { head: result.head }),
        ...(hmacKey === undefined ? {} : { hmacKey }),
      });
      return new DisclosureLogFile(fh, log, sync);
    } catch (e) {
      await fh.close();
      throw e;
    }
  }

  /** Position of the newest entry. Store it elsewhere to detect truncation later. */
  get head(): LogHead | null {
    return this.#log.head;
  }

  /** Appends one entry and writes it as one line. */
  append(input: DisclosureLogInput): Promise<DisclosureLogEntry> {
    const run = this.#queue.then(async () => {
      if (this.#closed) throw new TelltaleError('INVALID_OPTION', 'Log file is closed.');
      if (this.#broken) throw new TelltaleError('LOG_INVALID', 'A previous write failed; reopen the log to verify it.');
      const { entry, line } = await this.#log.append(input);
      try {
        await this.#fh.write(`${line}\n`);
        if (this.#sync) await this.#fh.datasync();
      } catch (e) {
        this.#broken = true;
        throw e;
      }
      return entry;
    });
    this.#queue = run.catch(() => undefined);
    return run;
  }

  /** Waits for pending appends and closes the file. */
  async close(): Promise<void> {
    await this.#queue;
    if (this.#closed) return;
    this.#closed = true;
    await this.#fh.close();
  }
}
