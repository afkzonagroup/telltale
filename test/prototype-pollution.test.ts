/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Options are read only from the caller's own properties. A polluted
 * Object.prototype (for example by another library) must not switch on
 * C2PA invalidation, add log fields or change limits.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aiDisclosureHeader, DisclosureLog, jsonLdForAiContent, markImage, readImageMarking, sha256Hex, verifyDisclosureLog } from '../src/index.js';
import { VECTOR_ROOT } from './helpers/vectors.js';

const proto = Object.prototype as Record<string, unknown>;
const polluted: string[] = [];
function pollute(key: string, value: unknown): void {
  proto[key] = value;
  polluted.push(key);
}

afterEach(() => {
  for (const k of polluted.splice(0)) Reflect.deleteProperty(proto, k);
});

const fixture = (n: string): Uint8Array => new Uint8Array(readFileSync(join(VECTOR_ROOT, 'fixtures', n)));

describe('prototype pollution', () => {
  it('does not let an inherited allowC2paInvalidation or existingXmp through', () => {
    pollute('allowC2paInvalidation', true);
    pollute('existingXmp', 'replace');
    expect(() => markImage(fixture('png-c2pa.png'), {})).toThrow(expect.objectContaining({ code: 'C2PA_PRESENT' }));
    expect(markImage(fixture('png-with-xmp.png')).action).toBe('merged');
  });

  it('does not let an inherited maxInputBytes through', () => {
    pollute('maxInputBytes', 10);
    expect(readImageMarking(fixture('basic.png'), {}).format).toBe('png');
    expect(markImage(fixture('basic.png'), {}).action).toBe('inserted');
  });

  it('does not add inherited fields to log entries', async () => {
    pollute('surface', 'polluted');
    pollute('email', 'person@example.com');
    const log = new DisclosureLog({});
    const { entry, line } = await log.append({
      event: 'shown',
      kind: 'chatbot',
      lang: 'en',
      textSha256: await sha256Hex('x'),
      session: 'abcdefghijklmnop',
    });
    expect(Object.keys(entry)).not.toContain('surface');
    expect(line).not.toContain('polluted');
    expect(await verifyDisclosureLog(line, {})).toMatchObject({ ok: true });
  });

  it('does not let an inherited expectedHead or maxLines change verification', async () => {
    pollute('expectedHead', { seq: 99, hash: '0'.repeat(64) });
    pollute('maxLines', 0);
    expect(await verifyDisclosureLog('', {})).toMatchObject({ ok: true, count: 0 });
  });

  it('ignores inherited values in the text helpers', () => {
    pollute('model', 'polluted');
    pollute('type', 'NotAType');
    expect(aiDisclosureHeader({ mode: 'none' }).value).toBe('mode=none');
    expect(jsonLdForAiContent({})['@type']).toBe('CreativeWork');
  });
});
