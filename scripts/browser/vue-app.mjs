// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// The Vue page for the hydration check. Rendered to HTML in Node by
// scripts/browser-check.mjs and hydrated in the browser by vue-client.mjs,
// so both sides render exactly this tree.

import { defineComponent, h, onMounted } from 'vue';
import { AiDisclosure, AiLabel } from '../../dist/vue/index.js';
import { record } from './record.mjs';

export const App = defineComponent({
  name: 'HydrationApp',
  setup() {
    onMounted(() => {
      document.documentElement.dataset.hydrated = 'vue';
    });
    return () =>
      h('section', { 'aria-labelledby': 'chat-h' }, [
        h('h2', { id: 'chat-h' }, 'Chat'),
        h('div', { class: 'chat' }, [
          h(AiDisclosure, {
            dismissible: true,
            class: 'notice',
            onShown: (d) => record('shown', d),
            onDismissed: (d) => record('dismissed', d),
            onExpanded: (d) => record('expanded', d),
          }),
          h('p', { class: 'msg bot' }, 'Hello. How can I help?'),
        ]),
        h('figure', { class: 'media' }, [
          h('img', { src: '/sample.png', alt: 'Blue square generated for this demo', width: 320, height: 240 }),
          h(
            AiLabel,
            { kind: 'deepfake-image', details: true, class: 'overlay', onDetailsToggle: (d) => record('toggle', d) },
            () => [h('img', { src: '/sample.png', alt: '', width: 16, height: 16 })],
          ),
        ]),
        h('p', { lang: 'de' }, ['Kompakt: ', h(AiLabel, { kind: 'deepfake-video', compact: true })]),
      ]);
  },
});
