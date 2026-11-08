# Telltale

Building blocks for the transparency rules in Article 50 of the EU AI Act:
disclosure notices, labels for AI-generated content, machine-readable marking
of generated images, and a tamper-evident log of disclosures shown.

Not legal advice. Using Telltale does not by itself make anyone compliant.

## Why it exists

Regulation (EU) 2024/1689, the AI Act ([EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)),
requires in [Article 50](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689#art_50)
that people are told when they talk to an AI system, when they see deep fakes
or AI-generated public-interest text, and when an emotion recognition or
biometric categorisation system is used on them. Providers of generative AI
must also mark outputs in a machine-readable way.

Dates, from the official text:

| Date | What | Source |
|---|---|---|
| 2 August 2026 | Article 50 applies. The Regulation applies from this date, and Chapter IV (Article 50) is not among the exceptions. | [Article 113](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689#art_113), second paragraph |
| 2 December 2026 | Providers of generative AI systems placed on the market before 2 August 2026 must comply with Article 50(2) (marking) by this date. | Article 111(4), added by Article 1, point (39)(b) of [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) (Digital Omnibus on AI, OJ L 24.7.2026) |

Infringements of Article 50 can be fined up to EUR 15 million or 3 % of
worldwide annual turnover, whichever is higher; for SMEs, and for small
mid-caps (SMCs), whichever is lower:
[Article 99(4)(g) and (6)](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689#art_99),
and Article 99(6a) added by Regulation (EU) 2026/1744.

Article 50 prescribes no wording, no icon and no technique. The Commission
has published two documents that explain how it reads the obligations:

- [Guidelines on the transparency obligations under Article 50](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
  (English PDF: C(2026) 7702 final).
- [Code of Practice on Transparency of AI-Generated Content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
  (final version published 10 June 2026; voluntary) and the
  [EU icons for labelling AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content).

Telltale does not implement the Code of Practice. Where the Code says more
than this package does, the sections below say so.

## Quick start

> **Before the first npm release:** `@afkzona/telltale` is published to npm from v0.2.0 ([roadmap](https://github.com/afkzonagroup/telltale/milestone/1)). Until then, build it from source: clone https://github.com/afkzonagroup/telltale, run `npm ci && npm run build && npm pack`, and install the resulting `.tgz` file wherever the steps below install `@afkzona/telltale`.

```sh
npm install @afkzona/telltale
```

Show the chatbot notice. With a bundler, register the elements once in your app code:

```js
import '@afkzona/telltale/components/auto';
```

Without a bundler, serve the package's `dist/` folder from your own origin and
load it as a module (an inline script would need `unsafe-inline`):

```html
<script type="module" src="/telltale/components/auto.js"></script>
```

Then use the elements:

```html
<ai-disclosure dismissible></ai-disclosure>
<ai-label kind="deepfake-image" details></ai-label>
```

Mark a generated image:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { markImage, readImageMarking } from '@afkzona/telltale';

const input = new Uint8Array(await readFile('generated.png'));
const { bytes, action } = markImage(input, {
  digitalSourceType: 'trainedAlgorithmicMedia',
  aiSystemUsed: 'Example Image Model',
  aiSystemVersionUsed: '2.0',
});
await writeFile('generated.marked.png', bytes);

const marking = readImageMarking(bytes);
console.log(action, marking.generativeAi, marking.digitalSourceTypes[0]);
// inserted true http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
```

## What is in the package

| Entry point | Runs in | Contents |
|---|---|---|
| `@afkzona/telltale` | browser, Node, workers | texts, image marking, JSON-LD and header helpers, disclosure log |
| `@afkzona/telltale/components` | browser | `<ai-disclosure>`, `<ai-label>`, `defineTelltaleElements()` |
| `@afkzona/telltale/components/auto` | browser | registers both elements |
| `@afkzona/telltale/react` | React 18 or 19 | `AiDisclosure`, `AiLabel` |
| `@afkzona/telltale/vue` | Vue 3.3+ | `AiDisclosure`, `AiLabel` |
| `@afkzona/telltale/node` | Node 22+ | `DisclosureLogFile`, CLI runner |
| `telltale` (bin) | Node 22+ | `telltale mark`, `telltale read`, `telltale verify-log` |
| `python/` (`import telltale`) | Python 3.10+ | image marking, byte-identical to the TypeScript code |

## Disclosure texts

Eight situations, short and long text, in all 24 official EU languages.

```ts
import { getDisclosure, languagesNeedingReview } from '@afkzona/telltale';

const notice = getDisclosure('chatbot', 'de-AT');
console.log(notice.lang, notice.short, notice.article, notice.source);
// de Sie chatten mit einem KI-System. 50(1) translation

console.log(languagesNeedingReview().length);
// 23
```

| Kind | Provision | Who |
|---|---|---|
| `chatbot` | Article 50(1) | provider |
| `deepfake-image`, `deepfake-audio`, `deepfake-video` | Article 50(4), first subparagraph | deployer |
| `deepfake-creative` (evidently artistic, creative, satirical or fictional work) | Article 50(4), first subparagraph | deployer |
| `public-interest-text` | Article 50(4), second subparagraph | deployer |
| `emotion-recognition`, `biometric-categorisation` | Article 50(3) | deployer |

English is written for this project. The other 23 languages (bg, cs, da, de,
el, es, et, fi, fr, ga, hr, hu, it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv) are
translations by the maintainers, marked `source: "translation"` and
`nativeReviewed: false`. **They need review by native speakers before
production use.** None of them is an official EU text. Irish and Maltese need
review most.

The long texts for Article 50(3) point to "the privacy notice". Make sure you
have one: Article 50(3) also requires processing under the GDPR.

## Web components

```html
<ai-disclosure dismissible remember="session"></ai-disclosure>
```

`<ai-disclosure>` (Article 50(1), and 50(3) with `kind="emotion-recognition"`
or `kind="biometric-categorisation"`):

- shows the full notice as soon as it is in the page, so it is visible no
  later than the first interaction;
- can be hidden only when `dismissible` is set; hiding collapses it to a
  persistent short label with a "More information" button, it never disappears;
- fires `telltale-shown` (once, after insertion), `telltale-dismissed` and
  `telltale-expanded`, with `{ kind, lang, variant, text }` for your log.

`<ai-label>` (Article 50(4)) labels an image, video, audio player or text:

```html
<figure>
  <img src="generated.png" alt="Product photo generated by AI">
  <ai-label kind="deepfake-image" details></ai-label>
</figure>
```

With `details`, the label is a button that opens the long text; Escape and a
click outside close it. Escape works wherever focus is, because Safari does
not focus a button that is clicked. With `compact`, only the badge is visible and the full
text stays available to screen readers. Put the official EU icon in the
`icon` slot if you use it (`<img slot="icon" alt="" src="...">`); Telltale does
not ship the icons. The Commission's icon page says use by non-signatories of
the Code "should not be construed as signaling of their adherence to the code".

### Attributes

| Attribute | `<ai-disclosure>` | `<ai-label>` |
|---|---|---|
| `kind` | default `chatbot` | default `deepfake-image` |
| `lang` | element, nearest ancestor, then `<html lang>`; falls back to English | same |
| `text` | override the short label | override the label text |
| `long-text` | override the notice | override the details text |
| `dismissible` | allow collapsing to the label | |
| `remember="session"` | stay collapsed for the browser session (`sessionStorage`) | |
| `announce` | polite live region, for widgets opened after page load | |
| `compact` | | badge only, text for screen readers |
| `details` | | button with a details panel |
| `align="end"` | | open the panel towards the start edge |

Override texts are limited to 1,000 characters and always rendered as text.

### Styling

Custom properties: `--telltale-bg`, `--telltale-fg`, `--telltale-border`,
`--telltale-badge-bg`, `--telltale-badge-fg`, `--telltale-button-bg`,
`--telltale-button-fg`, `--telltale-focus`, `--telltale-radius`,
`--telltale-font`, `--telltale-font-size`. Defaults meet WCAG 2.1 AA contrast
in light and dark mode. Keep that when you change them.

Parts: `notice`, `notice-text`, `hide`, `mini`, `badge`, `mini-text`, `expand`
(disclosure); `label`, `badge`, `text`, `toggle`, `details`, `details-text`,
`close` (label). Example: `ai-label::part(label) { font-weight: 600; }`.

### Content Security Policy

The components need no `unsafe-inline` and no `unsafe-eval`:

```
Content-Security-Policy: script-src 'self'; style-src 'self'
```

Styles are applied with constructable stylesheets, so there are no `<style>`
elements and no `style` attributes. Load the module from your own origin (or
add its host to `script-src`). Browsers without constructable stylesheets
show the components unstyled but working.

### Accessibility

Checked with axe-core (WCAG 2.1 A and AA rules), light and dark, collapsed
and expanded, plus keyboard tests: visible focus, focus moves to the next
control when the notice collapses, Escape closes details and returns focus,
no horizontal scrolling at 320 px. This does not replace testing your page
with users and assistive technologies.

### Browser support

Every pull request runs the browser check in Playwright's Chromium, Firefox
and WebKit (the engine of Safari): rendering under the strict CSP above,
keyboard and focus, axe-core, 320 px, and React and Vue server rendering
followed by hydration. All checks pass in all three engines with Playwright
1.64.1 (Chromium 156, Firefox 157, WebKit 27.2). One difference is built into
the test: Safari and WebKit on macOS move Tab between text fields only by
default, so the keyboard tests press Option-Tab there, as a Safari user with
that default does. Run it yourself with `npm run test:browser`
([CONTRIBUTING.md](CONTRIBUTING.md#browser-check)).

## React

```sh
npm install @afkzona/telltale react
```

```tsx
import { AiDisclosure, AiLabel } from '@afkzona/telltale/react';

export function Chat({ onShown }: { onShown: (text: string) => void }) {
  return (
    <section aria-label="Support chat">
      <AiDisclosure dismissible remember="session" onShown={(d) => { onShown(d.text); }} />
      <figure>
        <img src="/generated.png" alt="Product photo generated by AI" />
        <AiLabel kind="deepfake-image" details />
      </figure>
    </section>
  );
}
```

Booleans become present-or-absent attributes, so `dismissible={false}` is
really off.

## Vue

```sh
npm install @afkzona/telltale vue
```

```ts
import { defineComponent } from 'vue';
import { AiDisclosure, AiLabel } from '@afkzona/telltale/vue';

export const Chat = defineComponent({
  components: { AiDisclosure, AiLabel },
  emits: ['shown'],
  template: `
    <section aria-label="Support chat">
      <AiDisclosure dismissible @shown="(d) => $emit('shown', d.text)" />
      <AiLabel kind="public-interest-text" details />
    </section>`,
});
```

In a single-file component, use the same template. No `isCustomElement`
setting is needed because the wrappers are Vue components.

## Image marking (Article 50(2))

`markImage` writes an XMP packet with the IPTC property
`Iptc4xmpExt:DigitalSourceType` ([IPTC Photo Metadata Standard 2025.1](https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata))
set to a value from the [IPTC Digital Source Type NewsCodes](https://cv.iptc.org/newscodes/digitalsourcetype/):

| Option value | URI | IPTC name |
|---|---|---|
| `trainedAlgorithmicMedia` (default) | `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia` | Created using Generative AI |
| `compositeWithTrainedAlgorithmicMedia` | `http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia` | Edited using Generative AI |
| `compositeSynthetic` | `http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic` | Composite including generative AI elements |

Optionally it adds `Iptc4xmpExt:AISystemUsed` and `Iptc4xmpExt:AISystemVersionUsed`.

| Format | Where the XMP goes | Spec |
|---|---|---|
| PNG | uncompressed `iTXt` chunk, keyword `XML:com.adobe.xmp`, right after `IHDR`, CRC computed | [W3C PNG 3rd edition](https://www.w3.org/TR/png-3/), [XMP Part 3](https://github.com/adobe/XMP-Toolkit-SDK/blob/main/docs/XMPSpecificationPart3.pdf) 1.1.5 |
| JPEG | `APP1` with `http://ns.adobe.com/xap/1.0/\0`, after JFIF/Exif, before the frame header; packet at most 65,502 bytes | XMP Part 3 1.1.3, ITU-T T.81 Annex B |
| WebP | `XMP ` chunk, XMP flag set in `VP8X`; simple VP8/VP8L files get a `VP8X` chunk with the right canvas size and alpha flag | [RFC 9649](https://www.rfc-editor.org/rfc/rfc9649), RFC 6386 9.1 |

Behaviour:

- The input is never modified; a new array is returned. Every byte outside
  the XMP segment is copied unchanged (tested by removing the new segment and
  comparing with the input), with these exceptions: for WebP the RIFF size
  and the `VP8X` header change (a `VP8X` chunk is added to simple files, the
  XMP flag is set); with `existingXmp: "replace"`, old JPEG ExtendedXMP
  segments are removed, because the new packet does not refer to them.
- Existing XMP is merged by default: other metadata stays, the same value is
  left alone (`action: "unchanged"`), a different value fails with
  `XMP_CONFLICT`, and a value Telltale cannot compare (for example a
  structured value) fails with `XMP_UNSUPPORTED`. The new properties reuse
  the packet's `rdf:about` value. `existingXmp: "replace"` discards the old packet,
  `"error"` refuses.
- Files with a C2PA manifest fail with `C2PA_PRESENT`, because adding XMP
  breaks the manifest's hash binding. Set `allowC2paInvalidation` only if you
  re-sign afterwards.
- Malformed files fail with a `TelltaleError` code (`TRUNCATED`, `MALFORMED`,
  `BAD_CRC`, `TRAILING_DATA`, ...). Size limit: 64 MiB by default
  (`maxInputBytes`, at most 1 GiB).

| Option | Default | Notes |
|---|---|---|
| `digitalSourceType` | `trainedAlgorithmicMedia` | one of the three codes above |
| `aiSystemUsed`, `aiSystemVersionUsed` | none | 1-256 characters, no control characters |
| `existingXmp` | `merge` | `merge`, `replace`, `error` |
| `allowC2paInvalidation` | `false` | |
| `maxInputBytes` | 67108864 | 1 to 1073741824 |

`readImageMarking(bytes)` reports what is there (`generativeAi`,
`digitalSourceTypes`, `c2paPresent`, ...). It is informational only.

### This is not enough on its own

Article 50(2) asks for marking that is "effective, interoperable, robust and
reliable as far as this is technically feasible", taking into account the
state of the art. Unsigned XMP is easy to remove and to forge, and many
platforms strip metadata on upload. The Code of Practice (Measure 1.1) expects,
for images, audio, video and containerised text, at least two layers: digitally
signed metadata and an imperceptible watermark. Telltale writes neither a
watermark nor a signature. C2PA signed manifests ([c2pa.org](https://c2pa.org/))
are out of scope for 0.1. Use Telltale's XMP as one layer, next to a
watermarking and signing solution.

## Text on web pages

```ts
import { aiDisclosureHeader, jsonLdForAiContent, jsonLdScriptText } from '@afkzona/telltale';

// JSON-LD for an AI-generated article (put it in <script type="application/ld+json">).
const jsonLd = jsonLdScriptText(jsonLdForAiContent({ type: 'NewsArticle' }));
console.log(jsonLd);
// {"@context":"https://schema.org","@type":"NewsArticle","digitalSourceType":"https://schema.org/TrainedAlgorithmicMediaDigitalSource"}

// Experimental HTTP header from an expired Internet-Draft; not a standard.
const header = aiDisclosureHeader({ mode: 'machine-generated', model: 'example-model' });
console.log(`${header.name}: ${header.value}`);
// AI-Disclosure: mode=machine-generated, model="example-model"
```

- JSON-LD uses the schema.org property [`digitalSourceType`](https://schema.org/digitalSourceType).
- The `AI-Disclosure` header follows the individual Internet-Draft
  [draft-abaris-aicdh-01](https://www.ietf.org/archive/id/draft-abaris-aicdh-01.txt),
  which expired on 3 August 2026 and is not an IETF standard. It is an
  experimental hint only.
- Neither marks the text itself: copy and paste removes both. For free-form
  text the Code of Practice expects watermarking, which Telltale does not do.
- For readers, use a visible `<ai-label kind="public-interest-text">`.

## Disclosure log

Evidence that a notice was shown: an append-only JSON Lines file in which each
entry carries the hash of the previous one.

```ts
import { randomSessionPseudonym, sha256Hex, verifyDisclosureLog } from '@afkzona/telltale';
import { DisclosureLogFile } from '@afkzona/telltale/node';
import { readFile } from 'node:fs/promises';

// Server side: record that a notice was shown. The browser sends kind, lang and text
// from the <ai-disclosure> "telltale-shown" event; validate them before use.
const log = await DisclosureLogFile.open({ dir: '.', name: 'disclosures.jsonl' });
const shownText = 'You are chatting with an AI system, not a person. Its replies are generated automatically.';
await log.append({
  event: 'shown',
  kind: 'chatbot',
  lang: 'en',
  textSha256: await sha256Hex(shownText),
  session: randomSessionPseudonym(),
  surface: 'web-chat',
});
const head = log.head; // store this somewhere else, e.g. in your database
await log.close();

if (head === null) throw new Error('empty log');
const result = await verifyDisclosureLog(await readFile('disclosures.jsonl', 'utf8'), { expectedHead: head });
console.log(result.ok, result.ok ? result.count : result.reason);
// true 1
```

- Changing, deleting, inserting or reordering an entry makes
  `verifyDisclosureLog` fail with `LOG_TAMPERED`.
- Cutting entries off the end is only detectable against a head (`seq` and
  `hash`) stored somewhere else. `hmacKey` (32+ bytes, kept away from the log)
  does not detect that, but it makes rewriting the whole file detectable
  without a head.
- Entries contain no names, emails, IP addresses or user agents. `session` is
  a pseudonym: `randomSessionPseudonym()` (random, not linkable) or
  `deriveSessionPseudonym(key, sessionId)` (stable per session, HMAC with a key
  you can rotate). A linkable pseudonym is still personal data under the GDPR.
- `DisclosureLogFile` verifies the chain when it opens a file, creates files
  with mode 0600, refuses symlinks, and supports one writer per file. An
  existing log that its group or others can write is refused unless you open it
  with `permissions: 'fix'` (restrict to 0600) or `permissions: 'allow'`.
- Telltale ships no HTTP endpoint. If browsers report `telltale-shown` events
  to your server, that endpoint is yours to protect: same-origin or CSRF
  check, rate limit, small body limit, and only the fields `append` accepts.

## CLI

```sh
npx telltale mark generated.png --out generated.marked.png --ai-system "Example Image Model"
npx telltale mark out/*.webp --out-dir marked/
npx telltale read generated.marked.png
TELLTALE_KEY=<64+ hex chars> npx telltale verify-log disclosures.jsonl --hmac-key-env TELLTALE_KEY
```

The CLI never overwrites a file without `--force`, writes atomically and
prints one JSON line per file. Exit codes: 0 success, 1 a file failed,
2 usage error.

## Python

For image pipelines. Standard library only, Python 3.10+.

```sh
pip install ./python
```

```python
from telltale import mark_image, read_image_marking

with open("generated.png", "rb") as f:
    result = mark_image(f.read(), ai_system_used="Example Image Model")
with open("generated.marked.png", "wb") as f:
    f.write(result.data)
print(result.action, read_image_marking(result.data).generative_ai)  # inserted True
```

The Python and TypeScript code produce byte-identical files: both run the
same 500+ test vectors in `test-vectors/marking.json`. See
[python/README.md](python/README.md).

## How Telltale maps to Article 50

| Provision | Requires | Telltale provides | Not covered |
|---|---|---|---|
| [50(1)](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689#art_50) (providers) | People interacting with an AI system are informed, unless obvious to a reasonably well-informed, observant and circumspect person | `<ai-disclosure>`, chatbot texts, `telltale-shown` event, disclosure log | Deciding whether the "obvious" exception applies; voice and phone (spoken notices); AI agents acting by email; child-friendly wording for systems used by children |
| 50(2) (providers, incl. general-purpose AI systems) | Synthetic audio, image, video and text marked machine-readable and detectable; effective, interoperable, robust, reliable as far as technically feasible | XMP `DigitalSourceType` for PNG, JPEG, WebP (TS, CLI, Python); JSON-LD and an experimental header for web text | Watermarks, signed metadata and C2PA; audio and video files; detection services; text watermarking; robustness against stripping; deciding whether the exception for assistive editing functions applies. XMP alone is likely not sufficient (see above) |
| 50(3) (deployers) | People exposed to emotion recognition or biometric categorisation are informed; data processed under the GDPR | `<ai-disclosure kind="emotion-recognition">` and `kind="biometric-categorisation"`, texts | Signs in physical spaces; GDPR duties (privacy notice, legal basis, DPIA); whether the system is allowed at all (Article 5(1)(f) bans emotion recognition at work and in education, with medical and safety exceptions; Article 5(1)(g) bans some biometric categorisation) |
| 50(4), first subparagraph (deployers) | Deep fakes disclosed; for evidently artistic, creative, satirical or fictional works, disclosure that does not hamper the work | `<ai-label kind="deepfake-image">` (and `-audio`, `-video`), `deepfake-creative` text, XMP | Deciding what is a deep fake; labels burned into the media; spoken disclosure in audio; the EU icons (use the `icon` slot); whether the system is allowed at all (Article 5(1)(ba) and (bb), inserted by Regulation (EU) 2026/1744 and applying from 2 December 2026, prohibit, under the conditions of Article 5(1a), AI systems that generate or manipulate realistic intimate images of identifiable people without their explicit consent, and child sexual abuse material; a label does not make such use lawful) |
| 50(4), second subparagraph (deployers) | AI-generated or manipulated text published to inform the public on matters of public interest is disclosed, unless human review or editorial control and editorial responsibility | `<ai-label kind="public-interest-text">`, JSON-LD | Deciding whether the editorial exception applies; records of editorial review |
| 50(5) | Clear and distinguishable, at the latest at first interaction or exposure, meeting accessibility requirements | Shown on insertion; not dismissible unless configured; persistent label; WCAG 2.1 AA checks; 24 languages | Your page's accessibility and placement; translations need native review |
| 50(6), 50(7) | Other law still applies; codes of practice (50(7) as amended by Regulation (EU) 2026/1744) | Links to the Commission's code and guidelines | Signing or following the Code of Practice |

All law-enforcement exceptions in Article 50 are out of scope.

## Limitations

- No watermarking, no signatures, no C2PA, no audio or video containers.
- XMP is read only from the standard JPEG packet (not ExtendedXMP); compressed
  PNG XMP can be replaced but not merged.
- C2PA detection checks container signatures; it does not validate manifests.
- The components cannot judge whether a disclosure is needed or sufficient
  in your context.
- Translations are not reviewed by native speakers yet.

## Dependencies

None at runtime. React and Vue are optional peer dependencies, needed only for
the wrappers. Development tools (TypeScript, ESLint, Vitest, happy-dom, React,
Vue, and for the browser check playwright-core, axe-core and esbuild) are
pinned in `package-lock.json`. The Python package uses only the
standard library; `mypy` is used in development.

## Security

See [SECURITY.md](SECURITY.md) for the threat model and how to report a
vulnerability privately.

## Licence

Apache License 2.0. Copyright 2026 MB AFKzona Group. See [LICENSE](LICENSE)
and [NOTICE](NOTICE). "Telltale" is a trademark of MB AFKzona Group; forks must
use another name ([TRADEMARKS.md](TRADEMARKS.md)).

## Enterprise

AFKzona Group offers, outside this repository: a hosted dashboard for
disclosure logs, continuous monitoring of many sites, SSO/SAML, roles, audit
evidence packs, a legal-update feed, and support with an SLA. Contact
info@afkzonagroup.lt.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests need a signed
[CLA](CLA.md). Native-speaker reviews of the translations are especially welcome.

## Disclaimer

This software and its documentation are not legal advice. They describe the
law as published on EUR-Lex on 8 November 2026. Check the current official
text and get advice for your situation.

Maintained by AFKzona Group.
