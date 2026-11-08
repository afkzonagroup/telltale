/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Article50Paragraph } from '../law.js';

/** The 24 official languages of the EU (ISO 639-1). */
export const EU_LANGUAGES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

export type EuLanguage = (typeof EU_LANGUAGES)[number];

/** Situations covered by the text set. */
export const DISCLOSURE_KINDS = [
  'chatbot',
  'deepfake-image',
  'deepfake-audio',
  'deepfake-video',
  'deepfake-creative',
  'public-interest-text',
  'emotion-recognition',
  'biometric-categorisation',
] as const;

export type DisclosureKind = (typeof DISCLOSURE_KINDS)[number];

/** A short label and a longer notice for one situation. */
export interface DisclosureText {
  /** One line, suitable for a badge or persistent label. */
  readonly short: string;
  /** One to three sentences, suitable for a first-interaction notice or details panel. */
  readonly long: string;
}

/** Strings used by the web components. */
export interface UiStrings {
  /** Very short mark such as "AI". */
  readonly badge: string;
  /** Accessible name of the notice region. */
  readonly region: string;
  /** Button that collapses the notice to the persistent label. */
  readonly hide: string;
  /** Button that opens details. */
  readonly more: string;
  /** Button that closes details. */
  readonly close: string;
}

/**
 * Where the wording comes from.
 * - `authored`: written for this project in English. Article 50 prescribes no wording.
 * - `translation`: translated by the maintainers, not an official text; needs native review.
 */
export type TextSource = 'authored' | 'translation';

export interface LanguagePack {
  readonly lang: EuLanguage;
  readonly source: TextSource;
  /** True only after a native speaker has reviewed the pack. */
  readonly nativeReviewed: boolean;
  readonly texts: Readonly<Record<DisclosureKind, DisclosureText>>;
  readonly ui: UiStrings;
}

/** Which provision a kind relates to, and who carries the obligation. */
export interface KindInfo {
  readonly article: Article50Paragraph;
  readonly actor: 'provider' | 'deployer';
}
