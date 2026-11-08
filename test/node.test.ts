/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import { sha256Hex, type DisclosureLogInput } from '../src/log/index.js';
import { readImageMarking } from '../src/marking/index.js';
import { runCli, type CliIo } from '../src/node/cli.js';
import { placeExclusive, readRegularFile, writeFileAtomic } from '../src/node/files.js';
import { DisclosureLogFile } from '../src/node/log-file.js';
import { VERSION } from '../src/version.js';
import { fixture, VECTOR_ROOT } from './helpers/vectors.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'telltale-test-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function entry(): Promise<DisclosureLogInput> {
  return { event: 'shown', kind: 'chatbot', lang: 'en', textSha256: await sha256Hex('x'), session: 'ABCDEFGHIJKLMNOPQRSTUV' };
}

describe('DisclosureLogFile', () => {
  it('creates a 0600 file, appends lines and resumes the chain on reopen', async () => {
    const f = await DisclosureLogFile.open({ dir, name: 'log.jsonl' });
    await f.append(await entry());
    await f.append(await entry());
    const head = f.head;
    await f.close();
    await f.close();
    const path = join(dir, 'log.jsonl');
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, 'utf8').split('\n')).toHaveLength(3);
    const g = await DisclosureLogFile.open({ dir, name: 'log.jsonl', expectedHead: head!, sync: true });
    expect((await g.append(await entry())).seq).toBe(2);
    await g.close();
    await expect(g.append(await entry())).rejects.toThrow(/closed/);
  });

  it('refuses unsafe names', async () => {
    for (const name of ['../x', 'a/b', '.hidden', '', 'a\\b', 'x'.repeat(200)]) {
      await expect(DisclosureLogFile.open({ dir, name })).rejects.toThrow(TelltaleError);
    }
  });

  it('refuses symlinks and directories at the log path', async () => {
    if (process.platform === 'win32') return;
    writeFileSync(join(dir, 'target'), '');
    symlinkSync(join(dir, 'target'), join(dir, 'link.jsonl'));
    await expect(DisclosureLogFile.open({ dir, name: 'link.jsonl' })).rejects.toThrow(/regular file/);
    await expect(DisclosureLogFile.open({ dir: join(dir, 'missing'), name: 'a.jsonl' })).rejects.toThrow();
  });

  it('refuses to open a tampered, truncated or incomplete log', async () => {
    const f = await DisclosureLogFile.open({ dir, name: 'log.jsonl' });
    await f.append(await entry());
    await f.append(await entry());
    const head = f.head!;
    await f.close();
    const path = join(dir, 'log.jsonl');
    const original = readFileSync(path, 'utf8');

    writeFileSync(path, original.replace('"event":"shown"', '"event":"expanded"'));
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl' })).rejects.toMatchObject({ code: 'LOG_TAMPERED' });

    writeFileSync(path, `${original.split('\n')[0] ?? ''}\n`);
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl', expectedHead: head })).rejects.toMatchObject({ code: 'LOG_TAMPERED' });

    writeFileSync(path, original.slice(0, -5));
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl' })).rejects.toMatchObject({ code: 'LOG_INVALID' });

    writeFileSync(path, Buffer.from([0xff, 0x0a]));
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl' })).rejects.toMatchObject({ code: 'LOG_INVALID' });

    writeFileSync(path, original);
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl', maxBytes: 10 })).rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' });
    await expect(DisclosureLogFile.open({ dir, name: 'log.jsonl', maxBytes: 0 })).rejects.toThrow(TelltaleError);
  });

  it('works with an HMAC key', async () => {
    const key = new Uint8Array(32).fill(3);
    const f = await DisclosureLogFile.open({ dir, name: 'k.jsonl', hmacKey: key });
    await f.append(await entry());
    await f.close();
    await expect(DisclosureLogFile.open({ dir, name: 'k.jsonl' })).rejects.toMatchObject({ code: 'LOG_INVALID' });
    const g = await DisclosureLogFile.open({ dir, name: 'k.jsonl', hmacKey: key });
    await g.close();
  });

  it('rejects invalid entries without breaking the file', async () => {
    const f = await DisclosureLogFile.open({ dir, name: 'log.jsonl' });
    await expect(f.append({ ...(await entry()), session: 'x' })).rejects.toThrow(TelltaleError);
    await f.append(await entry());
    await f.close();
    expect(readFileSync(join(dir, 'log.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

describe('file helpers', () => {
  it('reads regular files with a size cap', async () => {
    writeFileSync(join(dir, 'a'), 'hello');
    expect(new TextDecoder().decode(await readRegularFile(join(dir, 'a'), 5))).toBe('hello');
    await expect(readRegularFile(join(dir, 'a'), 4)).rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' });
    await expect(readRegularFile(dir, 100)).rejects.toThrow();
    if (process.platform !== 'win32') {
      // Inputs named by the user may be symlinks; the target must still be a regular file.
      symlinkSync(join(dir, 'a'), join(dir, 'a-link'));
      expect(new TextDecoder().decode(await readRegularFile(join(dir, 'a-link'), 5))).toBe('hello');
      symlinkSync(dir, join(dir, 'dir-link'));
      await expect(readRegularFile(join(dir, 'dir-link'), 100)).rejects.toThrow(/regular file/);
    }
  });

  it('writes atomically, refuses overwrite without consent and never follows symlinks', async () => {
    const p = join(dir, 'out.bin');
    await writeFileAtomic(p, Uint8Array.of(1, 2), false);
    await expect(writeFileAtomic(p, Uint8Array.of(3), false)).rejects.toThrow(/exists/);
    await writeFileAtomic(p, Uint8Array.of(3), true);
    expect([...readFileSync(p)]).toEqual([3]);
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    if (process.platform !== 'win32') {
      writeFileSync(join(dir, 'victim'), 'keep');
      symlinkSync(join(dir, 'victim'), join(dir, 'link'));
      await expect(writeFileAtomic(join(dir, 'link'), Uint8Array.of(9), true)).rejects.toThrow(/symbolic link/);
      expect(readFileSync(join(dir, 'victim'), 'utf8')).toBe('keep');
    }
    await expect(writeFileAtomic(dir, Uint8Array.of(1), true)).rejects.toThrow(/not a regular file/);
    await expect(writeFileAtomic(join(dir, 'missing-dir', 'x'), Uint8Array.of(1), false)).rejects.toThrow();
  });

  it('never replaces a file that appears after the existence check', async () => {
    // Without --force the final step is a hard link, which fails if the name was taken in the meantime.
    writeFileSync(join(dir, 'tmp'), 'new');
    writeFileSync(join(dir, 'taken'), 'someone else');
    await expect(placeExclusive(join(dir, 'tmp'), join(dir, 'taken'))).rejects.toThrow(/exists/);
    expect(readFileSync(join(dir, 'taken'), 'utf8')).toBe('someone else');
    expect(await placeExclusive(join(dir, 'tmp'), join(dir, 'free'))).toBe(true);
    expect(readFileSync(join(dir, 'free'), 'utf8')).toBe('new');
    expect(existsSync(join(dir, 'tmp'))).toBe(false);
    expect(statSync(join(dir, 'free')).nlink).toBe(1);
  });
});

describe('CLI', () => {
  function io(env: Record<string, string> = {}): CliIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, stdout: (t) => out.push(t), stderr: (t) => err.push(t), env, cwd: dir };
  }

  it('prints help and version', async () => {
    const a = io();
    expect(await runCli(['--help'], a)).toBe(0);
    expect(a.out.join('')).toContain('telltale mark');
    expect(await runCli([], io())).toBe(2);
    const b = io();
    expect(await runCli(['--version'], b)).toBe(0);
    expect(b.out.join('').trim()).toBe(VERSION);
  });

  it('keeps VERSION equal to package.json', () => {
    const pkg = JSON.parse(readFileSync(join(VECTOR_ROOT, '..', 'package.json'), 'utf8')) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });

  it('marks a file and reads it back', async () => {
    writeFileSync(join(dir, 'in.png'), fixture('basic.png'));
    const a = io();
    expect(await runCli(['mark', 'in.png', '--out', 'out.png', '--ai-system', 'Example', '--type', 'compositeSynthetic'], a)).toBe(0);
    expect(JSON.parse(a.out.join(''))).toMatchObject({ file: 'in.png', format: 'png', action: 'inserted' });
    const marked = readImageMarking(new Uint8Array(readFileSync(join(dir, 'out.png'))));
    expect(marked.digitalSourceTypes).toEqual(['http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic']);
    expect(marked.aiSystemUsed).toEqual(['Example']);
    const b = io();
    expect(await runCli(['read', 'out.png'], b)).toBe(0);
    expect(JSON.parse(b.out.join(''))).toMatchObject({ file: 'out.png', generativeAi: true });
  });

  it('marks several files into a directory and reports failures per file', async () => {
    writeFileSync(join(dir, 'a.jpg'), fixture('basic.jpg'));
    writeFileSync(join(dir, 'b.webp'), fixture('lossy.webp'));
    writeFileSync(join(dir, 'c.txt'), 'not an image');
    rmSync(join(dir, 'outdir'), { force: true, recursive: true });
    mkdirSync(join(dir, 'outdir'));
    const a = io();
    expect(await runCli(['mark', 'a.jpg', 'b.webp', 'c.txt', '--out-dir', 'outdir'], a)).toBe(1);
    expect(a.out).toHaveLength(2);
    expect(a.err.join('')).toContain('"c.txt": UNKNOWN_FORMAT');
    expect(existsSync(join(dir, 'outdir', 'a.jpg'))).toBe(true);
    expect(existsSync(join(dir, 'outdir', 'c.txt'))).toBe(false);
  });

  it('does not overwrite without --force, including the input itself', async () => {
    writeFileSync(join(dir, 'in.png'), fixture('basic.png'));
    const a = io();
    expect(await runCli(['mark', 'in.png', '--out', 'in.png'], a)).toBe(1);
    expect(a.err.join('')).toContain('exists');
    expect(readFileSync(join(dir, 'in.png'))).toEqual(Buffer.from(fixture('basic.png')));
    expect(await runCli(['mark', 'in.png', '--out', 'in.png', '--force'], io())).toBe(0);
    expect(readImageMarking(new Uint8Array(readFileSync(join(dir, 'in.png')))).generativeAi).toBe(true);
  });

  it('honours --max-bytes, --existing and C2PA refusal', async () => {
    writeFileSync(join(dir, 'in.png'), fixture('basic.png'));
    const a = io();
    expect(await runCli(['mark', 'in.png', '--out', 'o.png', '--max-bytes', '10'], a)).toBe(1);
    expect(a.err.join('')).toContain('INPUT_TOO_LARGE');
    writeFileSync(join(dir, 'x.png'), fixture('png-with-xmp.png'));
    const b = io();
    expect(await runCli(['mark', 'x.png', '--out', 'o2.png', '--existing', 'error'], b)).toBe(1);
    expect(b.err.join('')).toContain('XMP_EXISTS');
    writeFileSync(join(dir, 'c.png'), fixture('png-c2pa.png'));
    const c = io();
    expect(await runCli(['mark', 'c.png', '--out', 'o3.png'], c)).toBe(1);
    expect(c.err.join('')).toContain('C2PA_PRESENT');
    expect(await runCli(['mark', 'c.png', '--out', 'o3.png', '--allow-c2pa-invalidation'], io())).toBe(0);
  });

  it.each([
    [['mark']],
    [['mark', 'a.png']],
    [['mark', 'a.png', '--out', 'x', '--out-dir', 'y']],
    [['mark', 'a.png', 'b.png', '--out', 'x']],
    [['mark', 'a.png', '--out', 'x', '--type', 'digitalCapture']],
    [['mark', 'a.png', '--out', 'x', '--existing', 'keep']],
    [['mark', 'a.png', '--out', 'x', '--max-bytes', '-1']],
    [['mark', 'a.png', '--out', 'x', '--max-bytes', '0']],
    [['mark', 'a.png', '--out', 'x', '--max-bytes', '9999999999']],
    [['mark', 'a/x.png', 'b/x.png', '--out-dir', 'o']],
    [['read', 'a.png', '--max-bytes', '1073741825']],
    [['verify-log', 'a', '--max-bytes', '268435457']],
    [['mark', 'a.png', '--out', 'x', '--unknown']],
    [['read']],
    [['verify-log']],
    [['verify-log', 'a', '--head-seq', '1']],
    [['verify-log', 'a', '--head-seq', 'x', '--head-hash', '0'.repeat(64)]],
    [['verify-log', 'a', '--head-seq', '1', '--head-hash', 'xyz']],
    [['verify-log', 'a', '--hmac-key-env', 'MISSING']],
    [['frobnicate']],
  ])('returns 2 for usage error %j', async (argv) => {
    const a = io();
    expect(await runCli(argv, a)).toBe(2);
    expect(a.err.join('')).toContain('telltale --help');
  });

  it('quotes hostile file names in messages', async () => {
    const a = io();
    expect(await runCli(['read', 'bad\u001b[31mname'], a)).toBe(1);
    expect(a.err.join('')).not.toContain('\u001b');
    expect(a.err.join('')).toContain('\\u001b');
  });

  it('quotes hostile command and type names in usage errors', async () => {
    for (const argv of [['bad\u001b[31m'], ['mark', 'a.png', '--out', 'x', '--type', 'bad\u001b[31m']]) {
      const a = io();
      expect(await runCli(argv, a)).toBe(2);
      expect(a.err.join('')).not.toContain('\u001b');
    }
  });

  it('verifies logs, with head and HMAC key from the environment', async () => {
    const key = new Uint8Array(32).fill(5);
    const f = await DisclosureLogFile.open({ dir, name: 'log.jsonl', hmacKey: key });
    await f.append(await entry());
    const head = f.head!;
    await f.close();
    const hex = Buffer.from(key).toString('hex');
    const a = io({ TELLTALE_KEY: hex });
    expect(await runCli(['verify-log', 'log.jsonl', '--hmac-key-env', 'TELLTALE_KEY', '--head-seq', String(head.seq), '--head-hash', head.hash], a)).toBe(0);
    expect(JSON.parse(a.out.join(''))).toMatchObject({ ok: true, count: 1 });
    const b = io();
    expect(await runCli(['verify-log', 'log.jsonl'], b)).toBe(1);
    expect(JSON.parse(b.out.join(''))).toMatchObject({ ok: false, code: 'LOG_INVALID' });
    appendFileSync(join(dir, 'bin.jsonl'), Buffer.from([0xc3, 0x28, 0x0a]));
    const c = io();
    expect(await runCli(['verify-log', 'bin.jsonl'], c)).toBe(1);
    expect(c.err.join('')).toContain('LOG_INVALID');
    const d = io();
    expect(await runCli(['verify-log', 'missing.jsonl'], d)).toBe(1);
    expect(d.err.join('')).toContain('ENOENT');
  });
});
