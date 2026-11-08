// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Writes test-vectors/marking.json: the case list shared by the TypeScript
// and Python test suites, with expected results computed by the built
// TypeScript implementation (run `npm run build` first). The outputs were
// checked independently (webpinfo, pngfix, djpeg, dwebp, ExifTool); see REVIEW.md.
//
// Run: npm run build && npm run vectors

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { markImage, readImageMarking } from '../dist/marking/index.js';
import { buildXmpChunk } from '../dist/marking/png.js';

const root = fileURLToPath(new URL('../test-vectors/', import.meta.url));
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const XSS = '<script>alert(1)</script>"\'><img src=x onerror=alert(1)>&amp;]]><!--';

/** Applies mutation ops. Shared semantics with test/vectors.ts and python/tests. */
export function materialise(input) {
  if (typeof input === 'string') return new Uint8Array(readFileSync(root + input));
  let b = input.base === null ? new Uint8Array(0) : new Uint8Array(readFileSync(root + input.base));
  for (const op of input.ops) {
    const hex = op.hex === undefined ? new Uint8Array(0) : Uint8Array.from(Buffer.from(op.hex, 'hex'));
    if (op.op === 'truncate') b = b.slice(0, op.length);
    else if (op.op === 'set') { b = b.slice(); b.set(hex, op.offset); }
    else if (op.op === 'xor') { b = b.slice(); hex.forEach((m, i) => { b[op.offset + i] ^= m; }); }
    else if (op.op === 'append') b = Uint8Array.from([...b, ...hex]);
    else if (op.op === 'insert') b = Uint8Array.from([...b.subarray(0, op.offset), ...hex, ...b.subarray(op.offset)]);
    else if (op.op === 'remove') b = Uint8Array.from([...b.subarray(0, op.offset), ...b.subarray(op.offset + op.length)]);
    else throw new Error('unknown op ' + op.op);
  }
  return b;
}

const F = (n) => `fixtures/${n}`;
const M = (base, ...ops) => ({ base: base === null ? null : F(base), ops });

const clean = [
  'basic.png', 'basic.jpg', 'sips.jpg', 'lossy.webp', 'lossless.webp', 'alpha.webp', 'alpha-lossless.webp',
  'animated.webp', 'webp-exif.webp', 'webp-unknown-chunk.webp', 'jpeg-mpf-after-app0.jpg', 'jpeg-fill-bytes.jpg',
];

