/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Append-only, hash-chained JSON Lines log of disclosures shown to people.
 *
 * Each entry stores the hash of the previous entry (`prev`) and its own hash
 * (`hash`) over its canonical JSON without `hash`. Changing, removing,
 * inserting or reordering any entry breaks the chain. Cutting entries off
 * the end is only detectable against a head (sequence and hash) kept
 * somewhere else; an HMAC key does not help there, because the remaining
 * entries are still correctly keyed. Rewriting the whole chain is detectable
 * against such a head, or with an HMAC key the attacker does not have.
 *
 * Personal data: entries hold no names, emails, IP addresses or user agents.
 * The `session` field is a pseudonym (see {@link randomSessionPseudonym}
 * and {@link deriveSessionPseudonym}). A pseudonym that can be linked back to
 * a person is still personal data under the GDPR.
 */

import { TelltaleError } from '../errors.js';
import { ownProperties } from '../own.js';
import { isDisclosureKind, isEuLanguage, type DisclosureKind, type EuLanguage } from '../texts/index.js';
import { checkKey, hmacSha256, randomBytes, sha256Hex, toBase64Url, toHex } from './crypto.js';

export { sha256Hex } from './crypto.js';

export const LOG_VERSION = 1;
export const GENESIS_HASH = '0'.repeat(64);
export const MAX_LINE_LENGTH = 2048;

export const DISCLOSURE_EVENTS = ['shown', 'dismissed', 'expanded', 'labelled'] as const;
export type DisclosureEvent = (typeof DISCLOSURE_EVENTS)[number];

export type HashAlgorithm = 'sha256' | 'hmac-sha256';

/** What the caller records. */
export interface DisclosureLogInput {
  readonly event: DisclosureEvent;
  readonly kind: DisclosureKind;
  readonly lang: EuLanguage;
  /** SHA-256 (hex) of the exact text shown. Use {@link sha256Hex}. */
  readonly textSha256: string;
  /** Session pseudonym, 16-64 characters from [A-Za-z0-9_-]. */
  readonly session: string;
  /** Optional place where it was shown, 1-64 characters from [a-z0-9._:/-]. */
  readonly surface?: string;
  /** Optional timestamp; defaults to now. Format `YYYY-MM-DDTHH:MM:SS.sssZ`. */
  readonly ts?: string;
}

/** A stored entry. */
export interface DisclosureLogEntry {
  readonly v: 1;
  readonly alg: HashAlgorithm;
  readonly seq: number;
  readonly ts: string;
  readonly event: DisclosureEvent;
  readonly kind: DisclosureKind;
  readonly lang: EuLanguage;
  readonly textSha256: string;
  readonly session: string;
  readonly surface?: string;
  readonly prev: string;
  readonly hash: string;
}

/** Position of the newest entry. Store it outside the log to detect truncation. */
export interface LogHead {
  readonly seq: number;
  readonly hash: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const SESSION = /^[A-Za-z0-9_-]{16,64}$/;
const SURFACE = /^[a-z0-9._:/-]{1,64}$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function invalid(msg: string): TelltaleError {
  return new TelltaleError('LOG_INVALID', msg);
}

function validTimestamp(ts: unknown): ts is string {
  if (typeof ts !== 'string' || !TS.test(ts)) return false;
  const d = new Date(ts);
  return !Number.isNaN(d.getTime()) && d.toISOString() === ts;
}

/** Validates caller input. Unknown keys are rejected so nothing extra (such as personal data) slips in. */
export function validateInput(input: unknown): DisclosureLogInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalid('Entry must be an object.');
  const o = ownProperties(input);
  const allowed = new Set(['event', 'kind', 'lang', 'textSha256', 'session', 'surface', 'ts']);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw invalid(`Unknown field "${k.slice(0, 40)}".`);
  const { event, kind, lang, textSha256, session, surface, ts } = o;
  if (typeof event !== 'string' || !(DISCLOSURE_EVENTS as readonly string[]).includes(event)) throw invalid('Invalid event.');
  if (!isDisclosureKind(kind)) throw invalid('Invalid kind.');
  if (!isEuLanguage(lang)) throw invalid('Invalid lang.');
  if (typeof textSha256 !== 'string' || !HEX64.test(textSha256)) throw invalid('textSha256 must be 64 lowercase hex characters.');
  if (typeof session !== 'string' || !SESSION.test(session)) throw invalid('session must be 16-64 characters from [A-Za-z0-9_-].');
  if (surface !== undefined && (typeof surface !== 'string' || !SURFACE.test(surface))) throw invalid('Invalid surface.');
  if (ts !== undefined && !validTimestamp(ts)) throw invalid('Invalid ts.');
  // No prototype: optional fields left out must read as undefined even if Object.prototype is polluted.
  const out = Object.assign(Object.create(null) as Record<string, never>, {
    event: event as DisclosureEvent,
    kind,
    lang,
    textSha256,
    session,
  }) as { -readonly [K in keyof DisclosureLogInput]: DisclosureLogInput[K] };
  if (surface !== undefined) out.surface = surface;
  if (ts !== undefined) out.ts = ts;
  return out;
}

