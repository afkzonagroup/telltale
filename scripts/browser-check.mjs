// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Real-browser check of the web components: strict CSP, keyboard use,
// axe-core WCAG 2.1 A/AA scan, reflow at 320 px, and screenshots.
//
// playwright-core and axe-core are NOT dependencies of this package. Point
// the script at installed copies:
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//   AXE_CORE=/path/to/node_modules/axe-core/axe.min.js \
//   SHOTS=/tmp/telltale-shots node scripts/browser-check.mjs
// Run `npm run build` first.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const axeSource = await readFile(process.env.AXE_CORE ?? require.resolve('axe-core/axe.min.js'), 'utf8');
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
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
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
};

const browser = await chromium.launch();
try {
  // 1. Strict CSP, no bypass.
  for (const [name, viewport, scheme] of [
    ['desktop-light', { width: 1280, height: 900 }, 'light'],
    ['phone-light', { width: 390, height: 844 }, 'light'],
    ['phone-dark', { width: 390, height: 844 }, 'dark'],
    ['narrow-320', { width: 320, height: 700 }, 'light'],
  ]) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await ctx.newPage();
    const violations = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        (window.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto(origin + '/');
    await page.waitForFunction(() => document.documentElement.dataset.shown === '2');
    const cspEvents = await page.evaluate(() => window.__csp ?? []);
    check(violations.length === 0 && cspEvents.length === 0, `${name}: no CSP violations (${[...violations, ...cspEvents].join('; ')})`);
    const styled = await page.evaluate(() => {
      const el = document.querySelector('ai-disclosure');
      const notice = el.shadowRoot.querySelector('[part="notice"]');
      return { sheets: el.shadowRoot.adoptedStyleSheets.length, border: getComputedStyle(notice).borderTopStyle };
    });
    check(styled.sheets === 1 && styled.border === 'solid', `${name}: constructable stylesheet applied under CSP`);
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${name}: no horizontal scrolling (overflow ${overflow}px)`);
    if (shots) await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });

    if (name === 'desktop-light' || name === 'phone-light') {
      // Keyboard: Tab to "Hide notice", Enter, focus moves to "More information".
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.getAttribute('part'));
      check(first === 'hide', `${name}: first Tab reaches the hide button (${first})`);
      await page.keyboard.press('Enter');
      const after = await page.evaluate(() => {
        const el = document.getElementById('notice');
        return { collapsed: el.collapsed, focus: el.shadowRoot.activeElement?.getAttribute('part') };
      });
      check(after.collapsed && after.focus === 'expand', `${name}: Enter collapses and focus moves to expand`);
      if (shots) await page.screenshot({ path: join(shots, `${name}-collapsed.png`), fullPage: true });
      await page.locator('ai-label.overlay').locator('button[part="toggle"]').click();
      const open = await page.evaluate(() => document.querySelector('ai-label.overlay').open);
      check(open, `${name}: label details open on click`);
      const openOverflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
      check(openOverflow <= 0, `${name}: open details panel causes no horizontal scrolling (overflow ${openOverflow}px)`);
      if (shots) await page.screenshot({ path: join(shots, `${name}-details.png`), fullPage: true });
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => {
        const l = document.querySelector('ai-label.overlay');
        return !l.open && l.shadowRoot.activeElement?.getAttribute('part') === 'toggle';
      });
      check(closed, `${name}: Escape closes details and returns focus`);
    }
    await ctx.close();
  }

  // 2. axe-core scan (CSP bypassed only to inject axe).
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(origin + '/');
    await page.waitForFunction(() => document.documentElement.dataset.shown === '2');
    await page.evaluate(axeSource);
    const states = [
      ['initial', async () => {}],
      ['collapsed + details open', async () => {
        await page.evaluate(() => {
          document.getElementById('notice').dismiss();
          document.querySelector('ai-label.overlay').show();
        });
      }],
    ];
    for (const [state, act] of states) {
      await act();
      const result = await page.evaluate(() =>
        window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
      );
      const v = result.violations.map((x) => `${x.id} (${x.nodes.length})`);
      check(v.length === 0, `axe ${scheme} ${state}: ${v.length === 0 ? 'no violations' : v.join(', ')}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exitCode = 1;
}
