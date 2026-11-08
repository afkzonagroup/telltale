# Review record

Two review passes were made before release 0.1.0 (8 November 2026). This file
records what was checked, what was found and what was fixed. An independent
review follows.

## Pass 1: correctness, law, API, tests

### Law (official texts only)

Checked against the English text of Regulation (EU) 2024/1689 on EUR-Lex
(OJ L, 2024/1689, 12.7.2024) and Regulation (EU) 2026/1744 (OJ L, 2026/1744,
24.7.2026):

- Article 50(1) to (7), recitals 132 to 137, Article 3 points (1), (3), (4),
  (39), (40), (60), Article 5(1)(f) and (g), Article 96(1)(d), Article 99(4)(g)
  and (6), Article 113.
- Article 113, second paragraph: the Regulation applies from 2 August 2026.
  Chapter IV (Article 50) is not in the exceptions of the third paragraph,
  also after the amendments by Regulation (EU) 2026/1744 (which change points
  (a) and (c) and add (d)).
- Regulation (EU) 2026/1744, Article 1, point (39)(b), adds Article 111(4):
  generative AI systems placed on the market before 2 August 2026 must comply
  with Article 50(2) by 2 December 2026. Point (20) replaces Article 50(7).
  The Regulation entered into force on the third day after publication
  (its Article 4).
- Commission pages: the Article 50 guidelines page and PDF (C(2026) 7702
  final), the Code of Practice on Transparency of AI-Generated Content page
  and PDF (Measure 1.1: at least two marking layers, signed metadata plus
  imperceptible watermark; watermarking alone for free-form text), the EU
  icons page (licence and use by non-signatories).
- Technical specs: IPTC Digital Source Type NewsCodes (URIs and names of the
  three generative codes; retired codes excluded), IPTC Photo Metadata
  Standard 2025.1 (namespace, `DigitalSourceType`, `AISystemUsed`,
  `AISystemVersionUsed`), Adobe XMP Specification Part 3 (JPEG APP1 header,
  65,502-byte limit, ExtendedXMP, PNG iTXt layout), W3C PNG Third Edition
  (chunk layout, CRC, iTXt, keyword rules), RFC 9649 and the WebP container
  page (RIFF, padding, VP8X flag bits, VP8L header), RFC 6386 section 9.1
  (VP8 key frame header), C2PA 2.2 appendix A.3 (manifest locations),
  schema.org `digitalSourceType`, draft-abaris-aicdh-01.

Findings and fixes:

- The docs first named Node 20; the project baseline is Node 22. Fixed in
  `engines`, docs and types.
- Statements that could overclaim were rewritten: XMP is described as one
  layer that does not meet Measure 1.1 alone; the header helper is labelled
  experimental with the draft's expiry date; the README says Telltale does not
  implement the Code of Practice.
- The Article 50(3) mapping now notes the Article 5(1)(f) and (g)
  prohibitions, because a notice cannot make a prohibited use lawful.

### Image marking

- Outputs of every success vector were checked with independent tools:
  `pngfix` (all CRCs), `djpeg` (full decode), `webpinfo` and `dwebp` (container
  and decode; animated files frame by frame via `webpmux`), and Pillow with
  ElementTree (decode plus namespace-aware XMP parse). All files decoded and
  every packet parsed with the expected `DigitalSourceType` and
  `AISystemUsed` values, with markup in values escaped.
- Third-party XMP written by `webpmux` was read and merged correctly.
- Found: a test expected a JPEG length field of 65535 for a maximal packet;
  the real value is 2 + 29 + 65,502 = 65,533. Test corrected; the limit itself
  follows the XMP specification.
- Found: two quadratic paths in the XMP scanner (the duplicate-attribute check
  scanned a list; each element with namespace declarations copied a map of
  unbounded size). Fixed with a set and a cap of 256 namespaces in scope;
  tests with 150,000 attributes and 200,000 declaring elements added.
- Found: the PNG iTXt null-byte search could scan past the chunk on crafted
  files. Bounded to the chunk.

### Components

- Found in a real browser (Chromium, strict CSP): opening the details panel
  rebuilt the shadow tree and dropped keyboard focus, so Escape did nothing.
  Fixed: open and close update the existing elements; attribute changes keep
  focus on the equivalent control. The DOM-emulation test had dispatched the
  key event on the host and hid the bug; it now focuses the button and asserts
  that the same element keeps focus.
