/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import {
  canonicalJson,
  deriveSessionPseudonym,
  DisclosureLog,
  GENESIS_HASH,
  randomSessionPseudonym,
  sha256Hex,
  verifyDisclosureLog,
  type DisclosureLogInput,
} from '../src/log/index.js';
import { toBase64Url } from '../src/log/crypto.js';
import { digestsEqual } from '../src/log/chain.js';

const SESSION = 'abcdefghijklmnop_-12';
const KEY = new Uint8Array(32).fill(7);

async function input(i = 0): Promise<DisclosureLogInput> {
  return {
    event: 'shown',
    kind: 'chatbot',
    lang: 'en',
    textSha256: await sha256Hex(`text ${i}`),
    session: SESSION,
    surface: 'web-chat',
    ts: '2026-11-08T12:00:00.000Z',
  };
}

async function buildLog(n: number, key?: Uint8Array): Promise<string[]> {
  const log = new DisclosureLog(key ? { hmacKey: key } : {});
  const lines: string[] = [];
  for (let i = 0; i < n; i++) lines.push((await log.append(await input(i))).line);
  return lines;
}

describe('sha256Hex', () => {
  it('matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('DisclosureLog', () => {
  it('chains entries from the genesis hash', async () => {
    const log = new DisclosureLog();
    const a = await log.append(await input(0));
    const b = await log.append(await input(1));
    expect(a.entry.seq).toBe(0);
    expect(a.entry.prev).toBe(GENESIS_HASH);
    expect(b.entry.seq).toBe(1);
    expect(b.entry.prev).toBe(a.entry.hash);
    expect(log.head).toEqual({ seq: 1, hash: b.entry.hash });
    expect(JSON.parse(a.line)).toEqual(a.entry);
  });

  it('hashes the canonical JSON of the entry without its hash', async () => {
    const { entry } = await new DisclosureLog().append(await input());
    const { hash, ...rest } = entry;
    expect(hash).toBe(await sha256Hex(canonicalJson(rest)));
  });

  it('writes canonical lines with sorted keys', async () => {
    const [line] = await buildLog(1);
    const keys = Object.keys(JSON.parse(line!) as object);
    expect(keys).toEqual([...keys].sort());
    expect(line).not.toMatch(/\s/);
  });

  it('serialises concurrent appends into one chain', async () => {
    const log = new DisclosureLog();
    const inputs = await Promise.all(Array.from({ length: 50 }, (_, i) => input(i)));
    const results = await Promise.all(inputs.map((x) => log.append(x)));
    expect(results.map((r) => r.entry.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect((await verifyDisclosureLog(results.map((r) => r.line))).ok).toBe(true);
  });

  it('keeps working after a rejected append', async () => {
    const log = new DisclosureLog();
    await expect(log.append({ ...(await input()), session: 'short' })).rejects.toThrow(TelltaleError);
    expect((await log.append(await input())).entry.seq).toBe(0);
  });

  it('defaults the timestamp to the clock', async () => {
    const log = new DisclosureLog({ now: () => new Date('2026-01-02T03:04:05.678Z') });
    const { ts: _ts, ...rest } = await input();
    expect((await log.append(rest)).entry.ts).toBe('2026-01-02T03:04:05.678Z');
    const bad = new DisclosureLog({ now: () => new Date(Number.NaN) });
    await expect(bad.append(rest)).rejects.toThrow();
  });

  it('continues from a stored head', async () => {
    const lines = await buildLog(3);
    const v = await verifyDisclosureLog(lines);
    if (!v.ok || !v.head) throw new Error('expected ok');
    const log = new DisclosureLog({ head: v.head });
    lines.push((await log.append(await input(9))).line);
    expect((await verifyDisclosureLog(lines)).ok).toBe(true);
    expect(() => new DisclosureLog({ head: { seq: -1, hash: GENESIS_HASH } })).toThrow(TelltaleError);
    expect(() => new DisclosureLog({ head: { seq: 0, hash: 'x' } })).toThrow(TelltaleError);
  });

  it.each([
    ['unknown field (personal data)', { email: 'a@example.com' }],
    ['ip address', { ip: '192.0.2.1' }],
    ['bad event', { event: 'clicked' }],
    ['bad kind', { kind: 'other' }],
    ['bad lang', { lang: 'xx' }],
    ['bad hash', { textSha256: 'ABC' }],
    ['XSS session', { session: '<script>alert(1)</script>' }],
    ['short session', { session: 'abc' }],
    ['XSS surface', { surface: '<img src=x onerror=alert(1)>' }],
    ['bad ts', { ts: '2026-13-45T00:00:00.000Z' }],
    ['ts without ms', { ts: '2026-11-08T12:00:00Z' }],
  ])('rejects %s', async (_n, patch) => {
    const log = new DisclosureLog();
    await expect(log.append({ ...(await input()), ...patch } as DisclosureLogInput)).rejects.toMatchObject({ code: 'LOG_INVALID' });
  });

  it('rejects non-object input and short keys', async () => {
    await expect(new DisclosureLog().append(null as unknown as DisclosureLogInput)).rejects.toThrow(TelltaleError);
    expect(() => new DisclosureLog({ hmacKey: new Uint8Array(31) })).toThrow(TelltaleError);
  });
});

describe('verifyDisclosureLog', () => {
  it('accepts an intact log, with or without trailing newline, and an empty log', async () => {
    const lines = await buildLog(5);
    expect(await verifyDisclosureLog(lines.join('\n'))).toMatchObject({ ok: true, count: 5 });
    expect(await verifyDisclosureLog(lines.join('\n') + '\n')).toMatchObject({ ok: true, count: 5 });
    expect(await verifyDisclosureLog('')).toEqual({ ok: true, count: 0, head: null });
  });

  it('detects a changed field', async () => {
    const lines = await buildLog(4);
    lines[1] = lines[1]!.replace('"event":"shown"', '"event":"dismissed"');
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, line: 2, code: 'LOG_TAMPERED' });
  });

  it('detects a deleted entry', async () => {
    const lines = await buildLog(4);
    lines.splice(1, 1);
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, line: 2, code: 'LOG_TAMPERED' });
  });

  it('detects reordering', async () => {
    const lines = await buildLog(4);
    [lines[1], lines[2]] = [lines[2]!, lines[1]!];
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
  });

  it('detects an inserted entry from another log', async () => {
    const lines = await buildLog(3);
    const other = await buildLog(3);
    lines.splice(1, 0, other[1]!);
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
  });

  it('detects a changed hash that was recomputed for one entry only', async () => {
    const lines = await buildLog(3);
    const e = JSON.parse(lines[0]!) as Record<string, string | number>;
    e['lang'] = 'de';
    const { hash: _h, ...rest } = e;
    e['hash'] = await sha256Hex(canonicalJson(rest));
    lines[0] = canonicalJson(e);
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, line: 2, code: 'LOG_TAMPERED' });
  });

  it('detects truncation only against an expected head', async () => {
    const lines = await buildLog(4);
    const full = await verifyDisclosureLog(lines);
    if (!full.ok || !full.head) throw new Error('expected ok');
    const truncated = lines.slice(0, 3);
    expect((await verifyDisclosureLog(truncated)).ok).toBe(true);
    expect(await verifyDisclosureLog(truncated, { expectedHead: full.head })).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
    expect(await verifyDisclosureLog([], { expectedHead: full.head })).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
    expect((await verifyDisclosureLog(lines, { expectedHead: full.head })).ok).toBe(true);
  });

  it('makes a full rewrite detectable with an HMAC key', async () => {
    const lines = await buildLog(3, KEY);
    expect((await verifyDisclosureLog(lines, { hmacKey: KEY })).ok).toBe(true);
    expect(await verifyDisclosureLog(lines)).toMatchObject({ ok: false, code: 'LOG_INVALID' });
    expect(await verifyDisclosureLog(lines, { hmacKey: new Uint8Array(32).fill(8) })).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
    // A forger without the key rewrites the chain with plain SHA-256: refused when a key is given.
    const forged = await buildLog(3);
    expect(await verifyDisclosureLog(forged, { hmacKey: KEY })).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
  });

  it('does not detect cutting off the end with an HMAC key alone (documented)', async () => {
    const lines = await buildLog(3, KEY);
    const full = await verifyDisclosureLog(lines, { hmacKey: KEY });
    if (!full.ok || !full.head) throw new Error('expected ok');
    expect((await verifyDisclosureLog(lines.slice(0, 2), { hmacKey: KEY })).ok).toBe(true);
    expect(await verifyDisclosureLog(lines.slice(0, 2), { hmacKey: KEY, expectedHead: full.head })).toMatchObject({ ok: false, code: 'LOG_TAMPERED' });
  });

  it('detects an algorithm switch inside a log', async () => {
    const a = await buildLog(1);
    const b = await buildLog(2, KEY);
    expect(await verifyDisclosureLog([b[0]!, a[0]!], { hmacKey: KEY })).toMatchObject({ ok: false, line: 2, reason: 'Hash algorithm changed within the log.' });
  });

  it.each([
    ['not JSON', 'not json'],
    ['array', '[]'],
    ['null', 'null'],
    ['extra field', 'X'],
    ['whitespace variant', 'W'],
    ['long line', 'L'],
    ['CRLF', 'R'],
    ['bad version', 'V'],
    ['bad seq', 'S'],
    ['bad alg', 'A'],
  ])('rejects %s as LOG_INVALID', async (_n, kind) => {
    const [line] = await buildLog(1);
    const e = JSON.parse(line!) as Record<string, unknown>;
    let bad: string = kind;
    if (kind === 'X') bad = JSON.stringify({ ...e, email: 'a@example.com' });
    if (kind === 'W') bad = JSON.stringify(e, null, 1);
    if (kind === 'L') bad = 'x'.repeat(5000);
    if (kind === 'R') bad = line! + '\r';
    if (kind === 'V') bad = canonicalJson({ ...(e as Record<string, string | number>), v: 2 });
    if (kind === 'S') bad = canonicalJson({ ...(e as Record<string, string | number>), seq: 1.5 });
    if (kind === 'A') bad = canonicalJson({ ...(e as Record<string, string | number>), alg: 'md5' });
    const r = await verifyDisclosureLog([bad]);
    expect(r).toMatchObject({ ok: false, line: 1, code: 'LOG_INVALID' });
  });

  it('names an unknown field even when the line is otherwise canonical', async () => {
    const [line] = await buildLog(1);
    const e = JSON.parse(line!) as Record<string, string | number>;
    const r = await verifyDisclosureLog([canonicalJson({ ...e, email: 'a@example.com' })]);
    expect(r).toMatchObject({ ok: false, line: 1, code: 'LOG_INVALID', reason: 'Unknown field.' });
  });

  it('rejects invalid prev/hash/ts fields', async () => {
    const [line] = await buildLog(1);
    const e = JSON.parse(line!) as Record<string, string | number>;
    for (const patch of [{ prev: 'zz' }, { hash: 'zz' }, { ts: 'yesterday' }, { session: '<b>' }]) {
      expect(await verifyDisclosureLog([canonicalJson({ ...e, ...patch })])).toMatchObject({ ok: false, code: 'LOG_INVALID' });
    }
  });

  it('enforces maxLines', async () => {
    const lines = await buildLog(3);
    expect(await verifyDisclosureLog(lines, { maxLines: 2 })).toMatchObject({ ok: false, line: 3, code: 'LOG_INVALID' });
    await expect(verifyDisclosureLog(lines, { maxLines: 0 })).rejects.toThrow(TelltaleError);
  });
});