/** Canonical JSON: keys sorted, no whitespace. Values are strings or safe integers only. */
export function canonicalJson(obj: Readonly<Record<string, string | number>>): string {
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`).join(',')}}`;
}

function withoutHash(e: DisclosureLogEntry): Record<string, string | number> {
  const r: Record<string, string | number> = {
    v: e.v,
    alg: e.alg,
    seq: e.seq,
    ts: e.ts,
    event: e.event,
    kind: e.kind,
    lang: e.lang,
    textSha256: e.textSha256,
    session: e.session,
    prev: e.prev,
  };
  if (Object.hasOwn(e, 'surface') && e.surface !== undefined) r['surface'] = e.surface;
  return r;
}

/** Compares two hex digests without an early exit, so timing does not reveal how much of an HMAC matched. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function entryHash(body: Readonly<Record<string, string | number>>, key: Uint8Array | undefined): Promise<string> {
  const text = canonicalJson(body);
  return key ? toHex(await hmacSha256(key, text)) : sha256Hex(text);
}

/** Serialises an entry as one canonical JSON line (without the newline). */
export function serializeEntry(e: DisclosureLogEntry): string {
  return canonicalJson({ ...withoutHash(e), hash: e.hash });
}

/** Options for {@link DisclosureLog}. */
export interface DisclosureLogOptions {
  /** Continue an existing chain from this head. */
  readonly head?: LogHead;
  /** Use HMAC-SHA-256 with this key (at least 32 bytes) instead of plain SHA-256. */
  readonly hmacKey?: Uint8Array;
  /** Clock, for tests. */
  readonly now?: () => Date;
}

/**
 * Builds chained entries. Appends are serialised internally, so concurrent
 * calls never fork the chain. Persisting the lines is up to the caller (see
 * `@afkzona/telltale/node` for an append-only file writer).
 *
 * @example
 * ```ts
 * const log = new DisclosureLog();
 * const { line } = await log.append({
 *   event: 'shown', kind: 'chatbot', lang: 'en',
 *   textSha256: await sha256Hex(text), session: randomSessionPseudonym(),
 * });
 * ```
 */