const cases = [];
for (const f of clean) {
  cases.push({ id: `insert-default/${f}`, input: F(f), options: {} });
  cases.push({
    id: `insert-all-fields/${f}`,
    input: F(f),
    options: { digitalSourceType: 'compositeWithTrainedAlgorithmicMedia', aiSystemUsed: 'Model <β> & "Co"', aiSystemVersionUsed: '2.1 ✓' },
  });
}
cases.push(
  { id: 'insert-xss-strings/basic.png', input: F('basic.png'), options: { aiSystemUsed: XSS, aiSystemVersionUsed: XSS } },
  { id: 'insert-xss-strings/basic.jpg', input: F('basic.jpg'), options: { aiSystemUsed: XSS } },
  { id: 'insert-xss-strings/lossy.webp', input: F('lossy.webp'), options: { aiSystemUsed: XSS } },
  { id: 'composite-synthetic/basic.png', input: F('basic.png'), options: { digitalSourceType: 'compositeSynthetic' } },

  { id: 'merge/png-with-xmp', input: F('png-with-xmp.png'), options: {} },
  { id: 'replace/png-with-xmp', input: F('png-with-xmp.png'), options: { existingXmp: 'replace' } },
  { id: 'error/png-with-xmp', input: F('png-with-xmp.png'), options: { existingXmp: 'error' } },
  { id: 'merge-same/png-xmp-same-dst', input: F('png-xmp-same-dst.png'), options: {} },
  { id: 'merge-same-plus-system/png-xmp-same-dst', input: F('png-xmp-same-dst.png'), options: { aiSystemUsed: 'Example' } },
  { id: 'merge-conflict/png-xmp-other-dst', input: F('png-xmp-other-dst.png'), options: {} },
  { id: 'replace/png-xmp-other-dst', input: F('png-xmp-other-dst.png'), options: { existingXmp: 'replace' } },
  { id: 'merge/png-xmp-compressed', input: F('png-xmp-compressed.png'), options: {} },
  { id: 'replace/png-xmp-compressed', input: F('png-xmp-compressed.png'), options: { existingXmp: 'replace' } },
  { id: 'merge/png-xmp-legacy-text', input: F('png-xmp-legacy-text.png'), options: {} },
  { id: 'replace/png-xmp-legacy-text', input: F('png-xmp-legacy-text.png'), options: { existingXmp: 'replace' } },
  { id: 'merge/png-xmp-doctype', input: F('png-xmp-doctype.png'), options: {} },
  { id: 'replace/png-xmp-doctype', input: F('png-xmp-doctype.png'), options: { existingXmp: 'replace' } },
  { id: 'duplicate/png-two-xmp', input: F('png-two-xmp.png'), options: { existingXmp: 'replace' } },
  { id: 'c2pa/png-c2pa', input: F('png-c2pa.png'), options: {} },
  { id: 'c2pa-allowed/png-c2pa', input: F('png-c2pa.png'), options: { allowC2paInvalidation: true } },

  { id: 'merge/jpeg-with-xmp', input: F('jpeg-with-xmp.jpg'), options: {} },
  { id: 'replace/jpeg-with-xmp', input: F('jpeg-with-xmp.jpg'), options: { existingXmp: 'replace' } },
  { id: 'duplicate/jpeg-two-xmp', input: F('jpeg-two-xmp.jpg'), options: {} },
  { id: 'merge/jpeg-extended-xmp', input: F('jpeg-extended-xmp.jpg'), options: {} },
  { id: 'replace/jpeg-extended-xmp', input: F('jpeg-extended-xmp.jpg'), options: { existingXmp: 'replace' } },
  { id: 'layout/jpeg-xmp-after-mpf', input: F('jpeg-xmp-after-mpf.jpg'), options: {} },
  { id: 'c2pa/jpeg-c2pa', input: F('jpeg-c2pa.jpg'), options: {} },
  { id: 'c2pa-allowed/jpeg-c2pa', input: F('jpeg-c2pa.jpg'), options: { allowC2paInvalidation: true } },
  { id: 'too-large/jpeg-big-xmp', input: F('jpeg-big-xmp.jpg'), options: {} },
  { id: 'replace/jpeg-big-xmp', input: F('jpeg-big-xmp.jpg'), options: { existingXmp: 'replace' } },

  { id: 'merge/webp-with-xmp', input: F('webp-with-xmp.webp'), options: {} },
  { id: 'replace/webp-with-xmp', input: F('webp-with-xmp.webp'), options: { existingXmp: 'replace' } },
  { id: 'error/webp-with-xmp', input: F('webp-with-xmp.webp'), options: { existingXmp: 'error' } },
  { id: 'duplicate/webp-two-xmp', input: F('webp-two-xmp.webp'), options: {} },
  { id: 'flag-only/webp-xmp-no-flag', input: F('webp-xmp-no-flag.webp'), options: {} },
  { id: 'c2pa/webp-c2pa', input: F('webp-c2pa.webp'), options: {} },
  { id: 'c2pa-allowed/webp-c2pa', input: F('webp-c2pa.webp'), options: { allowC2paInvalidation: true } },

  { id: 'option/bad-source-type', input: F('basic.png'), options: { digitalSourceType: 'digitalCapture' } },
  { id: 'option/control-char', input: F('basic.png'), options: { aiSystemUsed: 'bad\u0007' } },
  { id: 'option/line-separator', input: F('basic.png'), options: { aiSystemUsed: 'bad\u2028x' } },
  { id: 'option/empty-string', input: F('basic.png'), options: { aiSystemUsed: '' } },
  { id: 'option/leading-space', input: F('basic.png'), options: { aiSystemUsed: ' x' } },
  { id: 'option/too-long', input: F('basic.png'), options: { aiSystemUsed: 'x'.repeat(257) } },
  { id: 'option/max-length-ok', input: F('basic.png'), options: { aiSystemUsed: 'x'.repeat(256) } },
  { id: 'option/astral-too-long', input: F('basic.png'), options: { aiSystemUsed: '\u{1F600}'.repeat(129) } },
  { id: 'option/astral-at-limit', input: F('basic.png'), options: { aiSystemUsed: '\u{1F600}'.repeat(128) } },
  { id: 'option/bom-edge', input: F('basic.png'), options: { aiSystemUsed: '\uFEFFx' } },
  { id: 'option/nbsp-edge', input: F('basic.png'), options: { aiSystemUsed: 'x\u00A0' } },
  { id: 'option/nbsp-inside', input: F('basic.png'), options: { aiSystemUsed: 'a\u00A0b' } },
  { id: 'option/lone-surrogate', input: F('basic.png'), options: { aiSystemUsed: 'a\uD800b' } },
  { id: 'option/null-means-default', input: F('basic.png'), options: { digitalSourceType: null, existingXmp: null } },
  { id: 'option/float-max', input: F('basic.png'), options: { maxInputBytes: 1000.5 } },
  { id: 'option/bool-max', input: F('basic.png'), options: { maxInputBytes: true } },
  { id: 'option/unknown-key', input: F('basic.png'), options: { foo: true } },
  { id: 'option/bad-policy', input: F('basic.png'), options: { existingXmp: 'merge-all' } },
  { id: 'option/bad-c2pa-flag', input: F('basic.png'), options: { allowC2paInvalidation: 'yes' } },
  { id: 'option/input-too-large', input: F('basic.png'), options: { maxInputBytes: 100 } },
  { id: 'option/input-at-limit', input: F('basic.png'), options: { maxInputBytes: 101 } },
  { id: 'option/bad-max', input: F('basic.png'), options: { maxInputBytes: 0 } },

  { id: 'garbage/empty', input: M(null), options: {} },
  { id: 'garbage/text', input: M(null, { op: 'append', hex: Buffer.from('hello, not an image').toString('hex') }), options: {} },
  { id: 'garbage/riff-not-webp', input: M(null, { op: 'append', hex: '52494646040000004156492000000000' }), options: {} },
  { id: 'garbage/riff-header-only', input: M(null, { op: 'append', hex: '524946460400000057454250' }), options: {} },

  { id: 'png/signature-only', input: M('basic.png', { op: 'truncate', length: 8 }), options: {} },
  { id: 'png/bad-signature', input: M('basic.png', { op: 'xor', offset: 1, hex: '01' }), options: {} },
  { id: 'png/truncated-in-chunk', input: M('basic.png', { op: 'truncate', length: 40 }), options: {} },
  { id: 'png/truncated-crc', input: M('basic.png', { op: 'truncate', length: 100 }), options: {} },
  { id: 'png/no-iend', input: M('basic.png', { op: 'truncate', length: 89 }), options: {} },
  { id: 'png/bad-crc', input: M('basic.png', { op: 'xor', offset: 32, hex: 'ff' }), options: {} },
  { id: 'png/huge-length', input: M('basic.png', { op: 'set', offset: 33, hex: '80000000' }), options: {} },
  { id: 'png/length-past-end', input: M('basic.png', { op: 'set', offset: 33, hex: '00001000' }), options: {} },
  { id: 'png/bad-chunk-type', input: M('basic.png', { op: 'set', offset: 37, hex: '21' }), options: {} },
  { id: 'png/trailing-data', input: M('basic.png', { op: 'append', hex: '00' }), options: {} },
  { id: 'png/missing-ihdr', input: M('basic.png', { op: 'remove', offset: 8, length: 25 }), options: {} },

  { id: 'jpeg/soi-only', input: M('basic.jpg', { op: 'truncate', length: 3 }), options: {} },
  { id: 'jpeg/truncated-in-segment', input: M('basic.jpg', { op: 'truncate', length: 100 }), options: {} },
  { id: 'jpeg/truncated-before-sos', input: M('basic.jpg', { op: 'truncate', length: 202 }), options: {} },
  { id: 'jpeg/segment-length-1', input: M('basic.jpg', { op: 'set', offset: 22, hex: '0001' }), options: {} },
  { id: 'jpeg/segment-length-huge', input: M('basic.jpg', { op: 'set', offset: 22, hex: 'ffff' }), options: {} },
  { id: 'jpeg/not-a-marker', input: M('basic.jpg', { op: 'set', offset: 20, hex: '00' }), options: {} },
  { id: 'jpeg/eoi-before-sos', input: M('basic.jpg', { op: 'insert', offset: 20, hex: 'ffd9' }), options: {} },
  { id: 'jpeg/no-sof', input: M('basic.jpg', { op: 'remove', offset: 183, length: 19 }), options: {} },
  { id: 'jpeg/stuffed-zero-marker', input: M('basic.jpg', { op: 'insert', offset: 20, hex: 'ff00' }), options: {} },
  { id: 'jpeg/nested-soi', input: M('basic.jpg', { op: 'insert', offset: 20, hex: 'ffd8' }), options: {} },
  { id: 'jpeg/only-fill-bytes', input: M(null, { op: 'append', hex: 'ffd8' + 'ff'.repeat(64) }), options: {} },

  { id: 'webp/odd-riff-size', input: M('lossy.webp', { op: 'set', offset: 4, hex: '37000000' }), options: {} },
  { id: 'webp/riff-size-too-big', input: M('lossy.webp', { op: 'set', offset: 4, hex: '38000000' }), options: {} },
  { id: 'webp/trailing-data', input: M('lossy.webp', { op: 'append', hex: '0000' }), options: {} },
  { id: 'webp/chunk-past-end', input: M('lossy.webp', { op: 'set', offset: 16, hex: 'ff000000' }), options: {} },
  { id: 'webp/unknown-first-chunk', input: M('lossy.webp', { op: 'set', offset: 12, hex: '41424344' }), options: {} },
  { id: 'webp/vp8-not-key-frame', input: M('lossy.webp', { op: 'set', offset: 20, hex: '91' }), options: {} },
  { id: 'webp/vp8-bad-start-code', input: M('lossy.webp', { op: 'set', offset: 23, hex: '00' }), options: {} },
  { id: 'webp/vp8-zero-width', input: M('lossy.webp', { op: 'set', offset: 26, hex: '0000' }), options: {} },
  { id: 'webp/truncated-header', input: M('lossy.webp', { op: 'truncate', length: 16 }), options: {} },
  { id: 'webp/vp8l-bad-signature', input: M('lossless.webp', { op: 'set', offset: 20, hex: '2e' }), options: {} },
  { id: 'webp/vp8l-bad-version', input: M('lossless.webp', { op: 'set', offset: 24, hex: '20' }), options: {} },
  { id: 'webp/vp8x-too-short', input: M('alpha.webp', { op: 'set', offset: 16, hex: '08000000' }), options: {} },
  { id: 'webp/no-chunks', input: M(null, { op: 'append', hex: '524946460400000057454250' }), options: {} },
);