describe('digestsEqual', () => {
  it('compares equal-length digests exactly', () => {
    expect(digestsEqual('ab', 'ab')).toBe(true);
    expect(digestsEqual('ab', 'ac')).toBe(false);
    expect(digestsEqual('ab', 'abc')).toBe(false);
  });
});

describe('session pseudonyms', () => {
  it('random pseudonyms are 22 base64url characters and differ', () => {
    const a = randomSessionPseudonym();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomSessionPseudonym()).not.toBe(a);
  });

  it('derived pseudonyms are stable per key and differ across keys', async () => {
    const a = await deriveSessionPseudonym(KEY, 'session-123');
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await deriveSessionPseudonym(KEY, 'session-123')).toBe(a);
    expect(await deriveSessionPseudonym(new Uint8Array(32).fill(1), 'session-123')).not.toBe(a);
    expect(a).not.toContain('session');
    await expect(deriveSessionPseudonym(KEY, '')).rejects.toThrow(TelltaleError);
    await expect(deriveSessionPseudonym(new Uint8Array(8), 'x')).rejects.toThrow(TelltaleError);
  });

  it('base64url encodes all tail lengths', () => {
    expect(toBase64Url(Uint8Array.of())).toBe('');
    expect(toBase64Url(Uint8Array.of(0xff))).toBe('_w');
    expect(toBase64Url(Uint8Array.of(0xff, 0xfe))).toBe('__4');
    expect(toBase64Url(Uint8Array.of(0xfb, 0xff, 0xbf))).toBe('-_-_');
  });
});
