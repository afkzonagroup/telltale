/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * References to the official text of Regulation (EU) 2024/1689 (the AI Act)
 * and Regulation (EU) 2026/1744 (Digital Omnibus on AI), as published on EUR-Lex.
 *
 * These constants exist so that every feature can point at the exact
 * provision it helps with. They are not legal advice.
 *
 * @packageDocumentation
 */

/** ELI link to Regulation (EU) 2024/1689, Official Journal version. */
export const AI_ACT_ELI = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj';

/** EUR-Lex HTML of Regulation (EU) 2024/1689 (English). Anchors such as `#art_50` work on this page. */
export const AI_ACT_HTML = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689';

/** ELI link to Regulation (EU) 2026/1744 (Digital Omnibus on AI), OJ L, 24.7.2026. */
export const DIGITAL_OMNIBUS_ELI = 'https://eur-lex.europa.eu/eli/reg/2026/1744/oj';

/** A provision of Article 50 that a toolkit feature relates to. */
export type Article50Paragraph = '50(1)' | '50(2)' | '50(3)' | '50(4) first subparagraph' | '50(4) second subparagraph' | '50(5)';

/** Link to Article 50 in the official English HTML. */
export const ARTICLE_50_URL = `${AI_ACT_HTML}#art_50`;

/**
 * Dates from the official text.
 *
 * - Article 113, second paragraph: the Regulation applies from 2 August 2026.
 *   Article 50 (Chapter IV) is not among the exceptions in Article 113, third paragraph.
 * - Article 111(4), added by Article 1, point (39)(b) of Regulation (EU) 2026/1744:
 *   providers of generative AI systems placed on the market before 2 August 2026
 *   must comply with Article 50(2) by 2 December 2026.
 */
export const DATES = {
  article50AppliesFrom: '2026-08-02',
  article50Paragraph2TransitionalDeadline: '2026-12-02',
} as const;
