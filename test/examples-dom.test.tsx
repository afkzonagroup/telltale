/**
 * @vitest-environment happy-dom
 */
/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp } from 'vue';
import { describe, expect, it } from 'vitest';
import { Chat as ReactChat } from '../examples/react-chat.js';
import { Chat as VueChat } from '../examples/vue-chat.js';
import { getDisclosure } from '../src/texts/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('framework examples from the README', () => {
  it('React example renders and reports the shown text', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const shown: string[] = [];
    await act(async () => {
      root.render(<ReactChat onShown={(t) => shown.push(t)} />);
      await Promise.resolve();
    });
    expect(host.querySelector('ai-disclosure')?.hasAttribute('dismissible')).toBe(true);
    expect(host.querySelector('ai-label')?.getAttribute('kind')).toBe('deepfake-image');
    expect(shown).toEqual([getDisclosure('chatbot', 'en').long]);
    act(() => {
      root.unmount();
    });
  });

  it('Vue example compiles its template and emits the shown text', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shown: string[] = [];
    const app = createApp(VueChat, { onShown: (t: string) => shown.push(t) });
    app.mount(host);
    await Promise.resolve();
    expect(host.querySelector('ai-disclosure')?.hasAttribute('dismissible')).toBe(true);
    expect(host.querySelector('ai-label')?.getAttribute('kind')).toBe('public-interest-text');
    expect(shown).toEqual([getDisclosure('chatbot', 'en').long]);
    app.unmount();
  });
});