// Existing packets with the IPTC properties in less common forms: CDATA,
// comments, rdf:resource, empty elements, structured values, rdf:about.
const RDFNS = 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"';
const IPTCNS = 'xmlns:I="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"';
const NEWSCODES = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
const packet = (about, inner) =>
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF ${RDFNS}><rdf:Description${about === null ? '' : ` rdf:about="${about}"`} ${IPTCNS}>${inner}</rdf:Description></rdf:RDF></x:xmpmeta>`;
const xmpForms = [
  ['cdata-other', packet('', `<I:DigitalSourceType><![CDATA[${NEWSCODES}digitalCapture]]></I:DigitalSourceType>`)],
  ['cdata-same', packet('', `<I:DigitalSourceType><![CDATA[${NEWSCODES}trainedAlgorithmicMedia]]></I:DigitalSourceType>`)],
  ['comment-inside', packet('', `<I:DigitalSourceType>${NEWSCODES}digitalCapture<!-- note --></I:DigitalSourceType>`)],
  ['resource-full-tag', packet('', `<I:DigitalSourceType rdf:resource="${NEWSCODES}trainedAlgorithmicMedia"></I:DigitalSourceType>`)],
  ['resource-and-text', packet('', `<I:DigitalSourceType rdf:resource="${NEWSCODES}digitalCapture">x</I:DigitalSourceType>`)],
  ['empty-element', packet('', '<I:DigitalSourceType/>')],
  ['structured', packet('', `<I:DigitalSourceType rdf:parseType="Resource"><rdf:value>${NEWSCODES}digitalCapture</rdf:value></I:DigitalSourceType>`)],
  ['about-uuid', packet('uuid:faf5bdd5-ba3d-11da-ad31-d33d75182f1b', '<I:AISystemVersionUsed>1</I:AISystemVersionUsed>')],
  ['about-escaped', packet('a&amp;b&quot;&lt;&#xA;', '<I:AISystemVersionUsed>1</I:AISystemVersionUsed>')],
  ['crlf', packet('a\r\nb', '<I:AISystemUsed>x\r\ny\rz<![CDATA[\r\n]]>w</I:AISystemUsed>')],
  ['about-missing', packet(null, '<I:AISystemVersionUsed>1</I:AISystemVersionUsed>')],
  ['about-disagree', `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF ${RDFNS}><rdf:Description rdf:about="a"/><rdf:Description rdf:about="b"/></rdf:RDF></x:xmpmeta>`],
];
const xmpFormInputs = xmpForms.map(([name, xml]) => [
  `xmp-form/${name}`,
  M('basic.png', { op: 'insert', offset: 33, hex: Buffer.from(buildXmpChunk(Buffer.from(xml, 'utf8'))).toString('hex') }),
]);
for (const [id, input] of xmpFormInputs) {
  cases.push({ id, input, options: {} }, { id: `${id}/with-system`, input, options: { aiSystemUsed: 'Example' } });
}

// Seeded random mutations shared by both implementations (parity fuzzing).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fuzzBases = ['basic.png', 'png-with-xmp.png', 'basic.jpg', 'sips.jpg', 'jpeg-with-xmp.jpg', 'lossy.webp', 'lossless.webp', 'alpha.webp', 'webp-with-xmp.webp', 'animated.webp'];
const r = rng(20261108);
const byte = () => Math.floor(r() * 256).toString(16).padStart(2, '0');
for (let i = 0; i < 400; i++) {
  const base = fuzzBases[i % fuzzBases.length];
  // Offsets are drawn against the current length so every op stays in bounds in both languages.
  let cur = readFileSync(root + F(base)).length;
  const ops = [];
  const steps = 1 + Math.floor(r() * 3);
  for (let k = 0; k < steps && cur > 8; k++) {
    const offset = Math.floor(r() * cur);
    const choice = Math.floor(r() * 4);
    if (choice === 0) {
      const b = byte();
      ops.push({ op: 'xor', offset, hex: b === '00' ? '01' : b });
    } else if (choice === 1) {
      const n = 1 + Math.floor(r() * 4);
      ops.push({ op: 'insert', offset, hex: Array.from({ length: n }, byte).join('') });
      cur += n;
    } else if (choice === 2) {
      const n = Math.min(1 + Math.floor(r() * 4), cur - offset);
      ops.push({ op: 'remove', offset, length: n });
      cur -= n;
    } else {
      ops.push({ op: 'set', offset: Math.min(offset, cur - 4), hex: ['ffffffff', '7fffffff', '00000000', '00000001'][Math.floor(r() * 4)] });
    }
  }
  cases.push({ id: `fuzz/${i}/${base}`, input: M(base, ...ops), options: i % 3 === 0 ? { existingXmp: 'replace' } : {} });
}

const fixtures = [
  ...clean, 'png-with-xmp.png', 'png-xmp-same-dst.png', 'png-xmp-other-dst.png', 'png-xmp-compressed.png',
  'png-xmp-legacy-text.png', 'png-xmp-doctype.png', 'png-two-xmp.png', 'png-c2pa.png', 'jpeg-with-xmp.jpg',
  'jpeg-two-xmp.jpg', 'jpeg-extended-xmp.jpg', 'jpeg-xmp-after-mpf.jpg', 'jpeg-c2pa.jpg', 'jpeg-big-xmp.jpg',
  'webp-with-xmp.webp', 'webp-two-xmp.webp', 'webp-xmp-no-flag.webp', 'webp-c2pa.webp',
];

function expectation(fn) {
  try {
    return fn();
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) return { error: e.code };
    throw e;
  }
}

const mark = cases.map((c) => ({
  ...c,
  expect: expectation(() => {
    const r = markImage(materialise(c.input), c.options);
    return { action: r.action, format: r.format, length: r.bytes.length, sha256: sha256(r.bytes) };
  }),
}));

const read = [
  ...fixtures.map((f) => [`read/${f}`, F(f)]),
  ...xmpFormInputs.map(([id, input]) => [`read/${id}`, input]),
].map(([id, input]) => ({ id, input, expect: expectation(() => ({ ...readImageMarking(materialise(input)) })) }));
for (const c of mark) {
  if ('error' in c.expect) continue;
  read.push({
    id: `read-after/${c.id}`,
    input: c.input,
    markOptions: c.options,
    expect: expectation(() => ({ ...readImageMarking(markImage(materialise(c.input), c.options).bytes) })),
  });
}

// Escape every non-ASCII character so the file holds no invisible or bidi characters.
const json = JSON.stringify({ version: 1, mark, read }, null, 1).replace(/[^\x00-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
writeFileSync(root + 'marking.json', json + '\n');
console.log(`wrote ${mark.length} mark cases and ${read.length} read cases`);
