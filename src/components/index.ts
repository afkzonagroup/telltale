/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web components `<ai-disclosure>` and `<ai-label>`.
 *
 * Importing this module has no side effects. Call
 * {@link defineTelltaleElements} once, or import `@afkzona/telltale/components/auto`.
 *
 * CSP: the components need no `unsafe-inline` and no `unsafe-eval`. They
 * work under `script-src 'self'; style-src 'self'` because styles are
 * applied with constructable stylesheets.
 *
 * @packageDocumentation
 */

import { AiDisclosureElement } from './ai-disclosure.js';
import { AiLabelElement } from './ai-label.js';

export { AiDisclosureElement, type DisclosureEventDetail } from './ai-disclosure.js';
export { AiLabelElement } from './ai-label.js';

export const DISCLOSURE_TAG = 'ai-disclosure';
export const LABEL_TAG = 'ai-label';

/**
 * Registers both elements. Safe to call more than once and safe on the
 * server (does nothing without `customElements`).
 */
export function defineTelltaleElements(registry?: CustomElementRegistry): void {
  const reg = registry ?? (typeof customElements === 'undefined' ? undefined : customElements);
  if (!reg) return;
  if (!reg.get(DISCLOSURE_TAG)) reg.define(DISCLOSURE_TAG, AiDisclosureElement);
  if (!reg.get(LABEL_TAG)) reg.define(LABEL_TAG, AiLabelElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-disclosure': AiDisclosureElement;
    'ai-label': AiLabelElement;
  }
}
