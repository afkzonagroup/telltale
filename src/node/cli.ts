/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Command line interface. `runCli` takes the arguments and an I/O object so
 * it can be tested without spawning processes.
 */

import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isTelltaleError, TelltaleError } from '../errors.js';
import { verifyDisclosureLog } from '../log/index.js';
import {
  DEFAULT_MAX_INPUT_BYTES,
  GENERATIVE_DIGITAL_SOURCE_TYPES,
  HARD_MAX_INPUT_BYTES,
  markImage,
  readImageMarking,
  type GenerativeDigitalSourceType,
  type MarkOptions,
} from '../marking/index.js';
import { VERSION } from '../version.js';
import { readRegularFile, writeFileAtomic } from './files.js';

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

/** Largest log file `verify-log` reads. */
const MAX_LOG_BYTES = 256 * 1024 * 1024;

const HELP = `telltale ${VERSION}: Article 50 AI Act helpers

Usage:
  telltale mark <image> --out <file> [options]
  telltale mark <image...> --out-dir <dir> [options]
  telltale read <image...> [--max-bytes <n>]
  telltale verify-log <file> [--head-seq <n> --head-hash <hex>] [--hmac-key-env <NAME>] [--max-bytes <n>]

Mark options:
  --type <code>              trainedAlgorithmicMedia (default),
                             compositeWithTrainedAlgorithmicMedia, compositeSynthetic
  --ai-system <name>         IPTC "AI System Used"
  --ai-system-version <v>    IPTC "AI System Version Used"
  --existing <policy>        merge (default), replace, error
  --allow-c2pa-invalidation  mark files with a C2PA manifest (breaks the manifest)
  --max-bytes <n>            largest input file (default ${DEFAULT_MAX_INPUT_BYTES}, at most ${HARD_MAX_INPUT_BYTES};
                             for verify-log default and maximum ${MAX_LOG_BYTES})
  --force                    replace existing output files

This writes unsigned XMP metadata. It is not a watermark or a C2PA manifest.
File names in messages are JSON-quoted. Exit codes: 0 success, 1 a file failed, 2 usage error.
`;

class UsageError extends Error {}

function describeError(e: unknown): string {
  if (isTelltaleError(e)) return `${e.code} ${e.message}`;
  const code = (e as NodeJS.ErrnoException | null)?.code;
  if (typeof code === 'string' && /^E[A-Z]+$/.test(code)) return code;
  return 'internal error';
}

function parseMaxBytes(v: string | undefined, fallback: number, limit: number): number {
  if (v === undefined) return fallback;
  const n = /^\d{1,10}$/.test(v) ? Number(v) : 0;
  // The limit is checked before any file is read, so a large value cannot make the CLI allocate a huge buffer.
  if (n < 1 || n > limit) throw new UsageError(`--max-bytes must be an integer from 1 to ${limit}.`);
  return n;
}

