/**
 * @vitest-environment happy-dom
 */
/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineTelltaleElements, type AiDisclosureElement, type AiLabelElement, type DisclosureEventDetail } from '../src/components/index.js';
import { EU_LANGUAGES, getDisclosure, getUiStrings } from '../src/texts/index.js';

const XSS = [
  '<img src=x onerror="globalThis.__pwned=1">',
  '<script>globalThis.__pwned=1</script>',
  '"><svg onload="globalThis.__pwned=1">',
  // eslint-disable-next-line no-script-url -- hostile input under test, never executed
  'javascript:globalThis.__pwned=1',
  '{{constructor.constructor("globalThis.__pwned=1")()}}',
];

beforeAll(() => {
  defineTelltaleElements();
  defineTelltaleElements(); // idempotent
});

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

function mount<T extends HTMLElement>(html: (doc: Document) => T): T {
  const node = html(document);
  document.body.append(node);
  return node;
}

function disclosure(attrs: Record<string, string> = {}): AiDisclosureElement {
  return mount((doc) => {
    const e = doc.createElement('ai-disclosure');
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  });
}

function label(attrs: Record<string, string> = {}): AiLabelElement {
  return mount((doc) => {
    const e = doc.createElement('ai-label');
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  });
}

const q = (e: Element, part: string): HTMLElement => {
  const found = e.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`);
  if (!found) throw new Error(`part ${part} missing`);
  return found;
};

function assertNoActiveContent(root: ShadowRoot): void {
  expect(root.querySelectorAll('script, img, svg, iframe, object, embed, style, link').length).toBe(0);
  for (const node of root.querySelectorAll('*')) {
    expect(node.hasAttribute('style')).toBe(false);
    for (const a of Array.from(node.attributes)) expect(a.name.startsWith('on')).toBe(false);
  }
  expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined();
}

describe('<ai-disclosure>', () => {
  it('shows the full chatbot notice when connected, in a named region', () => {
    const e = disclosure();
    const notice = q(e, 'notice');
    expect(notice.hidden).toBe(false);
    expect(notice.getAttribute('aria-label')).toBe('AI disclosure');
    expect(q(e, 'notice-text').textContent).toBe(getDisclosure('chatbot', 'en').long);
    expect(q(e, 'mini').hidden).toBe(true);
    expect(e.shadowRoot!.querySelector('[part="hide"]')).toBeNull();
  });

  it('uses a constructable stylesheet and no inline styles', () => {
    const e = disclosure({ dismissible: '' });
    expect(e.shadowRoot!.adoptedStyleSheets.length).toBe(1);
    assertNoActiveContent(e.shadowRoot!);
  });

  it('cannot be dismissed unless configured', () => {
    const e = disclosure();
    e.dismiss();
    expect(e.collapsed).toBe(false);
    expect(q(e, 'notice').hidden).toBe(false);
  });

  it('collapses to a persistent label when dismissible, and moves focus sensibly', () => {
    const e = disclosure({ dismissible: '' });
    const events: string[] = [];
    e.addEventListener('telltale-dismissed', () => events.push('dismissed'));
    e.addEventListener('telltale-expanded', () => events.push('expanded'));
    q(e, 'hide').click();
    expect(e.collapsed).toBe(true);
    expect(q(e, 'notice').hidden).toBe(true);
    const mini = q(e, 'mini');
    expect(mini.hidden).toBe(false);
    expect(q(e, 'mini-text').textContent).toBe(getDisclosure('chatbot', 'en').short);
    expect(q(e, 'badge').getAttribute('aria-hidden')).toBe('true');
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'expand'));
    q(e, 'expand').click();
    expect(e.collapsed).toBe(false);
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'hide'));
    expect(events).toEqual(['dismissed', 'expanded']);
  });

  it('re-expands when dismissible is removed', () => {
    const e = disclosure({ dismissible: '' });
    e.dismiss();
    e.removeAttribute('dismissible');
    expect(e.collapsed).toBe(false);
    expect(q(e, 'notice').hidden).toBe(false);
  });

  it('emits telltale-shown once, after insertion, with the exact text', async () => {
    const e = disclosure({ lang: 'de' });
    const seen: DisclosureEventDetail[] = [];
    // A listener attached synchronously after insertion still receives the event.
    e.addEventListener('telltale-shown', (ev) => seen.push((ev as CustomEvent<DisclosureEventDetail>).detail));
    await Promise.resolve();
    e.remove();
    document.body.append(e);
    await Promise.resolve();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ kind: 'chatbot', lang: 'de', variant: 'long', text: getDisclosure('chatbot', 'de').long });
    expect(e.lastShown).toEqual(seen[0]);
  });

  it('does not report shown for an element removed before the microtask, and reports it once re-attached', async () => {
    const e = disclosure();
    const seen: unknown[] = [];
    e.addEventListener('telltale-shown', (ev) => seen.push(ev));
    e.remove();
    await Promise.resolve();
    expect(seen).toHaveLength(0);
    expect(e.lastShown).toBeNull();
    document.body.append(e);
    await Promise.resolve();
    expect(seen).toHaveLength(1);
  });

  it('remembers dismissal for the session only when asked', () => {
    disclosure({ dismissible: '', remember: 'session' }).dismiss();
    expect(sessionStorage.getItem('telltale:dismissed:chatbot')).toBe('1');
    expect(disclosure({ dismissible: '', remember: 'session' }).collapsed).toBe(true);
    expect(disclosure({ dismissible: '' }).collapsed).toBe(false);
    // Without dismissible, a stored flag is ignored.
    expect(disclosure({ remember: 'session' }).collapsed).toBe(false);
  });

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const e = disclosure({ dismissible: '', remember: 'session' });
    expect(() => {
      e.dismiss();
    }).not.toThrow();
    expect(e.collapsed).toBe(true);
  });

  it('takes the language from the nearest ancestor and the document', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('lang', 'fr-BE');
    document.body.append(wrap);
    const e = document.createElement('ai-disclosure');
    wrap.append(e);
    expect(q(e, 'notice-text').textContent).toBe(getDisclosure('chatbot', 'fr').long);
    document.documentElement.setAttribute('lang', 'pl');
    const f = disclosure();
    expect(q(f, 'notice-text').textContent).toBe(getDisclosure('chatbot', 'pl').long);
    document.documentElement.removeAttribute('lang');
  });

  it('renders every EU language', () => {
    for (const lang of EU_LANGUAGES) {
      const e = disclosure({ lang, dismissible: '' });
      expect(q(e, 'notice-text').textContent).toBe(getDisclosure('chatbot', lang).long);
      expect(q(e, 'hide').textContent).toBe(getUiStrings(lang).hide);
    }
  });

  it('reflects the kind property to the attribute (React and Vue set properties)', () => {
    const e = disclosure();
    e.kind = 'biometric-categorisation';
    expect(e.getAttribute('kind')).toBe('biometric-categorisation');
    expect(q(e, 'notice-text').textContent).toBe(getDisclosure('biometric-categorisation', 'en').long);
    const l = label();
    l.kind = 'deepfake-audio';
    expect(q(l, 'text').textContent).toBe(getDisclosure('deepfake-audio', 'en').short);
  });

  it('supports the Article 50(3) kinds and falls back to chatbot for unknown kinds', () => {
    expect(q(disclosure({ kind: 'emotion-recognition' }), 'notice-text').textContent).toBe(getDisclosure('emotion-recognition', 'en').long);
    expect(q(disclosure({ kind: '<b>x</b>' }), 'notice-text').textContent).toBe(getDisclosure('chatbot', 'en').long);
  });

  it('treats XSS strings in every attribute as text', () => {
    for (const s of XSS) {
      const e = disclosure({ text: s, 'long-text': s, kind: s, lang: s, remember: s, dismissible: s, announce: '' });
      e.dismiss();
      expect(q(e, 'mini-text').textContent).toBe(s);
      expect(q(e, 'notice-text').textContent === s || q(e, 'notice-text').textContent === '').toBe(true);
      assertNoActiveContent(e.shadowRoot!);
    }
  });

  it('bounds override text length', () => {
    const e = disclosure({ 'long-text': 'x'.repeat(5000) });
    expect(q(e, 'notice-text').textContent).toHaveLength(1000);
    expect(q(disclosure({ text: '   ' , dismissible: ''}), 'mini-text').textContent).toBe(getDisclosure('chatbot', 'en').short);
  });

  it('announces through a live region when asked', async () => {
    vi.useFakeTimers();
    const e = disclosure({ announce: '' });
    expect(q(e, 'notice').getAttribute('role')).toBe('status');
    expect(q(e, 'notice-text').textContent).toBe('');
    await vi.advanceTimersByTimeAsync(150);
    expect(q(e, 'notice-text').textContent).toBe(getDisclosure('chatbot', 'en').long);
    vi.useRealTimers();
  });
});

describe('<ai-label>', () => {
  it('shows the short text as its accessible content', () => {
    const e = label();
    expect(q(e, 'text').textContent).toBe(getDisclosure('deepfake-image', 'en').short);
    expect(q(e, 'text').classList.contains('sr-only')).toBe(false);
    expect(q(e, 'badge').textContent).toBe('AI');
    expect(e.shadowRoot!.querySelector('button')).toBeNull();
    expect(e.shadowRoot!.adoptedStyleSheets.length).toBe(1);
  });

  it('keeps the full text for assistive technology in compact mode', () => {
    const e = label({ compact: '', kind: 'deepfake-video', lang: 'lt' });
    const t = q(e, 'text');
    expect(t.classList.contains('sr-only')).toBe(true);
    expect(t.textContent).toBe(getDisclosure('deepfake-video', 'lt').short);
    expect(q(e, 'label').getAttribute('lang')).toBe('lt');
  });

  it('opens and closes details with button, Escape and outside click', () => {
    const e = label({ details: '', kind: 'public-interest-text' });
    const toggle = q(e, 'toggle');
    const panel = q(e, 'details');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.hidden).toBe(true);
    const toggles: boolean[] = [];
    e.addEventListener('telltale-details-toggle', (ev) => toggles.push((ev as CustomEvent<{ open: boolean }>).detail.open));

    toggle.focus();
    toggle.click();
    expect(e.open).toBe(true);
    // The same button stays in the tree and keeps focus (a real keyboard user can press Escape next).
    expect(q(e, 'toggle')).toBe(toggle);
    expect(e.shadowRoot!.activeElement).toBe(toggle);
    expect(q(e, 'toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q(e, 'details').hidden).toBe(false);
    expect(q(e, 'details-text').textContent).toBe(getDisclosure('public-interest-text', 'en').long);

    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(e.open).toBe(false);
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'toggle'));

    q(e, 'toggle').click();
    q(e, 'details').querySelector('button')!.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(e.open).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(e.open).toBe(false);

    q(e, 'toggle').click();
    q(e, 'close').click();
    expect(e.open).toBe(false);
    expect(toggles).toEqual([true, false, true, false, true, false]);
  });

  it('keeps focus on the equivalent control when attributes change', () => {
    const e = label({ details: '' });
    q(e, 'toggle').focus();
    e.setAttribute('lang', 'de');
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'toggle'));
    const d = disclosure({ dismissible: '' });
    q(d, 'hide').focus();
    d.setAttribute('lang', 'fr');
    expect(d.shadowRoot!.activeElement).toBe(q(d, 'hide'));
  });

  it('moves focus out of the panel when it closes from an outside click', () => {
    const e = label({ details: '' });
    e.show();
    q(e, 'close').focus();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(e.open).toBe(false);
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'toggle'));
  });

  // Regression: WebKit (Safari) does not focus a button on click, so after a
  // mouse click focus stays on the page and Escape never reached the label.
  it('closes on Escape when focus is on the page, as after a click in Safari', () => {
    const e = label({ details: '' });
    q(e, 'toggle').click();
    expect(e.open).toBe(true);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(e.open).toBe(false);
    expect(e.shadowRoot!.activeElement).toBe(q(e, 'toggle'));
  });

  it('closes on Escape from elsewhere on the page without taking focus', () => {
    const e = label({ details: '' });
    const input = document.createElement('input');
    document.body.append(input);
    e.show();
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(e.open).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(e.open).toBe(false);
    expect(document.activeElement).toBe(input);
    // Closed: a later Escape is ignored.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(e.open).toBe(false);
  });

  it('removes document listeners when disconnected', () => {
    const e = label({ details: '' });
    e.show();
    const spy = vi.spyOn(document, 'removeEventListener');
    e.remove();
    expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(e.open).toBe(false);
  });

  it('closes when details are switched off', () => {
    const e = label({ details: '' });
    e.show();
    e.removeAttribute('details');
    expect(e.open).toBe(false);
    expect(e.shadowRoot!.querySelector('button')).toBeNull();
    e.show();
    expect(e.open).toBe(false);
  });

  it('accepts an icon through the slot', () => {
    const e = label();
    const img = document.createElement('img');
    img.setAttribute('slot', 'icon');
    img.setAttribute('alt', '');
    e.append(img);
    const slot = e.shadowRoot!.querySelector('slot[name="icon"]')!;
    expect(slot.parentElement!.getAttribute('aria-hidden')).toBe('true');
  });

  it('treats XSS strings in every attribute as text', () => {
    for (const s of XSS) {
      const e = label({ text: s, 'long-text': s, kind: s, lang: s, details: s, compact: s });
      e.show();
      expect(q(e, 'text').textContent).toBe(s);
      expect(q(e, 'details-text').textContent).toBe(s);
      expect(q(e, 'details').getAttribute('aria-label')).toBe(s);
      assertNoActiveContent(e.shadowRoot!);
    }
  });

  it('renders every kind in every language', () => {
    for (const lang of EU_LANGUAGES) {
      for (const kind of ['deepfake-image', 'deepfake-audio', 'deepfake-video', 'deepfake-creative', 'public-interest-text'] as const) {
        expect(q(label({ lang, kind }), 'text').textContent).toBe(getDisclosure(kind, lang).short);
      }
    }
  });
});
