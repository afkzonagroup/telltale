# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cross-browser check: `npm run test:browser` runs the components and the
  React and Vue wrappers in Playwright's Chromium, Firefox and WebKit
  (rendering under a strict CSP, keyboard and focus, axe-core WCAG 2.1 A/AA,
  320 px, server rendering plus hydration). CI runs one job per engine. All
  checks pass in all three engines.

### Fixed

- React wrapper: `onShown` never ran when React hydrated server-rendered
  markup, because the element reported `telltale-shown` before React attached
  its listener. The wrapper now delivers that report once. The Vue wrapper
  does the same when hydration starts after an asynchronous step.
- `<ai-label>`: Escape did not close a details panel opened with the mouse in
  Safari (WebKit), which does not focus a clicked button. Escape now closes
  the panel wherever focus is; focus moves to the label only if nothing else
  had it.

## [0.1.1] - 2026-11-08

### Security

- `DisclosureLogFile.open` refuses an existing log that its group or others can write; the new `permissions` option can restrict it to 0600 (`fix`) or keep it (`allow`) (#18).

### Changed

- Development dependencies updated (#15); Dependabot groups minor and patch updates and ignores major versions (#14).
- Release workflow skips versions already on npm.

## [0.1.0] - 2026-11-08

### Added

- Disclosure texts for eight Article 50 situations in the 24 official EU
  languages. English is authored; the other 23 are translations marked
  `source: "translation"` and need native review.
- Web components `<ai-disclosure>` and `<ai-label>` (Shadow DOM,
  constructable stylesheets, strict CSP, WCAG 2.1 AA checks).
- React and Vue wrappers.
- XMP marking and reading for PNG, JPEG and WebP with the IPTC
  `Iptc4xmpExt:DigitalSourceType` property.
- JSON-LD helper (schema.org `digitalSourceType`) and an experimental
  `AI-Disclosure` HTTP header helper.
- Hash-chained disclosure log with optional HMAC key, verification and an
  append-only Node file writer.
- `telltale` CLI (`mark`, `read`, `verify-log`).
- Pure-Python package for marking images, byte-identical to the TypeScript
  implementation through shared test vectors.
