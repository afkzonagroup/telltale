/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin React wrappers around `<ai-disclosure>` and `<ai-label>`.
 * Works with React 18 and 19. No JSX transform needed.
 *
 * Boolean options are rendered as present-or-absent attributes, so
 * `dismissible={false}` never turns into `dismissible="false"`.
 *
 * @packageDocumentation
 */

import { createElement, useEffect, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { defineTelltaleElements, type DisclosureEventDetail } from '../components/index.js';
import type { DisclosureKind } from '../texts/index.js';

defineTelltaleElements();

// useLayoutEffect attaches listeners before the element's first microtask; it is a no-op on the server.
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

type Attrs = Record<string, string>;

function attrs(input: Readonly<Record<string, string | boolean | undefined>>): Attrs {
  const out: Attrs = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === true) out[k] = '';
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function useEvents(ref: { readonly current: HTMLElement | null }, handlers: Readonly<Record<string, ((detail: never) => void) | undefined>>): void {
  const latest = useRef(handlers);
  // Keep the newest handlers without re-subscribing; refs are updated in an effect, not during render.
  useIsomorphicLayoutEffect(() => {
    latest.current = handlers;
  });
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const names = Object.keys(latest.current);
    const listener = (ev: Event): void => {
      const h = latest.current[ev.type];
      if (h) h((ev as CustomEvent).detail as never);
    };
    for (const n of names) el.addEventListener(n, listener);
    return () => {
      for (const n of names) el.removeEventListener(n, listener);
    };
  }, [ref]);
}

function useClassName(ref: { readonly current: HTMLElement | null }, className: string | undefined): void {
  useIsomorphicLayoutEffect(() => {
    if (ref.current && className !== undefined) ref.current.className = className;
  }, [ref, className]);
}

export interface AiDisclosureProps {
  readonly kind?: DisclosureKind;
  readonly lang?: string;
  /** Override for the short label. */
  readonly text?: string;
  /** Override for the full notice. */
  readonly longText?: string;
  readonly dismissible?: boolean;
  readonly remember?: 'session';
  readonly announce?: boolean;
  readonly className?: string;
  readonly onShown?: (detail: DisclosureEventDetail) => void;
  readonly onDismissed?: (detail: DisclosureEventDetail) => void;
  readonly onExpanded?: (detail: DisclosureEventDetail) => void;
}

/** React wrapper for `<ai-disclosure>`. */
export function AiDisclosure(props: AiDisclosureProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useEvents(ref, {
    'telltale-shown': props.onShown,
    'telltale-dismissed': props.onDismissed,
    'telltale-expanded': props.onExpanded,
  });
  useClassName(ref, props.className);
  return createElement('ai-disclosure', {
    ref,
    ...attrs({
      kind: props.kind,
      lang: props.lang,
      text: props.text,
      'long-text': props.longText,
      dismissible: props.dismissible,
      remember: props.remember,
      announce: props.announce,
    }),
  });
}

export interface AiLabelProps {
  readonly kind?: DisclosureKind;
  readonly lang?: string;
  readonly text?: string;
  readonly longText?: string;
  readonly compact?: boolean;
  readonly details?: boolean;
  /** `end` opens the details panel towards the start edge (for labels at the end of a line or image). */
  readonly align?: 'end';
  readonly className?: string;
  /** Optional icon, rendered into the `icon` slot (for example the official EU icon as an `<img alt="">`). */
  readonly icon?: ReactNode;
  readonly onDetailsToggle?: (detail: { open: boolean }) => void;
}

/** React wrapper for `<ai-label>`. */
export function AiLabel(props: AiLabelProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useEvents(ref, { 'telltale-details-toggle': props.onDetailsToggle });
  useClassName(ref, props.className);
  const children = props.icon === undefined ? undefined : createElement('span', { slot: 'icon' }, props.icon);
  return createElement(
    'ai-label',
    {
      ref,
      ...attrs({
        kind: props.kind,
        lang: props.lang,
        text: props.text,
        'long-text': props.longText,
        compact: props.compact,
        details: props.details,
        align: props.align,
      }),
    },
    children,
  );
}
