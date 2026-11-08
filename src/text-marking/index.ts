/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Machine-readable hints for AI-generated text on web pages.
 *
 * - JSON-LD with the schema.org `digitalSourceType` property
 *   (https://schema.org/digitalSourceType), whose values mirror the IPTC
 *   Digital Source Type NewsCodes.
 * - The `AI-Disclosure` HTTP response header as proposed in the individual
 *   Internet-Draft draft-abaris-aicdh-01. This is not an IETF standard and
 *   that draft expired on 3 August 2026; treat the header as an experimental hint.
 *
 * Neither marks the text itself. Copy-paste removes both. The Commission's
 * Code of Practice on Transparency of AI-Generated Content (Measure 1.1)
 * expects watermarking for free-form text, which this package does not do.
 *
 * @packageDocumentation
 */

import { TelltaleError } from '../errors.js';
import { ownProperties } from '../own.js';
import {
  isGenerativeDigitalSourceType,
  SCHEMA_ORG_DIGITAL_SOURCE,
  type GenerativeDigitalSourceType,
} from '../marking/digital-source-type.js';

/** schema.org CreativeWork types accepted by {@link jsonLdForAiContent}. */
export const JSON_LD_TYPES = [
  'CreativeWork',
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Report',
  'WebPage',
  'SocialMediaPosting',
  'MediaObject',
  'ImageObject',
  'VideoObject',
  'AudioObject',
] as const;

export type JsonLdType = (typeof JSON_LD_TYPES)[number];

/** A JSON-LD object describing AI-generated content. */
export interface AiContentJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': JsonLdType;
  readonly digitalSourceType: string;
}

/**
 * Builds a JSON-LD object stating the digital source type.
 *
 * @example
 * ```ts
 * jsonLdForAiContent({ type: 'NewsArticle' });
 * // { '@context': 'https://schema.org', '@type': 'NewsArticle',
 * //   digitalSourceType: 'https://schema.org/TrainedAlgorithmicMediaDigitalSource' }
 * ```
 */
export function jsonLdForAiContent(options: { type?: JsonLdType; digitalSourceType?: GenerativeDigitalSourceType } = {}): AiContentJsonLd {
  const own = ownProperties(options) as { type?: JsonLdType; digitalSourceType?: GenerativeDigitalSourceType };
  const type = own.type ?? 'CreativeWork';
  if (!(JSON_LD_TYPES as readonly string[]).includes(type)) throw new TelltaleError('INVALID_OPTION', 'Unsupported JSON-LD type.');
  const dst = own.digitalSourceType ?? 'trainedAlgorithmicMedia';
  if (!isGenerativeDigitalSourceType(dst)) throw new TelltaleError('INVALID_OPTION', 'digitalSourceType must be one of the generative AI codes.');
  return { '@context': 'https://schema.org', '@type': type, digitalSourceType: SCHEMA_ORG_DIGITAL_SOURCE[dst] };
}

/**
 * Serialises JSON for a `<script type="application/ld+json">` element.
 * `<`, `>`, `&`, U+2028 and U+2029 are escaped, so the content can never
 * close the script element or start a comment.
 */
export function jsonLdScriptText(value: unknown): string {
  // JSON.stringify returns undefined for some inputs despite its declared type.
  let json: unknown;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new TelltaleError('INVALID_OPTION', 'Value is not JSON-serialisable.');
  }
  if (typeof json !== 'string') throw new TelltaleError('INVALID_OPTION', 'Value is not JSON-serialisable.');
  return json.replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * Creates the script element with `textContent`. JSON-LD is a data block,
 * not executed, so `script-src 'self'` does not block it.
 */
export function createJsonLdScript(doc: Document, value: unknown): HTMLScriptElement {
  const s = doc.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = jsonLdScriptText(value);
  return s;
}

/** Values of `mode` in draft-abaris-aicdh-01, section 6. */
export const AI_DISCLOSURE_MODES = ['none', 'ai-modified', 'ai-originated', 'machine-generated'] as const;
export type AiDisclosureMode = (typeof AI_DISCLOSURE_MODES)[number];

export interface AiDisclosureHeaderOptions {
  readonly mode: AiDisclosureMode;
  readonly model?: string;
  readonly provider?: string;
  readonly reviewedBy?: string;
  /** Generation time; serialised as an RFC 9651 Date (whole seconds). */
  readonly date?: Date;
}

const MAX_HEADER_STRING = 256;

/** RFC 9651 sf-string: printable ASCII only, with `"` and `\` escaped. */
function sfString(name: string, v: unknown): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_HEADER_STRING || !/^[\x20-\x7e]*$/.test(v)) {
    throw new TelltaleError('INVALID_OPTION', `${name} must be 1-${MAX_HEADER_STRING} printable ASCII characters.`);
  }
  return `"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * Builds the experimental `AI-Disclosure` header (draft-abaris-aicdh-01) as an
 * RFC 9651 Dictionary. Header injection is impossible: only printable ASCII
 * is accepted, so CR and LF cannot appear.
 */
export function aiDisclosureHeader(options: AiDisclosureHeaderOptions): { readonly name: 'AI-Disclosure'; readonly value: string } {
  const raw: unknown = options;
  if (typeof raw !== 'object' || raw === null) throw new TelltaleError('INVALID_OPTION', 'Options must be an object.');
  const { mode, model, provider, reviewedBy, date } = ownProperties(raw) as Partial<AiDisclosureHeaderOptions>;
  if (typeof mode !== 'string' || !(AI_DISCLOSURE_MODES as readonly string[]).includes(mode)) throw new TelltaleError('INVALID_OPTION', 'Invalid mode.');
  const members = [`mode=${mode}`];
  if (model !== undefined) members.push(`model=${sfString('model', model)}`);
  if (provider !== undefined) members.push(`provider=${sfString('provider', provider)}`);
  if (reviewedBy !== undefined) members.push(`reviewed-by=${sfString('reviewedBy', reviewedBy)}`);
  if (date !== undefined) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TelltaleError('INVALID_OPTION', 'date must be a valid Date.');
    members.push(`date=@${Math.floor(date.getTime() / 1000)}`);
  }
  return { name: 'AI-Disclosure', value: members.join(', ') };
}
