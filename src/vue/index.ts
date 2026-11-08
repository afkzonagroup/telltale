/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin Vue 3 wrappers around `<ai-disclosure>` and `<ai-label>`.
 * Render functions only, so no template compiler or `isCustomElement`
 * configuration is needed.
 *
 * @packageDocumentation
 */

import { defineComponent, h, type PropType } from 'vue';
import { defineTelltaleElements, type DisclosureEventDetail } from '../components/index.js';
import type { DisclosureKind } from '../texts/index.js';

defineTelltaleElements();

function attrs(input: Readonly<Record<string, string | boolean | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === true) out[k] = '';
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** Vue wrapper for `<ai-disclosure>`. Emits `shown`, `dismissed`, `expanded`. */
export const AiDisclosure = defineComponent({
  name: 'AiDisclosure',
  props: {
    kind: { type: String as PropType<DisclosureKind>, default: undefined },
    lang: { type: String, default: undefined },
    text: { type: String, default: undefined },
    longText: { type: String, default: undefined },
    dismissible: { type: Boolean, default: false },
    remember: { type: String as PropType<'session'>, default: undefined },
    announce: { type: Boolean, default: false },
  },
  emits: {
    shown: (_d: DisclosureEventDetail) => true,
    dismissed: (_d: DisclosureEventDetail) => true,
    expanded: (_d: DisclosureEventDetail) => true,
  },
  setup(props, { emit }) {
    return () =>
      h('ai-disclosure', {
        ...attrs({
          kind: props.kind,
          lang: props.lang,
          text: props.text,
          'long-text': props.longText,
          dismissible: props.dismissible,
          remember: props.remember,
          announce: props.announce,
        }),
        'onTelltale-shown': (ev: Event) => {
          emit('shown', (ev as CustomEvent<DisclosureEventDetail>).detail);
        },
        'onTelltale-dismissed': (ev: Event) => {
          emit('dismissed', (ev as CustomEvent<DisclosureEventDetail>).detail);
        },
        'onTelltale-expanded': (ev: Event) => {
          emit('expanded', (ev as CustomEvent<DisclosureEventDetail>).detail);
        },
      });
  },
});

/** Vue wrapper for `<ai-label>`. Emits `detailsToggle`. Default slot goes into the `icon` slot. */
export const AiLabel = defineComponent({
  name: 'AiLabel',
  props: {
    kind: { type: String as PropType<DisclosureKind>, default: undefined },
    lang: { type: String, default: undefined },
    text: { type: String, default: undefined },
    longText: { type: String, default: undefined },
    compact: { type: Boolean, default: false },
    details: { type: Boolean, default: false },
    align: { type: String as PropType<'end'>, default: undefined },
  },
  emits: {
    detailsToggle: (_d: { open: boolean }) => true,
  },
  setup(props, { emit, slots }) {
    return () =>
      h(
        'ai-label',
        {
          ...attrs({
            kind: props.kind,
            lang: props.lang,
            text: props.text,
            'long-text': props.longText,
            compact: props.compact,
            details: props.details,
            align: props.align,
          }),
          'onTelltale-details-toggle': (ev: Event) => {
            emit('detailsToggle', (ev as CustomEvent<{ open: boolean }>).detail);
          },
        },
        slots['default'] ? [h('span', { slot: 'icon' }, slots['default']())] : [],
      );
  },
});
