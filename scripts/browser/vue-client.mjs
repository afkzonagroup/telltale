// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Hydrates the server-rendered Vue page. Bundled by scripts/browser-check.mjs.

import { createSSRApp } from 'vue';
import { App } from './vue-app.mjs';

const container = document.getElementById('app');
// The server-rendered elements, to prove hydration reused them instead of rendering again.
globalThis.__ssrNodes = [...container.querySelectorAll('ai-disclosure, ai-label')];
const app = createSSRApp(App);
app.config.warnHandler = (msg) => {
  console.error(`Vue warning: ${msg}`);
};
app.mount(container);
