# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
