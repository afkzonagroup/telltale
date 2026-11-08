/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDisclosure, getUiStrings, isDisclosureKind, type DisclosureKind, type EuLanguage } from '../texts/index.js';
import { adoptStyles, BaseElement, byPart, el, focusedPart, hostLanguage, overrideText, sessionGet, sessionSet } from './dom.js';
import { DISCLOSURE_CSS } from './styles.js';

/** Detail of the `telltale-shown`, `telltale-dismissed` and `telltale-expanded` events. */
export interface DisclosureEventDetail {
  readonly kind: DisclosureKind;
  readonly lang: EuLanguage;
  /** Which text was on screen: the full notice or the short label. */
  readonly variant: 'long' | 'short';
  /** The exact text shown, so it can be hashed into a disclosure log. */
  readonly text: string;
}

const OBSERVED = ['kind', 'lang', 'text', 'long-text', 'dismissible', 'remember', 'announce'] as const;

/**
 * `<ai-disclosure>`: the notice that a person is interacting with an AI
 * system (AI Act Article 50(1), information per Article 50(5)).
 *
 * - Shows the full notice when it is connected, so it is visible no later
 *   than the first interaction.
 * - Can be hidden only when the `dismissible` attribute is present. Hidden
 *   means collapsed to a persistent short label, never removed.
 * - `remember="session"` keeps it collapsed for the browser session.
 * - `announce` makes the notice a polite live region, for chat widgets that
 *   open after page load.
 *
 * Attributes: `kind` (default `chatbot`), `lang`, `text` (short label),
 * `long-text` (notice), `dismissible`, `remember`, `announce`.
 *
 * Events (bubbling, composed): `telltale-shown`, `telltale-dismissed`,
 * `telltale-expanded`, each with a {@link DisclosureEventDetail}.
 *
 * Parts: `notice`, `notice-text`, `hide`, `mini`, `badge`, `mini-text`, `expand`.
 */
export class AiDisclosureElement extends BaseElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED;
  }

  readonly #root: ShadowRoot;
  #collapsed = false;
  #shownOnce = false;
  #connected = false;
  #announced = false;
  #lastShown: DisclosureEventDetail | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    adoptStyles(this.#root, DISCLOSURE_CSS);
  }

  /** The disclosure kind in use (invalid values fall back to `chatbot`). */
  get kind(): DisclosureKind {
    const k = this.getAttribute('kind');
    return isDisclosureKind(k) ? k : 'chatbot';
  }

  /** Reflects to the `kind` attribute (frameworks may set it as a property). */
  set kind(value: string) {
    this.setAttribute('kind', value);
  }

  /** True while the full notice is collapsed to the short label. */
  get collapsed(): boolean {
    return this.#collapsed;
  }

  connectedCallback(): void {
    this.#connected = true;
    if (this.hasAttribute('dismissible') && this.getAttribute('remember') === 'session' && sessionGet(this.#storageKey()) === '1') {
      this.#collapsed = true;
    }
    this.#render(false);
    if (!this.#shownOnce) {
      this.#shownOnce = true;
      // Dispatched in a microtask so listeners attached right after insertion
      // (including by React and Vue wrappers) still receive it.
      queueMicrotask(() => {
        if (this.isConnected) this.#emit('telltale-shown');
        else this.#shownOnce = false;
      });
    }
  }

  disconnectedCallback(): void {
    this.#connected = false;
  }

  attributeChangedCallback(): void {
    if (!this.hasAttribute('dismissible')) this.#collapsed = false;
    if (this.#connected) this.#render(false);
  }

  /** Collapses the notice to the short label. Ignored unless `dismissible` is set. */
  dismiss(): void {
    if (!this.hasAttribute('dismissible') || this.#collapsed) return;
    this.#collapsed = true;
    if (this.getAttribute('remember') === 'session') sessionSet(this.#storageKey(), '1');
    this.#render(true);
    this.#emit('telltale-dismissed');
  }

  /** Shows the full notice again. */
  expand(): void {
    if (!this.#collapsed) return;
    this.#collapsed = false;
    this.#render(true);
    this.#emit('telltale-expanded');
  }

  #storageKey(): string {
    return `telltale:dismissed:${this.kind}`;
  }

  #texts(): { lang: EuLanguage; short: string; long: string } {
    const lang = hostLanguage(this);
    const d = getDisclosure(this.kind, lang);
    return { lang, short: overrideText(this, 'text') ?? d.short, long: overrideText(this, 'long-text') ?? d.long };
  }

  /** Detail of the last `telltale-shown` event, or null before it fired. */
  get lastShown(): DisclosureEventDetail | null {
    return this.#lastShown;
  }

  #emit(type: 'telltale-shown' | 'telltale-dismissed' | 'telltale-expanded'): void {
    const t = this.#texts();
    const detail: DisclosureEventDetail = {
      kind: this.kind,
      lang: t.lang,
      variant: this.#collapsed ? 'short' : 'long',
      text: this.#collapsed ? t.short : t.long,
    };
    if (type === 'telltale-shown') this.#lastShown = detail;
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  #render(moveFocus: boolean): void {
    const activePart = focusedPart(this.#root);
    const doc = this.ownerDocument;
    const t = this.#texts();
    const ui = getUiStrings(t.lang);
    const dismissible = this.hasAttribute('dismissible');

    const notice = el(doc, 'section', { part: 'notice', class: 'notice', 'aria-label': ui.region });
    if (this.hasAttribute('announce')) notice.setAttribute('role', 'status');
    const noticeText = el(doc, 'p', { part: 'notice-text' }, t.long);
    if (this.hasAttribute('announce') && !this.#announced && !this.#collapsed) {
      // A live region announces changes, not initial content: create it empty, fill it shortly after.
      this.#announced = true;
      noticeText.textContent = '';
      setTimeout(() => {
        noticeText.textContent = t.long;
      }, 100);
    }
    notice.append(noticeText);
    let hide: HTMLButtonElement | null = null;
    if (dismissible) {
      hide = el(doc, 'button', { part: 'hide', type: 'button' }, ui.hide);
      hide.addEventListener('click', () => {
        this.dismiss();
      });
      notice.append(hide);
    }

    const mini = el(doc, 'div', { part: 'mini', class: 'mini', role: 'group', 'aria-label': ui.region });
    const badge = el(doc, 'span', { part: 'badge', class: 'badge', 'aria-hidden': 'true' }, ui.badge);
    const miniText = el(doc, 'span', { part: 'mini-text', class: 'text' }, t.short);
    const expand = el(doc, 'button', { part: 'expand', type: 'button', 'aria-expanded': 'false' }, ui.more);
    expand.addEventListener('click', () => {
      this.expand();
    });
    mini.append(badge, miniText, expand);

    notice.hidden = this.#collapsed;
    mini.hidden = !this.#collapsed;
    this.#root.replaceChildren(notice, mini);
    if (moveFocus) {
      if (this.#collapsed) expand.focus();
      else hide?.focus();
    } else if (activePart !== null) {
      // Attribute changes rebuild the tree; keep keyboard focus on the equivalent control if it is still visible.
      const again = byPart(this.#root, activePart);
      if (again?.closest('[hidden]') === null) again.focus();
    }
  }
}
