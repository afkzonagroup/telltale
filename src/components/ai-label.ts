/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDisclosure, getUiStrings, isDisclosureKind, type DisclosureKind } from '../texts/index.js';
import { adoptStyles, BaseElement, byPart, el, focusedPart, hostLanguage, nextId, overrideText } from './dom.js';
import { LABEL_CSS } from './styles.js';

const OBSERVED = ['kind', 'lang', 'text', 'long-text', 'compact', 'details'] as const;

/**
 * `<ai-label>`: a visible label for AI-generated or manipulated content,
 * for deep fakes (Article 50(4), first subparagraph) and AI-generated text
 * on matters of public interest (Article 50(4), second subparagraph).
 *
 * - The label text is its accessible name. With `compact`, only the badge is
 *   visible and the full text stays available to assistive technology.
 * - With `details`, the label becomes a button that opens a panel with the
 *   long text (WAI-ARIA disclosure pattern). Escape and a click outside close it.
 * - Put an official EU icon in the `icon` slot if you use one; the default is
 *   a text badge.
 *
 * Attributes: `kind` (default `deepfake-image`), `lang`, `text`, `long-text`,
 * `compact`, `details`, `align` (`end` opens the panel towards the start
 * edge, for labels placed at the end of a line or image).
 *
 * Event (bubbling, composed): `telltale-details-toggle` with `{ open: boolean }`.
 *
 * Parts: `label`, `badge`, `text`, `toggle`, `details`, `details-text`, `close`.
 */
export class AiLabelElement extends BaseElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED;
  }

  readonly #root: ShadowRoot;
  readonly #panelId = nextId('telltale-details');
  #open = false;
  #connected = false;
  #toggle: HTMLButtonElement | null = null;
  #panel: HTMLElement | null = null;
  readonly #onDocPointer = (e: Event): void => {
    if (!e.composedPath().includes(this)) this.close(false);
  };
  readonly #onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.#open) {
      e.stopPropagation();
      this.close(true);
    }
  };

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    adoptStyles(this.#root, LABEL_CSS);
  }

  get kind(): DisclosureKind {
    const k = this.getAttribute('kind');
    return isDisclosureKind(k) ? k : 'deepfake-image';
  }

  /** Reflects to the `kind` attribute (frameworks may set it as a property). */
  set kind(value: string) {
    this.setAttribute('kind', value);
  }

  /** True while the details panel is open. */
  get open(): boolean {
    return this.#open;
  }

  connectedCallback(): void {
    this.#connected = true;
    this.addEventListener('keydown', this.#onKey);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.removeEventListener('keydown', this.#onKey);
    this.ownerDocument.removeEventListener('pointerdown', this.#onDocPointer, true);
    this.#open = false;
  }

  attributeChangedCallback(): void {
    if (!this.hasAttribute('details')) this.#setOpen(false);
    if (this.#connected) this.#render();
  }

  /** Opens the details panel (needs the `details` attribute). */
  show(): void {
    if (!this.hasAttribute('details') || this.#open) return;
    this.#setOpen(true);
    this.#sync();
    this.#emitToggle();
  }

  /** Closes the details panel; with `returnFocus`, focus goes back to the label button. */
  close(returnFocus = true): void {
    if (!this.#open) return;
    // Move focus out of the panel before hiding it, so it is never lost.
    if (returnFocus || this.#panel?.contains(this.#root.activeElement) === true) this.#toggle?.focus();
    this.#setOpen(false);
    this.#sync();
    this.#emitToggle();
  }

  #setOpen(open: boolean): void {
    this.#open = open;
    const doc = this.ownerDocument;
    if (open) doc.addEventListener('pointerdown', this.#onDocPointer, true);
    else doc.removeEventListener('pointerdown', this.#onDocPointer, true);
  }

  #emitToggle(): void {
    this.dispatchEvent(new CustomEvent('telltale-details-toggle', { detail: { open: this.#open }, bubbles: true, composed: true }));
  }

  /** Updates open state in place, keeping the same elements (and focus). */
  #sync(): void {
    this.#toggle?.setAttribute('aria-expanded', String(this.#open));
    if (this.#panel) this.#panel.hidden = !this.#open;
  }

  #render(): void {
    const activePart = focusedPart(this.#root);
    const doc = this.ownerDocument;
    const lang = hostLanguage(this);
    const d = getDisclosure(this.kind, lang);
    const ui = getUiStrings(lang);
    const short = overrideText(this, 'text') ?? d.short;
    const long = overrideText(this, 'long-text') ?? d.long;
    const compact = this.hasAttribute('compact');
    const withDetails = this.hasAttribute('details');

    const label = el(doc, 'span', { part: 'label', class: compact ? 'label compact' : 'label', lang });
    const slot = el(doc, 'slot', { name: 'icon' });
    slot.append(el(doc, 'span', { part: 'badge', class: 'badge' }, ui.badge));
    const icon = el(doc, 'span', { 'aria-hidden': 'true', class: 'icon' });
    icon.append(slot);
    const text = el(doc, 'span', { part: 'text', class: compact ? 'text sr-only' : 'text' }, short);

    if (!withDetails) {
      this.#toggle = null;
      this.#panel = null;
      label.append(icon, text);
      this.#root.replaceChildren(label);
      return;
    }

    const toggle = el(doc, 'button', {
      part: 'toggle',
      class: 'toggle',
      type: 'button',
      'aria-expanded': String(this.#open),
      'aria-controls': this.#panelId,
    });
    toggle.append(icon, text);
    toggle.addEventListener('click', () => {
      if (this.#open) this.close(true);
      else this.show();
    });
    this.#toggle = toggle;
    label.append(toggle);

    const panel = el(doc, 'div', { part: 'details', class: 'details', id: this.#panelId, role: 'group', 'aria-label': short, lang });
    panel.append(el(doc, 'p', { part: 'details-text' }, long));
    const close = el(doc, 'button', { part: 'close', type: 'button' }, ui.close);
    close.addEventListener('click', () => {
      this.close(true);
    });
    panel.append(close);
    panel.hidden = !this.#open;
    this.#panel = panel;
    this.#root.replaceChildren(label, panel);
    // Attribute changes rebuild the tree; keep keyboard focus on the equivalent control.
    if (activePart !== null) byPart(this.#root, activePart)?.focus();
  }
}
