// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Hydrates the server-rendered React page. Bundled by scripts/browser-check.mjs.

import { createElement, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './react-app.mjs';

const container = document.getElementById('app');
// The server-rendered elements, to prove hydration reused them instead of rendering again.
globalThis.__ssrNodes = [...container.querySelectorAll('ai-disclosure, ai-label')];
hydrateRoot(container, createElement(StrictMode, null, createElement(App)), {
  onRecoverableError: (error) => {
    console.error(`React recoverable error: ${String(error?.message ?? error)}`);
  },
});
