/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Component styles. Theme with CSS custom properties on the host or any
 * ancestor, or with ::part(). Default colours meet WCAG 2.1 AA contrast
 * (text 4.5:1, focus indicator and borders 3:1) in light and dark schemes.
 */

const TOKENS = `
:host {
  --_bg: var(--telltale-bg, #ffffff);
  --_fg: var(--telltale-fg, #1a1a1a);
  --_border: var(--telltale-border, #5c5c5c);
  --_badge-bg: var(--telltale-badge-bg, #1a1a1a);
  --_badge-fg: var(--telltale-badge-fg, #ffffff);
  --_button-bg: var(--telltale-button-bg, #1a1a1a);
  --_button-fg: var(--telltale-button-fg, #ffffff);
  --_focus: var(--telltale-focus, #0b57d0);
  --_radius: var(--telltale-radius, 0.5rem);
  --_font: var(--telltale-font, inherit);
  --_size: var(--telltale-font-size, 0.9375rem);
  font-family: var(--_font);
  font-size: var(--_size);
  line-height: 1.5;
  color: var(--_fg);
}
@media (prefers-color-scheme: dark) {
  :host {
    --_bg: var(--telltale-bg, #1f1f1f);
    --_fg: var(--telltale-fg, #f2f2f2);
    --_border: var(--telltale-border, #a3a3a3);
    --_badge-bg: var(--telltale-badge-bg, #f2f2f2);
    --_badge-fg: var(--telltale-badge-fg, #1a1a1a);
    --_button-bg: var(--telltale-button-bg, #f2f2f2);
    --_button-fg: var(--telltale-button-fg, #1a1a1a);
    --_focus: var(--telltale-focus, #8ab4f8);
  }
}
[hidden] { display: none !important; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0;
}
button {
  font: inherit; color: var(--_button-fg); background: var(--_button-bg);
  border: 1px solid var(--_button-bg); border-radius: calc(var(--_radius) * 0.75);
  padding: 0.25em 0.75em; min-block-size: 2em; cursor: pointer;
}
button:focus-visible { outline: 3px solid var(--_focus); outline-offset: 2px; }
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-inline-size: 1.75em; padding: 0 0.4em; border-radius: calc(var(--_radius) * 0.5);
  background: var(--_badge-bg); color: var(--_badge-fg); font-weight: 700; font-size: 0.85em;
  line-height: 1.6;
}
::slotted(img), ::slotted(svg) { block-size: 1.25em; inline-size: auto; }
@media (forced-colors: active) {
  .notice, .mini, .label, .details { border: 1px solid CanvasText; }
  .badge { border: 1px solid CanvasText; }
  button { border: 1px solid ButtonText; }
}
`;

export const DISCLOSURE_CSS = `${TOKENS}
:host { display: block; }
.notice {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5em 1em;
  padding: 0.75em 1em; border: 1px solid var(--_border); border-radius: var(--_radius);
  background: var(--_bg); color: var(--_fg);
}
.notice p { margin: 0; flex: 1 1 16em; min-inline-size: 0; overflow-wrap: anywhere; }
.mini {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.4em 0.6em;
  padding: 0.25em 0.5em; border: 1px solid var(--_border); border-radius: var(--_radius);
  background: var(--_bg); color: var(--_fg); max-inline-size: 100%;
}
.mini span.text { overflow-wrap: anywhere; }
.mini button { padding: 0.1em 0.6em; }
`;

export const LABEL_CSS = `${TOKENS}
:host { display: inline-block; position: relative; max-inline-size: 100%; vertical-align: middle; }
.label {
  display: inline-flex; align-items: center; gap: 0.4em; max-inline-size: 100%;
  padding: 0.2em 0.5em 0.2em 0.25em; border: 1px solid var(--_border); border-radius: var(--_radius);
  background: var(--_bg); color: var(--_fg);
}
.label.compact { padding: 0.2em; }
.text { overflow-wrap: anywhere; }
button.toggle {
  display: inline-flex; align-items: center; gap: 0.4em; padding: 0; min-block-size: 0;
  background: transparent; color: inherit; border: 0; text-align: start;
}
button.toggle .text { text-decoration: underline; text-underline-offset: 0.15em; }
.details {
  box-sizing: border-box;
  position: absolute; z-index: 2147483000; inset-block-start: calc(100% + 0.25em); inset-inline-start: 0;
  inline-size: max-content; max-inline-size: min(22rem, calc(100vw - 2rem));
  padding: 0.75em 1em; border: 1px solid var(--_border); border-radius: var(--_radius);
  background: var(--_bg); color: var(--_fg); box-shadow: 0 0.25em 1em rgb(0 0 0 / 0.2);
}
.details p { margin: 0 0 0.5em; overflow-wrap: anywhere; white-space: normal; }
:host([align="end"]) .details { inset-inline-start: auto; inset-inline-end: 0; }
`;
