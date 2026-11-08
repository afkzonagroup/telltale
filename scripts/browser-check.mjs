// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Real-browser check of the web components and the React and Vue wrappers,
// in Playwright's Chromium, Firefox and WebKit: rendering under a strict CSP,
// keyboard use and focus, axe-core WCAG 2.1 A/AA scan, reflow at 320 px,
// server-side rendering plus hydration, and optional screenshots.
//
//   npm run test:browser                       # all three engines
//   npm run test:browser -- firefox webkit     # some engines
//   SHOTS=../telltale-shots npm run test:browser
//
// Install the engines once with `npx playwright-core install chromium firefox webkit`.

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, StrictMode } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { createSSRApp } from 'vue';
import { renderToString as renderVue } from 'vue/server-renderer';
import { App as ReactApp } from './browser/react-app.mjs';
import { App as VueApp } from './browser/vue-app.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const playwright = require('playwright-core');
const esbuild = require('esbuild');
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

const ENGINES = ['chromium', 'firefox', 'webkit'];
const requested = process.argv.slice(2);
for (const name of requested) {
  if (!ENGINES.includes(name)) {
    console.error(`Unknown engine "${name}". Use: ${ENGINES.join(', ')}.`);
    process.exit(2);
  }
}
const engines = requested.length > 0 ? requested : ENGINES;
const shots = process.env.SHOTS;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Hydration pages: rendered here with the frameworks' server renderers, hydrated in the browser by a bundle.
async function bundle(entry, define) {
  const result = await esbuild.build({
    entryPoints: [join(repo, 'scripts/browser', entry)],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    legalComments: 'none',
    // Development builds, so both frameworks report every hydration mismatch.
    define: { 'process.env.NODE_ENV': '"development"', ...define },
  });
  return Buffer.from(result.outputFiles[0].contents);
}

