// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// The React page for the hydration check. Rendered to HTML in Node by
// scripts/browser-check.mjs and hydrated in the browser by react-client.mjs,
// so both sides render exactly this tree.

import { createElement, useEffect } from 'react';
import { AiDisclosure, AiLabel } from '../../dist/react/index.js';
import { record } from './record.mjs';

export function App() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'react';
  }, []);
  return createElement(
    'section',
    { 'aria-labelledby': 'chat-h' },
    createElement('h2', { id: 'chat-h' }, 'Chat'),
    createElement(
      'div',
      { className: 'chat' },
      createElement(AiDisclosure, {
        dismissible: true,
        className: 'notice',
        onShown: (d) => record('shown', d),
        onDismissed: (d) => record('dismissed', d),
        onExpanded: (d) => record('expanded', d),
      }),
      createElement('p', { className: 'msg bot' }, 'Hello. How can I help?'),
    ),
    createElement(
      'figure',
      { className: 'media' },
      createElement('img', { src: '/sample.png', alt: 'Blue square generated for this demo', width: 320, height: 240 }),
      createElement(AiLabel, {
        kind: 'deepfake-image',
        details: true,
        className: 'overlay',
        icon: createElement('img', { src: '/sample.png', alt: '', width: 16, height: 16 }),
        onDetailsToggle: (d) => record('toggle', d),
      }),
    ),
    createElement('p', { lang: 'de' }, 'Kompakt: ', createElement(AiLabel, { kind: 'deepfake-video', compact: true })),
  );
}