- Found in screenshots: the details panel overflowed a 390 px viewport
  (missing `box-sizing`). Fixed, `align="end"` added, and the browser check
  now measures overflow with the panel open.
- Found with the React wrapper: React 19 sets `kind` as a property, and the
  elements only had a getter, which threw. Setters that reflect to the
  attribute were added, with tests.
- Found: `telltale-shown` fired before framework listeners were attached.
  It now fires in a microtask, only if the element is still connected, and
  `lastShown` keeps the detail.

### API and errors

- `jsonLdScriptText` threw `TypeError` for BigInt and cyclic values, and
  `aiDisclosureHeader(null)` threw `TypeError`. Both now throw `TelltaleError`.
- The CLI refused symlinked input files (`O_NOFOLLOW` on read), which protects
  nothing. Reads now follow symlinks and require a regular file; writes still
  never follow symlinks.
- Log verification compared HMAC digests with `!==`. Replaced with a
  constant-time comparison.
- The React wrapper wrote a ref during render. Moved into an effect.
- `sideEffects` now lists the React and Vue entry points, which register the
  elements on import.

### Tests

- 895 TypeScript tests and 19 Python tests (one of them runs all 522 mark and
  137 read vectors). Line coverage 98.3 % overall.
- README examples run as tests, and their printed output must match the
  comments in the code; the React and Vue examples render in a DOM.
- Every security control has a test that fails if it is removed (XSS payloads
  in every attribute, no `style` attributes, chain tampering of each kind,
  symlink refusal, overwrite refusal, header injection, script breakout,
  size and count caps, hostile XML timing). CSP behaviour is checked in
  Chromium by `scripts/browser-check.mjs`.

## Pass 2: security and hostile input

Approach: read every parser loop, limit and output sink as an attacker would,
then try to break it.

- **Memory on crafted files.** A 64 MiB PNG of empty chunks could create over
  a million chunk records before the cap. The cap is now 100,000 for PNG and
  WebP (real files have a few thousand), in TypeScript and Python, with tests
  on both sides of it.
- **Oversized XMP.** A PNG could carry a 60 MB packet that was decoded before
  the 4 Mi scan limit applied. Packets above 12 MiB are now refused before
  decoding (same error code as before, so the shared vectors are unchanged).
- **Cross-implementation drift.** 400 seeded random mutations of real files
  are shared vectors; TypeScript and Python agree on every result and every
  output byte. Text limits count UTF-16 units in both; whitespace rules follow
  JavaScript `trim` in Python too. Edge vectors cover astral characters, BOM,
  NBSP, lone surrogates, null options, float and boolean limits.
- **Hidden characters.** Text files were scanned for bidi controls, zero-width
  characters, line separators and BOMs. The vectors file contained raw U+2028
  and U+FEFF inside JSON strings; it is now written with escapes. A test fails
  if any such character appears in a text file.
- **XML.** DOCTYPE and entity declarations are refused (billion-laughs
  fixture), unknown entities and invalid character references are refused,
  lookups use maps and allow-lists, depth, namespace and size limits hold,
  and five hostile inputs run in linear time.
- **Components.** Every attribute was fed script, event-handler, SVG,
  `javascript:` and template-injection strings; the shadow trees contain only
  text, no style attributes and no handlers. Focus restoration finds elements
  by comparing `part` values, never by building a selector from a string.
- **Log.** Unknown fields (for example an email address) are rejected on write
  and on verify; non-canonical lines, CR characters, other versions,
  algorithm switches and wrong keys are detected. Documented limitation: any
  page script can fire the event, a log entry does not prove that a person
  read the notice, and truncation needs an external head or a key.
- **Files and CLI.** Atomic writes through `O_EXCL` temporary files, no writing
  through symlinks, no overwrite without `--force`, HMAC key only from the
  environment, file names JSON-quoted in messages (terminal escape injection
  test), no stack traces.
- **Development tooling.** The browser-check server's path check accepted a
  sibling directory with the same prefix; it now requires the separator.
- **Supply chain.** Zero runtime dependencies; `npm audit --omit=dev` clean;
  `npm ci --ignore-scripts && npm run check` passes from a clean install; no
  install scripts; exact development versions at least two weeks old; CI and
  CodeQL run only on pull requests and by hand, with pinned action SHAs and
  read-only permissions. The packed tarball was installed in an empty project
  and every entry point imported; the Python wheel was built and installed in
  a clean environment.