export class DisclosureLog {
  #head: LogHead | null;
  readonly #key: Uint8Array | undefined;
  readonly #now: () => Date;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(options: DisclosureLogOptions = {}) {
    const { head, hmacKey, now } = ownProperties(options) as DisclosureLogOptions;
    if (head !== undefined) {
      if (!Number.isSafeInteger(head.seq) || head.seq < 0 || !HEX64.test(head.hash)) throw invalid('Invalid head.');
      this.#head = { seq: head.seq, hash: head.hash };
    } else {
      this.#head = null;
    }
    this.#key = hmacKey === undefined ? undefined : checkKey(hmacKey).slice();
    this.#now = now ?? (() => new Date());
  }

  /** The newest entry's position, or null for an empty log. */
  get head(): LogHead | null {
    return this.#head;
  }

  /** Validates, chains and returns the entry and its JSON line. */
  append(input: DisclosureLogInput): Promise<{ entry: DisclosureLogEntry; line: string }> {
    const run = this.#queue.then(() => this.#append(input));
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #append(raw: DisclosureLogInput): Promise<{ entry: DisclosureLogEntry; line: string }> {
    const input = validateInput(raw);
    const seq = this.#head === null ? 0 : this.#head.seq + 1;
    if (!Number.isSafeInteger(seq)) throw invalid('Sequence overflow.');
    const ts = input.ts ?? this.#now().toISOString();
    if (!validTimestamp(ts)) throw invalid('Clock returned an invalid time.');
    const alg: HashAlgorithm = this.#key ? 'hmac-sha256' : 'sha256';
    const unsigned: DisclosureLogEntry = {
      v: 1,
      alg,
      seq,
      ts,
      event: input.event,
      kind: input.kind,
      lang: input.lang,
      textSha256: input.textSha256,
      session: input.session,
      prev: this.#head?.hash ?? GENESIS_HASH,
      ...(input.surface === undefined ? {} : { surface: input.surface }),
      hash: '',
    };
    const hash = await entryHash(withoutHash(unsigned), this.#key);
    const entry: DisclosureLogEntry = { ...unsigned, hash };
    const line = serializeEntry(entry);
    if (line.length > MAX_LINE_LENGTH) throw invalid('Entry too long.');
    this.#head = { seq, hash };
    return { entry, line };
  }
}

/** A random session pseudonym (128 bits, base64url). Nothing links it to a person by itself. */
export function randomSessionPseudonym(): string {
  return toBase64Url(randomBytes(16));
}

/**
 * A stable pseudonym for a session id: HMAC-SHA-256 with a secret key,
 * truncated to 128 bits. Lets you correlate entries for one session without
 * storing the session id (often a bearer token). Delete or rotate the key to
 * make old pseudonyms unlinkable.
 */
export async function deriveSessionPseudonym(key: Uint8Array, sessionId: string): Promise<string> {
  if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 4096) {
    throw new TelltaleError('INVALID_OPTION', 'sessionId must be a non-empty string up to 4096 characters.');
  }
  return toBase64Url((await hmacSha256(key, `telltale-session:${sessionId}`)).slice(0, 16));
}

/** Result of {@link verifyDisclosureLog}. */
export type VerifyResult =
  | { readonly ok: true; readonly count: number; readonly head: LogHead | null }
  | { readonly ok: false; readonly line: number; readonly code: 'LOG_INVALID' | 'LOG_TAMPERED'; readonly reason: string };

/** Options for {@link verifyDisclosureLog}. */
export interface VerifyOptions {
  /** Head stored elsewhere; detects truncation and wholesale rewrites. */
  readonly expectedHead?: LogHead;
  /** Key for logs written with `hmacKey`. */
  readonly hmacKey?: Uint8Array;
  /** Maximum number of lines (default 10,000,000). */
  readonly maxLines?: number;
}

const ENTRY_KEYS = new Set(['v', 'alg', 'seq', 'ts', 'event', 'kind', 'lang', 'textSha256', 'session', 'surface', 'prev', 'hash']);

