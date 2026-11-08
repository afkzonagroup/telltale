/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * DOM helpers shared by the components. All text goes through
 * `textContent`; no HTML strings are ever parsed.
 */

import { resolveLanguage, type EuLanguage } from '../texts/index.js';

/** A base class that also exists outside the browser, so importing never throws during SSR. */
export const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined'
    ? (function ServerStub(): never {
        throw new Error('Telltale elements need a browser DOM.');
      } as unknown as typeof HTMLElement)
    : HTMLElement;

/** Longest text accepted from the `text` / `long-text` attributes. */
export const MAX_OVERRIDE_LENGTH = 1000;

/** Creates an element with optional attributes and text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

const sheets = new Map<string, CSSStyleSheet>();

/**
 * Applies CSS through a constructable stylesheet. Constructable stylesheets
 * work under `style-src 'self'` because no inline `<style>` element or
 * `style` attribute is created. Where unsupported, the component stays
 * functional but unstyled.
 */
export function adoptStyles(root: ShadowRoot, css: string): boolean {
  if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in root)) return false;
  let sheet = sheets.get(css);
  if (!sheet) {
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
    } catch {
      return false;
    }
    sheets.set(css, sheet);
  }
  root.adoptedStyleSheets = [sheet];
  return true;
}

/** Text from an override attribute, trimmed and bounded, or null. */
export function overrideText(host: Element, name: string): string | null {
  const v = host.getAttribute(name);
  if (v === null) return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length > MAX_OVERRIDE_LENGTH ? t.slice(0, MAX_OVERRIDE_LENGTH) : t;
}

/** Language from the element, its nearest ancestor with `lang`, or the document. */
export function hostLanguage(host: Element): EuLanguage {
  const own = host.getAttribute('lang');
  if (own) return resolveLanguage(own);
  const anc = host.parentElement?.closest('[lang]');
  const tag = anc?.getAttribute('lang') ?? host.ownerDocument.documentElement.getAttribute('lang');
  return resolveLanguage(tag);
}

let idCounter = 0;
/** A document-unique id for ARIA references inside a shadow root. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Session storage access that never throws (private mode, blocked storage). */
export function sessionGet(key: string): string | null {
  try {
    return globalThis.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function sessionSet(key: string, value: string): void {
  try {
    globalThis.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the notice simply shows again next time.
  }
}

/** The `part` of the focused element inside a shadow root, or null. */
export function focusedPart(root: ShadowRoot): string | null {
  try {
    return root.activeElement?.getAttribute('part') ?? null;
  } catch {
    // Some non-browser DOM implementations throw when the previously focused node was removed.
    return null;
  }
}

/** Finds the element with exactly this `part` value without building a selector string. */
export function byPart(root: ShadowRoot, part: string): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>('[part]')) {
    if (node.getAttribute('part') === part) return node;
  }
  return null;
}
