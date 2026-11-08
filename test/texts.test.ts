/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/texts/data.js';
import {
  DISCLOSURE_KINDS,
  EU_LANGUAGES,
  getDisclosure,
  getLanguagePack,
  getUiStrings,
  KIND_INFO,
  languagesNeedingReview,
  resolveLanguage,
  type DisclosureKind,
  type EuLanguage,
} from '../src/texts/index.js';
import { TelltaleError } from '../src/errors.js';

describe('language packs', () => {
  it('cover exactly the 24 official EU languages', () => {
    expect(EU_LANGUAGES).toHaveLength(24);
    expect(PACKS.map((p) => p.lang).sort()).toEqual([...EU_LANGUAGES].sort());
  });

  it('mark English as authored and every other language as an unreviewed translation', () => {
    for (const p of PACKS) {
      expect(p.nativeReviewed).toBe(false);
      expect(p.source).toBe(p.lang === 'en' ? 'authored' : 'translation');
    }
    expect(languagesNeedingReview()).toHaveLength(23);
    expect(languagesNeedingReview()).not.toContain('en');
  });

  it('have every kind with clean, bounded text and no markup', () => {
    for (const p of PACKS) {
      expect(Object.keys(p.texts).sort()).toEqual([...DISCLOSURE_KINDS].sort());
      for (const k of DISCLOSURE_KINDS) {
        const t = p.texts[k];
        for (const s of [t.short, t.long]) {
          expect(s.trim()).toBe(s);
          expect(s).not.toMatch(/[<>{}\\]|\s\s|\.\./);
        }
        expect(t.short.length).toBeGreaterThan(5);
        expect(t.short.length).toBeLessThanOrEqual(70);
        expect(t.long.length).toBeGreaterThan(t.short.length);
        expect(t.long.length).toBeLessThanOrEqual(320);
        expect(t.long).toMatch(/[.!]$/);
      }
      for (const v of [p.ui.badge, p.ui.region, p.ui.hide, p.ui.more, p.ui.close]) {
        expect(v.length).toBeGreaterThan(0);
        expect(v.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('do not repeat the same text across kinds within a language', () => {
    for (const p of PACKS) {
      const shorts = DISCLOSURE_KINDS.map((k) => p.texts[k].short);
      expect(new Set(shorts).size).toBe(shorts.length);
    }
  });

  it('are frozen', () => {
    const p = getLanguagePack('en');
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.texts)).toBe(true);
    expect(Object.isFrozen(p.texts.chatbot)).toBe(true);
  });
});

describe('getDisclosure', () => {
  it('returns text plus the legal reference', () => {
    const d = getDisclosure('chatbot', 'en');
    expect(d).toMatchObject({ kind: 'chatbot', lang: 'en', article: '50(1)', actor: 'provider', source: 'authored' });
    expect(d.short).toBe('You are chatting with an AI system.');
    expect(d.articleUrl).toBe('https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689#art_50');
  });

  it('maps every kind to the right paragraph', () => {
    const expected: Record<DisclosureKind, string> = {
      chatbot: '50(1)',
      'deepfake-image': '50(4) first subparagraph',
      'deepfake-audio': '50(4) first subparagraph',
      'deepfake-video': '50(4) first subparagraph',
      'deepfake-creative': '50(4) first subparagraph',
      'public-interest-text': '50(4) second subparagraph',
      'emotion-recognition': '50(3)',
      'biometric-categorisation': '50(3)',
    };
    for (const k of DISCLOSURE_KINDS) expect(KIND_INFO[k].article).toBe(expected[k]);
  });

  it('resolves regional tags and falls back to English', () => {
    expect(getDisclosure('deepfake-image', 'de-AT').lang).toBe('de');
    expect(getDisclosure('deepfake-image', 'pt_PT').lang).toBe('pt');
    expect(getDisclosure('deepfake-image', 'LT').lang).toBe('lt');
    expect(getDisclosure('deepfake-image', 'ja').lang).toBe('en');
    expect(getDisclosure('deepfake-image').lang).toBe('en');
    expect(resolveLanguage('x'.repeat(100))).toBe('en');
    expect(resolveLanguage(42)).toBe('en');
    expect(resolveLanguage('zz', 'fr')).toBe('fr');
  });

  it('rejects unknown kinds and languages', () => {
    expect(() => getDisclosure('__proto__' as DisclosureKind)).toThrow(TelltaleError);
    expect(() => getLanguagePack('xx' as EuLanguage)).toThrow(TelltaleError);
  });

  it('returns UI strings', () => {
    expect(getUiStrings('de').badge).toBe('KI');
    expect(getUiStrings().hide).toBe('Hide notice');
  });
});
