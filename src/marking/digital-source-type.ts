/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IPTC Digital Source Type NewsCodes.
 * Source: https://cv.iptc.org/newscodes/digitalsourcetype/ (checked 8 Nov 2026).
 *
 * The writer accepts only the three codes whose IPTC names refer to
 * generative AI:
 * - `trainedAlgorithmicMedia`: "Created using Generative AI"
 * - `compositeWithTrainedAlgorithmicMedia`: "Edited using Generative AI"
 * - `compositeSynthetic`: "Composite including generative AI elements"
 */
export const IPTC_DIGITAL_SOURCE_TYPE_SCHEME = 'http://cv.iptc.org/newscodes/digitalsourcetype/';

/** XMP namespace of the IPTC Extension schema (IPTC Photo Metadata Standard 2025.1, section 10). */
export const IPTC_EXT_NS = 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/';

/** RDF namespace. */
export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

/** Digital source types that the writer may record. */
export const GENERATIVE_DIGITAL_SOURCE_TYPES = [
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'compositeSynthetic',
] as const;

export type GenerativeDigitalSourceType = (typeof GENERATIVE_DIGITAL_SOURCE_TYPES)[number];

/** Full NewsCodes URI for a code. */
export function digitalSourceTypeUri(code: GenerativeDigitalSourceType): string {
  return IPTC_DIGITAL_SOURCE_TYPE_SCHEME + code;
}

/** schema.org enumeration members for the same codes (https://schema.org/IPTCDigitalSourceEnumeration). */
export const SCHEMA_ORG_DIGITAL_SOURCE: Readonly<Record<GenerativeDigitalSourceType, string>> = {
  trainedAlgorithmicMedia: 'https://schema.org/TrainedAlgorithmicMediaDigitalSource',
  compositeWithTrainedAlgorithmicMedia: 'https://schema.org/CompositeWithTrainedAlgorithmicMediaDigitalSource',
  compositeSynthetic: 'https://schema.org/CompositeSyntheticDigitalSource',
};

/** True for a NewsCodes URI that names one of the generative AI codes. */
export function isGenerativeDigitalSourceTypeUri(uri: string): boolean {
  return (GENERATIVE_DIGITAL_SOURCE_TYPES as readonly string[]).some((c) => IPTC_DIGITAL_SOURCE_TYPE_SCHEME + c === uri);
}

export function isGenerativeDigitalSourceType(value: unknown): value is GenerativeDigitalSourceType {
  return typeof value === 'string' && (GENERATIVE_DIGITAL_SOURCE_TYPES as readonly string[]).includes(value);
}