Nothing found in this pass is left open.

## Open items for the maintainers

- Native-speaker review of the 23 translations (`nativeReviewed` stays false).
- The CLA text and the legal entity name need confirmation by counsel and the
  owner before outside contributions are accepted.
- The PyPI name `telltale` is taken; the Python distribution is named
  `afkzona-telltale` (import name `telltale`).
- The Commission's Article 50 guidelines page lists 20 July 2026 as the
  publication date, while the English PDF downloaded on 8 November 2026 is
  dated 5.11.2026 (C(2026) 7702 final). The README cites the page and the
  document number only.

## Independent review (8 November 2026)

A separate reviewer re-checked the law, the parsers, the components, the log,
the CLI, the Python package and the tests from scratch, without relying on
the passes above.

### What was checked

- **Law, from the official texts.** Regulation (EU) 2024/1689 and Regulation
  (EU) 2026/1744 were downloaded from the Publications Office (the EUR-Lex
  documents, CELEX 32024R1689 and 32026R1744) and read for Article 3 points
  (1), (3), (4), (39), (40) and (60), Article 50, Article 99, Article 111 and
  Article 113. Confirmed: Regulation (EU) 2026/1744 of 8 July 2026 is
  published in OJ L, 24.7.2026, enters into force on the third day after
  publication (its Article 4), adds Article 111(4) with the date 2 December
  2026 (Article 1, point (39)(b)) and replaces Article 50(7) (Article 1, point
  (20)). Article 50 is not among the Article 113 exceptions before or after
  the amendment. The amendment also inserts Article 5(1)(ba) and (bb)
  (applying from 2 December 2026) and Article 99(6a) for small mid-caps.
- **Commission pages.** The Article 50 guidelines page (English PDF:
  C(2026) 7702 final, dated 5.11.2026), the Code of Practice page (final code
  published 10 June 2026; Measure 1.1 and Sub-measures 1.1.1 and 1.1.2 read
  in the PDF) and the EU icons page (the quoted sentence on non-signatories)
  exist and say what the README says.
- **Specifications.** The three IPTC Digital Source Type URIs and names on
  cv.iptc.org; `AISystemUsed`, `AISystemVersionUsed` and `DigitalSourceType`
  (cardinality 0..1) in the IPTC Photo Metadata Standard 2025.1; schema.org
  `digitalSourceType` and the three enumeration members;
  draft-abaris-aicdh-01 (expiry 3 August 2026, Dictionary syntax).
- **Hostile input.** 22,000 differential fuzz cases (random mutations of every
  fixture, giant and zero lengths, duplicated and overlapping chunks, CRC
  damage, truncation, and token-level mutations of real XMP packets with
  CDATA, comments, entities, DOCTYPE, namespace and `rdf:about` variants) were
  run through TypeScript and Python. Only `TelltaleError` was thrown, and both
  implementations agreed on every result and output byte. Every merged packet
  that started well-formed was parsed again with a standard XML parser
  (ElementTree): one `DigitalSourceType` and one `rdf:about` value each, and
  the reader's values matched the parser's on 1,576 packets. Worst cases near
  the 4 Mi limit (long attributes, many attributes, elements, entities,
  namespace copies) scan in at most 1.6 s (TypeScript) and 0.9 s (Python).
- **Controls removed one at a time** (output escaping in the components, CRC
  check, digest comparison, JSON-LD escaping, header character check, log
  canonical-form check, override length cap, nesting cap, WebP chunk cap,
  symlink refusal in the writer, log file mode): each removal fails tests,
  except the cases listed below.
- **Package and examples.** The packed tarball was installed in an empty
  project; every entry point imports in Node; the README CLI commands and the
  Python example were run. The real-browser check passed in Playwright's
  Chromium (strict CSP, keyboard, axe WCAG 2.1 A/AA, light and dark, 320 px).
- **Publish gate.** Author and committer of every commit is
  antonmacius-droid; no trailer lines; no tracked file contains a tool name.

### Found and fixed

Medium:

