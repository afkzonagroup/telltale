/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { AiLabelElement, defineTelltaleElements } from '../src/components/index.js';
import '../src/components/auto.js';

describe('components on the server (no DOM)', () => {
  it('can be imported and defining is a no-op', () => {
    expect(typeof HTMLElement).toBe('undefined');
    expect(() => {
      defineTelltaleElements();
    }).not.toThrow();
    expect(() => new AiLabelElement()).toThrow(/browser DOM/);
  });
});
