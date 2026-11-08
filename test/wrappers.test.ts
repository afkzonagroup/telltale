/**
 * @vitest-environment happy-dom
 */
/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createApp, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import type { DisclosureEventDetail } from '../src/components/index.js';
import { AiDisclosure as ReactDisclosure, AiLabel as ReactLabel } from '../src/react/index.js';
import { AiDisclosure as VueDisclosure, AiLabel as VueLabel } from '../src/vue/index.js';
import { getDisclosure } from '../src/texts/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
});

function container(): HTMLElement {
  const c = document.createElement('div');
  document.body.append(c);
  return c;
}

describe('React wrapper', () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
  });

  it('renders <ai-disclosure>, maps booleans to present/absent attributes and delivers events', async () => {
    const c = container();
    root = createRoot(c);
    const shown: DisclosureEventDetail[] = [];
    const dismissed: DisclosureEventDetail[] = [];
    await act(async () => {
      root!.render(createElement(ReactDisclosure, { lang: 'fr', dismissible: true, className: 'chat-notice', onShown: (d) => shown.push(d), onDismissed: (d) => dismissed.push(d) }));
      await Promise.resolve();
    });
    const el = c.querySelector('ai-disclosure')!;
    expect(el.hasAttribute('dismissible')).toBe(true);
    expect(el.className).toBe('chat-notice');
    expect(shown).toEqual([{ kind: 'chatbot', lang: 'fr', variant: 'long', text: getDisclosure('chatbot', 'fr').long }]);
    act(() => {
      el.dismiss();
    });
    expect(dismissed).toHaveLength(1);

    await act(async () => {
      root!.render(createElement(ReactDisclosure, { lang: 'fr', dismissible: false }));
      await Promise.resolve();
    });
    expect(el.hasAttribute('dismissible')).toBe(false);
    expect(el.collapsed).toBe(false);
  });

  it('renders <ai-label> with an icon slot and passes text as text', async () => {
    const c = container();
    root = createRoot(c);
    const toggles: boolean[] = [];
    const hostile = '<img src=x onerror=alert(1)>';
    await act(async () => {
      root!.render(
        createElement(ReactLabel, {
          kind: 'deepfake-video',
          details: true,
          align: 'end',
          text: hostile,
          icon: createElement('img', { alt: '', src: 'data:,' }),
          onDetailsToggle: (d) => toggles.push(d.open),
        }),
      );
      await Promise.resolve();
    });
    const el = c.querySelector('ai-label')!;
    expect(el.querySelector('[slot="icon"] img')).not.toBeNull();
    expect(el.getAttribute('align')).toBe('end');
    expect(el.shadowRoot!.querySelector('[part="text"]')!.textContent).toBe(hostile);
    expect(el.shadowRoot!.querySelector('img')).toBeNull();
    act(() => {
      el.show();
    });
    expect(toggles).toEqual([true]);
  });
});

describe('Vue wrapper', () => {
  it('renders <ai-disclosure> and emits events', async () => {
    const c = container();
    const shown: DisclosureEventDetail[] = [];
    const dismissible = ref(true);
    const app = createApp({
      render: () => h(VueDisclosure, { lang: 'lt', dismissible: dismissible.value, onShown: (d: DisclosureEventDetail) => shown.push(d) }),
    });
    app.mount(c);
    await Promise.resolve();
    const el = c.querySelector('ai-disclosure')!;
    expect(el.hasAttribute('dismissible')).toBe(true);
    expect(shown).toEqual([{ kind: 'chatbot', lang: 'lt', variant: 'long', text: getDisclosure('chatbot', 'lt').long }]);
    dismissible.value = false;
    await nextTick();
    expect(el.hasAttribute('dismissible')).toBe(false);
    app.unmount();
  });

  it('renders <ai-label> with slot content and emits detailsToggle', async () => {
    const c = container();
    const toggles: boolean[] = [];
    const app = createApp({
      render: () =>
        h(VueLabel, { details: true, compact: true, align: 'end', kind: 'public-interest-text', onDetailsToggle: (d: { open: boolean }) => toggles.push(d.open) }, () => [
          h('img', { alt: '', src: 'data:,' }),
        ]),
    });
    app.mount(c);
    await nextTick();
    const el = c.querySelector('ai-label')!;
    expect(el.hasAttribute('compact')).toBe(true);
    expect(el.getAttribute('align')).toBe('end');
    expect(el.querySelector('[slot="icon"] img')).not.toBeNull();
    el.show();
    expect(toggles).toEqual([true]);
    app.unmount();
  });
});