function page(title, script, body) {
  return Buffer.from(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/demo.css">
  <script type="module" src="/${script}"></script>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <div id="app">${body}</div>
  </main>
</body>
</html>
`);
}

const generated = new Map([
  ['/react.html', page('React hydration', 'react.js', renderReact(createElement(StrictMode, null, createElement(ReactApp))))],
  ['/vue.html', page('Vue hydration', 'vue.js', await renderVue(createSSRApp(VueApp)))],
  ['/react.js', await bundle('react-client.mjs', {})],
  [
    '/vue.js',
    await bundle('vue-client.mjs', {
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
    }),
  ],
]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const headers = (file) => ({ 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP });
  const fixed = generated.get(url.pathname);
  if (fixed) {
    res.writeHead(200, headers(url.pathname)).end(fixed);
    return;
  }
  let base = join(repo, 'examples/browser');
  let rel = url.pathname === '/' ? '/index.html' : url.pathname;
  if (rel.startsWith('/telltale/')) {
    base = join(repo, 'dist');
    rel = rel.slice('/telltale'.length);
  }
  const file = normalize(join(base, rel));
  if (!file.startsWith(base + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, headers(file)).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const results = new Map();
let engine = '';
const check = (ok, msg) => {
  const r = results.get(engine);
  if (ok) r.passed += 1;
  else r.failed.push(msg);
  console.log(`${ok ? 'PASS' : 'FAIL'} [${engine}] ${msg}`);
};

/** Problems a page reports by itself: CSP violations, console errors and warnings, uncaught exceptions. */
async function watch(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning' || /Content[- ]Security[- ]Policy|Refused to/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return async () => [...problems, ...(await page.evaluate(() => window.__csp ?? []))];
}

const focusedPart = (page, selector) =>
  page.evaluate((s) => {
    const host = document.querySelector(s);
    return document.activeElement === host ? (host.shadowRoot.activeElement?.getAttribute('part') ?? null) : null;
  }, selector);

const overflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);

async function axe(page, label) {
  await page.evaluate(axeSource);
  const result = await page.evaluate((values) => window.axe.run(document, { runOnly: { type: 'tag', values } }), WCAG);
  const v = result.violations.map((x) => `${x.id} (${x.nodes.length})`);
  check(v.length === 0, `axe ${label}: ${v.length === 0 ? 'no violations' : v.join(', ')}`);
}

async function shot(page, name) {
  if (!shots) return;
  await mkdir(join(shots, engine), { recursive: true });
  await page.screenshot({ path: join(shots, engine, `${name}.png`), fullPage: true });
}

async function demoPage(browser, tab) {
  for (const [name, viewport, scheme] of [
    ['desktop-light', { width: 1280, height: 900 }, 'light'],
    ['phone-light', { width: 390, height: 844 }, 'light'],
    ['phone-dark', { width: 390, height: 844 }, 'dark'],
    ['narrow-320', { width: 320, height: 700 }, 'light'],
  ]) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await ctx.newPage();
    const problems = await watch(page);
    await page.goto(origin + '/');
    await page.waitForFunction(() => document.documentElement.dataset.shown === '2');
    const rendered = await page.evaluate(() => {
      const el = document.querySelector('ai-disclosure');
      const notice = el.shadowRoot.querySelector('[part="notice"]');
      const label = document.querySelector('ai-label.overlay');
      return {
        sheets: el.shadowRoot.adoptedStyleSheets.length,
        border: getComputedStyle(notice).borderTopStyle,
        text: notice.textContent.trim().length > 0,
        labelWidth: label.getBoundingClientRect().width,
      };
    });
    check(rendered.sheets === 1 && rendered.border === 'solid', `${name}: constructable stylesheet applied under CSP`);
    check(rendered.text && rendered.labelWidth > 0, `${name}: notice and label render with text`);
    const o = await overflow(page);
    check(o <= 0, `${name}: no horizontal scrolling (overflow ${o}px)`);
    await shot(page, name);

    if (name === 'desktop-light' || name === 'phone-light') {
      // Keyboard: Tab to "Hide notice", Enter, focus moves to "More information".
      await page.keyboard.press(tab);
      const first = await focusedPart(page, '#notice');
      check(first === 'hide', `${name}: first Tab reaches the hide button (${first})`);
      await page.keyboard.press('Enter');
      const after = await page.evaluate(() => document.getElementById('notice').collapsed);
      const afterFocus = await focusedPart(page, '#notice');
      check(after && afterFocus === 'expand', `${name}: Enter collapses and focus moves to expand (${afterFocus})`);
      await page.keyboard.press('Enter');
      const back = await page.evaluate(() => document.getElementById('notice').collapsed);
      const backFocus = await focusedPart(page, '#notice');
      check(!back && backFocus === 'hide', `${name}: Enter on expand restores the notice and focus moves to hide (${backFocus})`);
      await page.locator('#notice').locator('button[part="hide"]').click();
      await shot(page, `${name}-collapsed`);

      // Pointer: open by click, Escape closes and focus lands on the label button.
      await page.locator('ai-label.overlay').locator('button[part="toggle"]').click();
      const open = await page.evaluate(() => document.querySelector('ai-label.overlay').open);
      check(open, `${name}: label details open on click`);
      const openOverflow = await overflow(page);
      check(openOverflow <= 0, `${name}: open details panel causes no horizontal scrolling (overflow ${openOverflow}px)`);
      await shot(page, `${name}-details`);
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => document.querySelector('ai-label.overlay').open);
      const closedFocus = await focusedPart(page, 'ai-label.overlay');
      check(!closed && closedFocus === 'toggle', `${name}: Escape closes details opened by click and focus is on the label (${closedFocus})`);

      // Keyboard: Enter opens, Tab enters the panel, Escape closes and returns focus.
      await page.locator('ai-label.overlay').locator('button[part="toggle"]').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press(tab);
      const inPanel = await focusedPart(page, 'ai-label.overlay');
      check(inPanel === 'close', `${name}: Tab moves from the open label into its panel (${inPanel})`);
      await page.keyboard.press('Escape');
      const kClosed = await page.evaluate(() => document.querySelector('ai-label.overlay').open);
      const kFocus = await focusedPart(page, 'ai-label.overlay');
      check(!kClosed && kFocus === 'toggle', `${name}: Escape from inside the panel closes it and returns focus (${kFocus})`);

      // Outside click closes.
      await page.locator('ai-label.overlay').locator('button[part="toggle"]').click();
      await page.locator('h1').click();
      const outside = await page.evaluate(() => document.querySelector('ai-label.overlay').open);
      check(!outside, `${name}: click outside closes details`);
    }
    const p = await problems();
    check(p.length === 0, `${name}: no CSP violations, console errors or exceptions${p.length ? ` (${p.join('; ')})` : ''}`);
    await ctx.close();
  }

  // axe-core scan (CSP bypassed only to inject axe).
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(origin + '/');
    await page.waitForFunction(() => document.documentElement.dataset.shown === '2');
    await axe(page, `${scheme} initial`);
    await page.evaluate(() => {
      document.getElementById('notice').dismiss();
      document.querySelector('ai-label.overlay').show();
    });
    await axe(page, `${scheme} collapsed + details open`);
    await ctx.close();
  }
}

async function hydration(browser, tab, framework) {
  const name = `${framework} hydration`;
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const page = await ctx.newPage();
  const problems = await watch(page);
  await page.goto(`${origin}/${framework}.html`);
  await page.waitForFunction((f) => document.documentElement.dataset.hydrated === f, framework);
  // Give a late event every chance to arrive before counting.
  await page
    .waitForFunction(() => (globalThis.__telltaleEvents ?? []).some((e) => e.type === 'shown'), null, { timeout: 2000 })
    .catch(() => undefined);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));

  const state = await page.evaluate(() => {
    const now = [...document.querySelectorAll('#app ai-disclosure, #app ai-label')];
    const notice = document.querySelector('#app ai-disclosure');
    const overlay = document.querySelector('#app ai-label.overlay');
    return {
      reused: globalThis.__ssrNodes.length === 3 && now.length === 3 && now.every((n, i) => n === globalThis.__ssrNodes[i]),
      upgraded: now.every((n) => n.shadowRoot?.adoptedStyleSheets.length === 1 && n.shadowRoot.childElementCount > 0),
      classes: notice.classList.contains('notice') && overlay !== null,
      icon: overlay?.querySelector('[slot="icon"] img') !== null,
      noticeText: notice.shadowRoot.querySelector('[part="notice-text"]').textContent,
      shown: (globalThis.__telltaleEvents ?? []).filter((e) => e.type === 'shown').map((e) => e.detail),
    };
  });
  check(state.reused, `${name}: server-rendered elements are reused, not rendered again`);
  check(state.upgraded, `${name}: every element upgraded with its shadow tree and stylesheet`);
  check(state.classes && state.icon, `${name}: class names and the icon slot survive hydration`);
  check(
    state.shown.length === 1 && state.shown[0].variant === 'long' && state.shown[0].text === state.noticeText,
    `${name}: onShown runs exactly once with the text on screen (${state.shown.length} call(s))`,
  );
  const o = await overflow(page);
  check(o <= 0, `${name}: no horizontal scrolling at 320 px (overflow ${o}px)`);
  await shot(page, `${framework}-hydrated`);

  await page.keyboard.press(tab);
  const first = await focusedPart(page, '#app ai-disclosure');
  check(first === 'hide', `${name}: first Tab reaches the hide button (${first})`);
  await page.keyboard.press('Enter');
  const collapsedFocus = await focusedPart(page, '#app ai-disclosure');
  await page.keyboard.press('Enter');
  const expandedFocus = await focusedPart(page, '#app ai-disclosure');
  await page.locator('#app ai-label.overlay').locator('button[part="toggle"]').click();
  await page.keyboard.press('Escape');
  const labelFocus = await focusedPart(page, '#app ai-label.overlay');
  const events = await page.evaluate(() => globalThis.__telltaleEvents.map((e) => (e.type === 'toggle' ? `toggle:${e.detail.open}` : e.type)));
  check(collapsedFocus === 'expand' && expandedFocus === 'hide', `${name}: focus follows hide and expand (${collapsedFocus}, ${expandedFocus})`);
  check(labelFocus === 'toggle', `${name}: Escape closes the label and focus is on it (${labelFocus})`);
  check(events.join() === 'shown,dismissed,expanded,toggle:true,toggle:false', `${name}: wrapper callbacks in order (${events.join()})`);
  const p = await problems();
  check(p.length === 0, `${name}: no hydration warnings, CSP violations or exceptions${p.length ? ` (${p.join('; ')})` : ''}`);
  await ctx.close();

  const axeCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
  const axePage = await axeCtx.newPage();
  await axePage.goto(`${origin}/${framework}.html`);
  await axePage.waitForFunction((f) => document.documentElement.dataset.hydrated === f, framework);
  await axe(axePage, name);
  await axeCtx.close();
}

try {
  for (engine of engines) {
    results.set(engine, { passed: 0, failed: [], version: '' });
    // Safari on macOS moves Tab between text fields only by default; Option-Tab reaches every control.
    // Playwright's WebKit on macOS follows that platform setting, so the keyboard tests press Option-Tab there.
    const tab = engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    const browser = await playwright[engine].launch();
    results.get(engine).version = browser.version();
    try {
      await demoPage(browser, tab);
      await hydration(browser, tab, 'react');
      await hydration(browser, tab, 'vue');
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

console.log('');
let failed = 0;
for (const [name, r] of results) {
  failed += r.failed.length;
  console.log(`${name} ${r.version}: ${r.passed} passed, ${r.failed.length} failed`);
}
if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exitCode = 1;
}
