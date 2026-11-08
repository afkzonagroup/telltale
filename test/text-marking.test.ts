/**
 * @vitest-environment happy-dom
 */
/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import {
  aiDisclosureHeader,
  createJsonLdScript,
  jsonLdForAiContent,
  jsonLdScriptText,
  type AiDisclosureMode,
  type JsonLdType,
} from '../src/text-marking/index.js';

describe('JSON-LD', () => {
  it('maps the IPTC codes to schema.org members', () => {
    expect(jsonLdForAiContent()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      digitalSourceType: 'https://schema.org/TrainedAlgorithmicMediaDigitalSource',
    });
    expect(jsonLdForAiContent({ type: 'NewsArticle', digitalSourceType: 'compositeWithTrainedAlgorithmicMedia' }).digitalSourceType).toBe(
      'https://schema.org/CompositeWithTrainedAlgorithmicMediaDigitalSource',
    );
    expect(jsonLdForAiContent({ digitalSourceType: 'compositeSynthetic' }).digitalSourceType).toBe('https://schema.org/CompositeSyntheticDigitalSource');
  });

  it('rejects unknown types and codes', () => {
    expect(() => jsonLdForAiContent({ type: 'Person' as JsonLdType })).toThrow(TelltaleError);
    expect(() => jsonLdForAiContent({ digitalSourceType: 'digitalCapture' as 'compositeSynthetic' })).toThrow(TelltaleError);
  });

  it('escapes everything that could break out of a script element', () => {
    const hostile = { a: '</script><script>alert(1)</script>', b: '<!--', c: 'a&b', d: '\u2028\u2029' };
    const text = jsonLdScriptText(hostile);
    expect(text).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(text)).toEqual(hostile);
    expect(() => jsonLdScriptText(undefined)).toThrow(TelltaleError);
    expect(() => jsonLdScriptText({ n: 1n })).toThrow(TelltaleError);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => jsonLdScriptText(cyclic)).toThrow(TelltaleError);
  });

  it('creates a data-block script element through textContent', () => {
    const s = createJsonLdScript(document, { x: '</script><img src=x onerror=alert(1)>' });
    expect(s.type).toBe('application/ld+json');
    expect(s.children.length).toBe(0);
    expect(JSON.parse(s.textContent)).toEqual({ x: '</script><img src=x onerror=alert(1)>' });
  });
});

describe('AI-Disclosure header (experimental, draft-abaris-aicdh-01)', () => {
  it('serialises an RFC 9651 dictionary', () => {
    const h = aiDisclosureHeader({
      mode: 'machine-generated',
      model: 'example-model 1',
      provider: 'Example "Labs"\\',
      reviewedBy: 'desk',
      date: new Date('2026-08-02T00:00:00.999Z'),
    });
    expect(h.name).toBe('AI-Disclosure');
    expect(h.value).toBe('mode=machine-generated, model="example-model 1", provider="Example \\"Labs\\"\\\\", reviewed-by="desk", date=@1785628800');
    expect(aiDisclosureHeader({ mode: 'none' }).value).toBe('mode=none');
  });

  it('cannot be used for header injection', () => {
    for (const bad of ['a\r\nSet-Cookie: x=1', 'a\nb', 'café', '', 'x'.repeat(257)]) {
      expect(() => aiDisclosureHeader({ mode: 'ai-modified', model: bad })).toThrow(TelltaleError);
    }
  });

  it('validates mode and date', () => {
    expect(() => aiDisclosureHeader({ mode: 'mostly-ai' as AiDisclosureMode })).toThrow(TelltaleError);
    expect(() => aiDisclosureHeader({ mode: 'none', date: new Date(Number.NaN) })).toThrow(TelltaleError);
    expect(() => aiDisclosureHeader(null as unknown as { mode: 'none' })).toThrow(TelltaleError);
  });
});