- **XMP merge could add a second, contradicting value.** When an existing
  `DigitalSourceType` (or `AISystemUsed`, `AISystemVersionUsed`) was written
  as CDATA, contained a comment or processing instruction, was an empty
  element, used `rdf:resource` on a full tag, or was structured, the scanner
  did not see it and the merge added a second value. Other readers could then
  report the old value (for example `digitalCapture`). This broke the
  documented rule that conflicts are refused. The reader also missed values in
  CDATA. Now CDATA is read, comments and processing instructions inside a
  value are skipped, `<p/>` equals `<p></p>`, `rdf:resource` is read on both
  tag forms, and a property in a form that cannot be compared makes the merge
  fail with `XMP_UNSUPPORTED` and sets `xmpUnreadable` when reading.
- **Merged packets could break the XMP rule on `rdf:about`.** The new block
  always had `rdf:about=""`. XMP requires one value for all top-level
  descriptions, and packets written with `rdf:about="uuid:..."` would have
  become invalid for strict readers. The merge now reuses the packet's value
  (escaped) and refuses packets whose descriptions disagree.
- **Overclaim about the log.** README, SECURITY.md and the source said an HMAC
  key detects cutting entries off the end. It does not; only a stored head
  does. Text corrected; a test shows the behaviour.
- **Test suite depended on the state of the working tree.** The hygiene tests
  listed directories and then called `stat` on each entry, including
  `python/build` and virtual environments. A Python build running at the same
  time made them fail with `ENOENT` (reproduced: 2 of 8 runs). They now skip
  generated directories by name and use directory entries without a second
  `stat`. The Vitest pool is pinned to separate processes because the README
  example test changes the working directory.

Low:

- XML line-end normalisation was missing: CR LF in an attribute became two
  spaces, so a reused `rdf:about` could differ from what XML parsers see.
  Fixed in both languages; new shared vectors.
- Options and log entries read inherited properties: a polluted
  `Object.prototype` (for example `allowC2paInvalidation`, `existingXmp`,
  `maxInputBytes`) changed behaviour, and an inherited `surface` reached log
  entries without validation. All public option objects and log lines are
  now read from own properties only; tests pollute the prototype.
- CLI: `--max-bytes` accepted values above the 1 GiB cap and allocated that
  much before the library refused it; `verify-log` read up to 1 GiB, above
  what a JavaScript string can hold. Now bounded (1 GiB, 256 MiB for logs).
- CLI: two inputs with the same file name in `--out-dir` made the second fail,
  or with `--force` silently replace the first output. Now a usage error.
- Without `--force`, a file created between the existence check and the final
  rename could be replaced. The output is now put in place with a hard link,
  which fails if the name is taken (checked rename on file systems without
  hard links).
- Usage errors echoed command and `--type` values raw; now JSON-quoted.
- The React and Vue label wrappers had no `align` property.
- README: fines for small mid-caps (Article 99(6a)); the new Article
  5(1)(ba)/(bb) prohibitions and the Article 50(2) assistive-editing exception
  listed as not covered; the byte-preservation statement now names the WebP
  header and the removal of old JPEG ExtendedXMP segments on replace.
- Two controls were not pinned by their own test (removing them alone left
  the suite green, because a later check also refused the input): the
  explicit DOCTYPE refusal and the unknown-field check in log lines. Tests now
  assert their messages.

Not changed (checked, acceptable):

- The log writer's `lstat` check and `O_NOFOLLOW` each refuse a symlink on
  their own; removing one keeps the other. The race they close cannot be
  tested deterministically.
- JPEG MPF and C2PA detection read their 2- to 4-byte signatures without
  bounding them to the segment; a false match is impossible because the next
  byte is always a marker (0xFF).

### Tests after the review

- TypeScript: 964 tests in 15 files (was 895), `npm run check` clean.
- Python: 19 tests, running 546 mark and 160 read shared vectors (was 522 and
  137), mypy clean.

### Open decisions for the owner

- Existing log files are accepted with any permissions; only new files get
  0600. Refuse or warn when an existing log is group- or world-writable?
- The CI action SHAs could not be resolved from this environment (no access
  to github.com). Confirm them before the first pull request.
- Lithuanian texts use "biometrinis skirstymas į kategorijas" and
  "manipuliuotas"; the official Lithuanian AI Act uses "biometrinis
  kategorizavimas" and "dirbtinai sugeneruoti arba gauti atlikus
  manipuliacijas". Decide with the native review whether to follow the
  official terms.
- The Code of Practice page says the Commission and the Board assessed the
  code as adequate. The README calls it voluntary, which is also correct.
  Add the assessment if wanted.
