/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Disclosure texts for Article 50 situations in the 24 official EU languages.
 *
 * Article 50 does not prescribe wording. English is written for this
 * project; every other language is a maintainers' translation marked
 * `source: "translation"` that needs native review. Nothing here is an
 * official EU text.
 *
 * @packageDocumentation
 */

import { TelltaleError } from '../errors.js';
import { ARTICLE_50_URL } from '../law.js';
import { PACKS } from './data.js';
import {
  DISCLOSURE_KINDS,
  EU_LANGUAGES,
  type DisclosureKind,
  type EuLanguage,
  type KindInfo,
  type LanguagePack,
  type TextSource,
  type UiStrings,
} from './types.js';

export { DISCLOSURE_KINDS, EU_LANGUAGES };
export type { DisclosureKind, DisclosureText, EuLanguage, KindInfo, LanguagePack, TextSource, UiStrings } from './types.js';

/** The provision each kind relates to. Links point to Article 50 on EUR-Lex. */
export const KIND_INFO: Readonly<Record<DisclosureKind, KindInfo>> = Object.freeze({
  chatbot: { article: '50(1)', actor: 'provider' },
  'deepfake-image': { article: '50(4) first subparagraph', actor: 'deployer' },
  'deepfake-audio': { article: '50(4) first subparagraph', actor: 'deployer' },
  'deepfake-video': { article: '50(4) first subparagraph', actor: 'deployer' },
  'deepfake-creative': { article: '50(4) first subparagraph', actor: 'deployer' },
  'public-interest-text': { article: '50(4) second subparagraph', actor: 'deployer' },
  'emotion-recognition': { article: '50(3)', actor: 'deployer' },
  'biometric-categorisation': { article: '50(3)', actor: 'deployer' },
});

const BY_LANG = new Map<string, LanguagePack>(PACKS.map((p) => [p.lang, p]));

export function isEuLanguage(value: unknown): value is EuLanguage {
  return typeof value === 'string' && (EU_LANGUAGES as readonly string[]).includes(value);
}

export function isDisclosureKind(value: unknown): value is DisclosureKind {
  return typeof value === 'string' && (DISCLOSURE_KINDS as readonly string[]).includes(value);
}

/**
 * Maps a BCP 47 tag such as `de-AT` or `pt_PT` to an EU language.
 * Unknown or missing tags fall back to `fallback` (default `en`).
 */
export function resolveLanguage(tag: unknown, fallback: EuLanguage = 'en'): EuLanguage {
  if (typeof tag !== 'string' || tag.length > 35) return fallback;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return isEuLanguage(primary) ? primary : fallback;
}

/** The language pack for a language. */
export function getLanguagePack(lang: EuLanguage): LanguagePack {
  const p = BY_LANG.get(lang);
  if (!p) throw new TelltaleError('INVALID_OPTION', 'Unknown language.');
  return p;
}

/** A resolved disclosure, ready to display and to log. */
export interface Disclosure {
  readonly kind: DisclosureKind;
  readonly lang: EuLanguage;
  readonly short: string;
  readonly long: string;
  readonly source: TextSource;
  readonly nativeReviewed: boolean;
  /** Provision this text helps with. */
  readonly article: KindInfo['article'];
  readonly actor: KindInfo['actor'];
  /** Link to Article 50 on EUR-Lex. */
  readonly articleUrl: string;
}

/**
 * Returns the short and long text for a situation in the requested language.
 *
 * @example
 * ```ts
 * const d = getDisclosure('chatbot', 'de-AT');
 * d.short; // "Sie chatten mit einem KI-System."
 * ```
 */
export function getDisclosure(kind: DisclosureKind, lang?: string): Disclosure {
  if (!isDisclosureKind(kind)) throw new TelltaleError('INVALID_OPTION', 'Unknown disclosure kind.');
  const resolved = resolveLanguage(lang);
  const p = getLanguagePack(resolved);
  const t = p.texts[kind];
  const info = KIND_INFO[kind];
  return {
    kind,
    lang: resolved,
    short: t.short,
    long: t.long,
    source: p.source,
    nativeReviewed: p.nativeReviewed,
    article: info.article,
    actor: info.actor,
    articleUrl: ARTICLE_50_URL,
  };
}

/** UI strings for the web components. */
export function getUiStrings(lang?: string): UiStrings {
  return getLanguagePack(resolveLanguage(lang)).ui;
}

/** Languages whose texts still need native review. */
export function languagesNeedingReview(): EuLanguage[] {
  return PACKS.filter((p) => !p.nativeReviewed && p.source === 'translation').map((p) => p.lang);
}