function parseLine(line: string): DisclosureLogEntry {
  if (line.length > MAX_LINE_LENGTH) throw invalid('Line too long.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw invalid('Not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw invalid('Not an object.');
  const o = ownProperties(parsed);
  for (const k of Object.keys(o)) if (!ENTRY_KEYS.has(k)) throw invalid('Unknown field.');
  if (o['v'] !== LOG_VERSION) throw invalid('Unsupported version.');
  if (o['alg'] !== 'sha256' && o['alg'] !== 'hmac-sha256') throw invalid('Unknown algorithm.');
  if (typeof o['seq'] !== 'number' || !Number.isSafeInteger(o['seq']) || o['seq'] < 0) throw invalid('Invalid seq.');
  if (!validTimestamp(o['ts'])) throw invalid('Invalid ts.');
  if (typeof o['prev'] !== 'string' || !HEX64.test(o['prev'])) throw invalid('Invalid prev.');
  if (typeof o['hash'] !== 'string' || !HEX64.test(o['hash'])) throw invalid('Invalid hash.');
  const input = validateInput({
    event: o['event'],
    kind: o['kind'],
    lang: o['lang'],
    textSha256: o['textSha256'],
    session: o['session'],
    ...(o['surface'] === undefined ? {} : { surface: o['surface'] }),
  });
  const entry: DisclosureLogEntry = {
    v: 1,
    alg: o['alg'],
    seq: o['seq'],
    ts: o['ts'],
    event: input.event,
    kind: input.kind,
    lang: input.lang,
    textSha256: input.textSha256,
    session: input.session,
    prev: o['prev'],
    hash: o['hash'],
    ...(input.surface === undefined ? {} : { surface: input.surface }),
  };
  if (serializeEntry(entry) !== line) throw invalid('Line is not in canonical form.');
  return entry;
}

/**
 * Verifies a whole log. Accepts the file content (lines separated by `\n`,
 * optional final newline) or an iterable of lines.
 */
export async function verifyDisclosureLog(input: string | Iterable<string>, options: VerifyOptions = {}): Promise<VerifyResult> {
  const opts = ownProperties(options) as VerifyOptions;
  const maxLines = opts.maxLines ?? 10_000_000;
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new TelltaleError('INVALID_OPTION', 'Invalid maxLines.');
  const key = opts.hmacKey === undefined ? undefined : checkKey(opts.hmacKey);
  let lines: Iterable<string>;
  if (typeof input === 'string') {
    const parts = input.split('\n');
    if (parts[parts.length - 1] === '') parts.pop();
    lines = parts;
  } else {
    lines = input;
  }
  let prev = GENESIS_HASH;
  let expectedSeq = 0;
  let alg: HashAlgorithm | null = null;
  let n = 0;
  for (const line of lines) {
    n += 1;
    if (n > maxLines) return { ok: false, line: n, code: 'LOG_INVALID', reason: 'Too many lines.' };
    let e: DisclosureLogEntry;
    try {
      e = parseLine(line);
    } catch (err) {
      if (err instanceof TelltaleError) return { ok: false, line: n, code: 'LOG_INVALID', reason: err.message };
      throw err;
    }
    alg ??= e.alg;
    if (e.alg !== alg) return { ok: false, line: n, code: 'LOG_TAMPERED', reason: 'Hash algorithm changed within the log.' };
    if (e.alg === 'hmac-sha256' && !key) return { ok: false, line: n, code: 'LOG_INVALID', reason: 'An HMAC key is required.' };
    if (e.alg === 'sha256' && key) return { ok: false, line: n, code: 'LOG_TAMPERED', reason: 'Expected an HMAC log.' };
    if (e.seq !== expectedSeq) return { ok: false, line: n, code: 'LOG_TAMPERED', reason: `Expected seq ${expectedSeq}.` };
    if (e.prev !== prev) return { ok: false, line: n, code: 'LOG_TAMPERED', reason: 'prev does not match the previous hash.' };
    const h = await entryHash(withoutHash(e), e.alg === 'hmac-sha256' ? key : undefined);
    if (!digestsEqual(h, e.hash)) return { ok: false, line: n, code: 'LOG_TAMPERED', reason: 'Entry hash does not match its content.' };
    prev = e.hash;
    expectedSeq += 1;
  }
  const head = n === 0 ? null : { seq: expectedSeq - 1, hash: prev };
  const want = opts.expectedHead;
  if (want !== undefined && (head?.seq !== want.seq || head.hash !== want.hash)) {
    return { ok: false, line: n, code: 'LOG_TAMPERED', reason: 'Log head does not match the expected head (truncated or rewritten).' };
  }
  return { ok: true, count: n, head };
}