async function cmdMark(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      out: { type: 'string' },
      'out-dir': { type: 'string' },
      type: { type: 'string' },
      'ai-system': { type: 'string' },
      'ai-system-version': { type: 'string' },
      existing: { type: 'string' },
      'allow-c2pa-invalidation': { type: 'boolean' },
      'max-bytes': { type: 'string' },
      force: { type: 'boolean' },
    },
  });
  if (positionals.length === 0) throw new UsageError('mark needs at least one input file.');
  const out = values.out;
  const outDir = values['out-dir'];
  if ((out === undefined) === (outDir === undefined)) throw new UsageError('Use exactly one of --out or --out-dir.');
  if (out !== undefined && positionals.length !== 1) throw new UsageError('--out takes one input; use --out-dir for several.');
  const type = values.type ?? 'trainedAlgorithmicMedia';
  if (!(GENERATIVE_DIGITAL_SOURCE_TYPES as readonly string[]).includes(type)) throw new UsageError(`Unknown --type ${JSON.stringify(type.slice(0, 60))}.`);
  const existing = values.existing ?? 'merge';
  if (existing !== 'merge' && existing !== 'replace' && existing !== 'error') throw new UsageError('--existing must be merge, replace or error.');
  const maxBytes = parseMaxBytes(values['max-bytes'], DEFAULT_MAX_INPUT_BYTES, HARD_MAX_INPUT_BYTES);
  const destinations = positionals.map((input) =>
    out !== undefined ? resolve(io.cwd, out) : join(resolve(io.cwd, outDir ?? '.'), basename(resolve(io.cwd, input))),
  );
  // Two inputs with the same file name would write the same output; with --force the second would silently replace the first.
  if (new Set(destinations).size !== destinations.length) throw new UsageError('Two inputs would write the same output file.');

  const options: MarkOptions = {
    digitalSourceType: type as GenerativeDigitalSourceType,
    existingXmp: existing,
    allowC2paInvalidation: values['allow-c2pa-invalidation'] ?? false,
    maxInputBytes: maxBytes,
    ...(values['ai-system'] === undefined ? {} : { aiSystemUsed: values['ai-system'] }),
    ...(values['ai-system-version'] === undefined ? {} : { aiSystemVersionUsed: values['ai-system-version'] }),
  };
  let failed = 0;
  for (const [i, input] of positionals.entries()) {
    const src = resolve(io.cwd, input);
    const dest = destinations[i] ?? '';
    try {
      const bytes = await readRegularFile(src, maxBytes);
      const result = markImage(bytes, options);
      await writeFileAtomic(dest, result.bytes, values.force ?? false);
      io.stdout(`${JSON.stringify({ file: input, output: dest, format: result.format, action: result.action })}\n`);
    } catch (e) {
      failed++;
      io.stderr(`telltale: ${JSON.stringify(input)}: ${describeError(e)}\n`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function cmdRead(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: { 'max-bytes': { type: 'string' } },
  });
  if (positionals.length === 0) throw new UsageError('read needs at least one input file.');
  const maxBytes = parseMaxBytes(values['max-bytes'], DEFAULT_MAX_INPUT_BYTES, HARD_MAX_INPUT_BYTES);
  let failed = 0;
  for (const input of positionals) {
    try {
      const bytes = await readRegularFile(resolve(io.cwd, input), maxBytes);
      io.stdout(`${JSON.stringify({ file: input, ...readImageMarking(bytes, { maxInputBytes: maxBytes }) })}\n`);
    } catch (e) {
      failed++;
      io.stderr(`telltale: ${JSON.stringify(input)}: ${describeError(e)}\n`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function cmdVerifyLog(args: string[], io: CliIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      'head-seq': { type: 'string' },
      'head-hash': { type: 'string' },
      'hmac-key-env': { type: 'string' },
      'max-bytes': { type: 'string' },
    },
  });
  if (positionals.length !== 1) throw new UsageError('verify-log needs exactly one file.');
  const headSeq = values['head-seq'];
  const headHash = values['head-hash'];
  if ((headSeq === undefined) !== (headHash === undefined)) throw new UsageError('Use --head-seq and --head-hash together.');
  if (headSeq !== undefined && !/^\d{1,15}$/.test(headSeq)) throw new UsageError('--head-seq must be a non-negative integer.');
  if (headHash !== undefined && !/^[0-9a-f]{64}$/.test(headHash)) throw new UsageError('--head-hash must be 64 lowercase hex characters.');
  let hmacKey: Uint8Array | undefined;
  const keyEnv = values['hmac-key-env'];
  if (keyEnv !== undefined) {
    // The key is read from the environment, never from argv, so it does not show up in process listings.
    const hex = io.env[keyEnv];
    if (hex === undefined || !/^(?:[0-9a-fA-F]{2}){32,}$/.test(hex)) throw new UsageError('The key variable must hold at least 64 hex characters.');
    hmacKey = Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
  }
  const file = positionals[0] ?? '';
  const maxBytes = parseMaxBytes(values['max-bytes'], MAX_LOG_BYTES, MAX_LOG_BYTES);
  try {
    const bytes = await readRegularFile(resolve(io.cwd, file), maxBytes);
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new TelltaleError('LOG_INVALID', 'Log is not valid UTF-8.');
    }
    const result = await verifyDisclosureLog(text, {
      ...(hmacKey === undefined ? {} : { hmacKey }),
      ...(headSeq === undefined || headHash === undefined ? {} : { expectedHead: { seq: Number(headSeq), hash: headHash } }),
    });
    io.stdout(`${JSON.stringify({ file, ...result })}\n`);
    return result.ok ? 0 : 1;
  } catch (e) {
    io.stderr(`telltale: ${JSON.stringify(file)}: ${describeError(e)}\n`);
    return 1;
  }
}

/** Runs the CLI and returns the exit code. Never throws. */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'mark':
        return await cmdMark(rest, io);
      case 'read':
        return await cmdRead(rest, io);
      case 'verify-log':
        return await cmdVerifyLog(rest, io);
      case '--version':
      case '-v':
        io.stdout(`${VERSION}\n`);
        return 0;
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        io.stdout(HELP);
        return command === undefined ? 2 : 0;
      default:
        throw new UsageError(`Unknown command ${JSON.stringify(command.slice(0, 40))}.`);
    }
  } catch (e) {
    if (e instanceof UsageError || (e as { code?: string } | null)?.code?.startsWith('ERR_PARSE_ARGS') === true) {
      io.stderr(`telltale: ${(e as Error).message}\nRun "telltale --help" for usage.\n`);
      return 2;
    }
    io.stderr(`telltale: ${describeError(e)}\n`);
    return 1;
  }
}
