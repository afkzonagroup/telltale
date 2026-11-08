# Contributing

Thank you for helping. Please read this first.

## Before you start

- Pull requests need a signed [Contributor Licence Agreement](CLA.md). Add the
  sentence from "How to sign" to your first pull request.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security problems privately (see [SECURITY.md](SECURITY.md)), not in issues.

## Setup

Development and the published library need Node.js 22 or newer. The Python
package needs Python 3.10 or newer.

```sh
npm ci
npm run check          # typecheck + lint + tests
npm run coverage       # coverage report (thresholds: 90 % lines)

cd python
python3 -m venv .venv
.venv/bin/python -m pip install mypy==2.4.0
.venv/bin/python -m mypy
PYTHONPATH=src .venv/bin/python -m unittest discover -s tests -t .
```

## Rules

- TypeScript strict mode, no `any`, no `@ts-ignore`, no unexplained
  `eslint-disable`.
- No runtime dependencies. If you think one is needed, open an issue first.
- Every rule, limit and security control has a test that fails when the
  control is removed.
- Changes to image marking must keep the TypeScript and Python packages
  byte-identical. Add cases to `scripts/generate-vectors.mjs`, then run
  `npm run build && npm run vectors` and both test suites.
- Legal statements cite the official text on EUR-Lex. Do not rely on blog
  posts for what the law says.
- Translations: say in the pull request whether you are a native speaker.
  Only maintainers set `nativeReviewed: true`, after a native review.

## Browser check

`scripts/browser-check.mjs` runs the components and the React and Vue
wrappers in Playwright's Chromium, Firefox and WebKit: rendering under a
strict CSP, keyboard and focus, axe-core (WCAG 2.1 A and AA), 320 px reflow,
and server-side rendering followed by hydration. CI runs one job per engine.

```sh
npx playwright-core install chromium firefox webkit   # once
npm run test:browser                                  # all three engines
npm run test:browser -- webkit                        # one engine
SHOTS=../telltale-shots npm run test:browser          # with screenshots
```

## Commits

Small, focused commits with a plain description of the change.
