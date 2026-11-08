/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TelltaleError } from '../src/errors.js';
import {
  buildXmpPacket,
  decodeEntities,
  escapeXmlText,
  MAX_XMP_DEPTH,
  MAX_XMP_SCAN_LENGTH,
  mergeIntoPacket,
  scanXmp,
  validateTextValue,
  xmpValues,
} from '../src/marking/xmp.js';

const RDF = 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"';
const IPTC = 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/';
const DST = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
const wrap = (inner: string): string => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF ${RDF}>${inner}</rdf:RDF></x:xmpmeta>`;

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof TelltaleError) return e.code;
    throw e;
  }
  return undefined;
}

describe('building packets', () => {
  it('produces a packet the scanner reads back', () => {
    const p = buildXmpPacket(xmpValues('trainedAlgorithmicMedia', 'A & <B>', '1'));
    expect(p.startsWith('<?xpacket begin="\uFEFF"')).toBe(true);
    expect(p.endsWith('<?xpacket end="r"?>')).toBe(true);
    const s = scanXmp(p);
    expect(s.values.DigitalSourceType).toEqual([DST]);
    expect(s.values.AISystemUsed).toEqual(['A & <B>']);
    expect(s.rdfCount).toBe(1);
  });

  it('escapes markup in text', () => {
    expect(escapeXmlText('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;');
  });
});

describe('validating text values', () => {
  it('accepts normal text and rejects bad text', () => {
    expect(validateTextValue('v', 'Model 1')).toBe('Model 1');
    for (const bad of [1, '', ' x', 'x ', 'a\nb', 'a\u0000', 'a\u009f', 'a\u2029', '\ud800', 'x'.repeat(257)]) {
      expect(code(() => validateTextValue('v', bad))).toBe('INVALID_OPTION');
    }
    expect(validateTextValue('v', '\u{1F600}')).toBe('\u{1F600}');
  });
});

describe('entities', () => {
  it('decodes predefined and numeric references', () => {
    expect(decodeEntities('&lt;&gt;&amp;&quot;&apos;&#65;&#x42;')).toBe('<>&"\'AB');
    expect(decodeEntities('plain')).toBe('plain');
  });
  it('rejects unknown, unterminated and invalid references', () => {
    for (const bad of ['&foo;', '&lol;', '& x', '&#0;', '&#xD800;', '&#x110000;', '&#12345678;', '&averyveryverylongname;']) {
      expect(code(() => decodeEntities(bad))).toBe('XMP_UNSUPPORTED');
    }
  });
});

describe('scanning', () => {
  it('reads the attribute form with any prefix', () => {
    const s = scanXmp(wrap(`<rdf:Description xmlns:e="${IPTC}" e:DigitalSourceType="${DST}"/>`));
    expect(s.values.DigitalSourceType).toEqual([DST]);
  });

  it('reads the rdf:resource form', () => {
    const s = scanXmp(wrap(`<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType rdf:resource="${DST}"/></rdf:Description>`));
    expect(s.values.DigitalSourceType).toEqual([DST]);
  });

  it('ignores the right local name in the wrong namespace', () => {
    const s = scanXmp(wrap(`<rdf:Description xmlns:Iptc4xmpExt="http://example.com/"><Iptc4xmpExt:DigitalSourceType>${DST}</Iptc4xmpExt:DigitalSourceType></rdf:Description>`));
    expect(s.values.DigitalSourceType).toEqual([]);
  });

  it('honours prefix rebinding in nested scopes', () => {
    const xml = wrap(
      `<rdf:Description xmlns:p="${IPTC}"><p:DigitalSourceType>a</p:DigitalSourceType>` +
        `<p:x xmlns:p="http://other/"><p:DigitalSourceType>b</p:DigitalSourceType></p:x></rdf:Description>`,
    );
    expect(scanXmp(xml).values.DigitalSourceType).toEqual(['a']);
  });

  it('reports structured values as unreadable instead of reading them', () => {
    const xml = wrap(
      `<rdf:Description xmlns:p="${IPTC}"><p:AISystemUsed><rdf:Alt><rdf:li>x</rdf:li></rdf:Alt></p:AISystemUsed></rdf:Description>`,
    );
    const s = scanXmp(xml);
    expect(s.values.AISystemUsed).toEqual([]);
    expect(s.unreadable).toEqual(['AISystemUsed']);
  });

  it('reads CDATA and skips comments and processing instructions inside values', () => {
    const xml = wrap(
      `<rdf:Description xmlns:p="${IPTC}"><p:AISystemVersionUsed> <![CDATA[1 <&> 2]]> </p:AISystemVersionUsed>` +
        `<p:DigitalSourceType>http://a<!-- x -->/b<?pi y?>&amp;c</p:DigitalSourceType></rdf:Description>`,
    );
    const s = scanXmp(xml);
    expect(s.values.AISystemVersionUsed).toEqual(['1 <&> 2']);
    expect(s.values.DigitalSourceType).toEqual(['http://a/b&c']);
    expect(s.unreadable).toEqual([]);
  });

  it('reads rdf:resource on full and empty-element tags, and empty values', () => {
    const xml = wrap(
      `<rdf:Description xmlns:p="${IPTC}"><p:DigitalSourceType rdf:resource="${DST}"> </p:DigitalSourceType>` +
        `<p:AISystemUsed/><p:AISystemVersionUsed rdf:resource="v">text</p:AISystemVersionUsed></rdf:Description>`,
    );
    const s = scanXmp(xml);
    expect(s.values.DigitalSourceType).toEqual([DST]);
    expect(s.values.AISystemUsed).toEqual(['']);
    expect(s.values.AISystemVersionUsed).toEqual([]);
    expect(s.unreadable).toEqual(['AISystemVersionUsed']);
  });

  it('normalises line ends like an XML processor', () => {
    const xml = wrap(`<rdf:Description rdf:about="a\r\nb&#xD;" xmlns:p="${IPTC}"><p:AISystemUsed>x\r\ny\rz<![CDATA[\r\n]]>w&#xD;v</p:AISystemUsed></rdf:Description>`);
    const s = scanXmp(xml);
    expect(s.abouts).toEqual(['a b\r']);
    expect(s.values.AISystemUsed).toEqual(['x\ny\nz\nw\rv']);
  });

  it('collects rdf:about of top-level descriptions only', () => {
    const xml = wrap(
      `<rdf:Description rdf:about="uuid:a&amp;b"><x:p xmlns:x="u" rdf:parseType="Resource"><rdf:Description rdf:about="inner"/></x:p></rdf:Description>`,
    );
    expect(scanXmp(xml).abouts).toEqual(['uuid:a&b']);
  });

  it('skips comments and processing instructions', () => {
    const s = scanXmp(`<?xpacket begin=""?><!-- <rdf:RDF> -->${wrap('')}<?xpacket end="w"?>   `);
    expect(s.rdfCount).toBe(1);
  });

  it('rejects DOCTYPE, so entity expansion is impossible', () => {
    const bomb = `<!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>${wrap('&b;')}`;
    expect(code(() => scanXmp(bomb))).toBe('XMP_UNSUPPORTED');
    expect(() => scanXmp(bomb)).toThrow(/DOCTYPE/);
    expect(() => scanXmp(`<a><!ENTITY x "y"></a>`)).toThrow(/DOCTYPE/);
  });

  it.each([
    ['unclosed element', '<a>'],
    ['mismatched end tag', '<a></b>'],
    ['undeclared prefix', '<p:a></p:a>'],
    ['duplicate attribute', '<a x="1" x="2"/>'],
    ['unquoted attribute', '<a x=1/>'],
    ['missing space between attributes', '<a x="1"y="2"/>'],
    ['lt in attribute', '<a x="<"/>'],
    ['unterminated comment', '<!-- x'],
    ['unterminated PI', '<?x'],
    ['unterminated CDATA', '<a><![CDATA[x</a>'],
    ['CDATA outside root', '<![CDATA[x]]>'],
    ['unterminated start tag', '<a x="1"'],
    ['unterminated attribute value', '<a x="1></a>'],
    ['attribute without value', '<a x></a>'],
    ['bad empty-element tag', '<a /x>'],
    ['malformed end tag', '<a></a x>'],
    ['invalid name', '<1a/>'],
    ['empty local name', `<a xmlns:p="u"><p:></p:></a>`],
    ['xmlns prefix redefined', '<a xmlns:xmlns="u"/>'],
    ['empty namespace for prefix', '<a xmlns:p=""/>'],
    ['end tag at top level', '</a>'],
  ])('rejects %s', (_name, xml) => {
    expect(code(() => scanXmp(xml))).toBe('XMP_UNSUPPORTED');
  });

  it('limits nesting depth', () => {
    const ok = '<a>'.repeat(MAX_XMP_DEPTH) + '</a>'.repeat(MAX_XMP_DEPTH);
    expect(() => scanXmp(ok)).not.toThrow();
    const deep = '<a>'.repeat(MAX_XMP_DEPTH + 1) + '</a>'.repeat(MAX_XMP_DEPTH + 1);
    expect(code(() => scanXmp(deep))).toBe('XMP_UNSUPPORTED');
  });

  it('limits namespace declarations in scope', () => {
    const decls = (n: number): string => Array.from({ length: n }, (_, i) => `xmlns:p${i}="u${i}"`).join(' ');
    expect(() => scanXmp(`<a ${decls(250)}/>`)).not.toThrow();
    expect(code(() => scanXmp(`<a ${decls(300)}/>`))).toBe('XMP_UNSUPPORTED');
    expect(code(() => scanXmp(`<a ${decls(200)}><b ${decls(100).replace(/p(\d)/g, 'q$1')}/></a>`))).toBe('XMP_UNSUPPORTED');
  });

  it('limits packet size', () => {
    expect(code(() => scanXmp(' '.repeat(MAX_XMP_SCAN_LENGTH + 1)))).toBe('XMP_TOO_LARGE');
  });

  it('scans hostile input in linear time', () => {
    const inputs = [
      'xmlns:'.repeat(600_000),
      '<a ' + 'x="1" '.repeat(500_000),
      '<' + 'a'.repeat(3_000_000),
      '&'.repeat(3_000_000),
      `<a xmlns:p="${IPTC}">` + 'p:DigitalSourceType '.repeat(150_000),
      '<a ' + Array.from({ length: 150_000 }, (_, i) => `a${i}="1"`).join(' ') + '/>',
      '<r>' + '<a xmlns:p="u"/>'.repeat(200_000) + '</r>',
    ];
    for (const s of inputs) {
      const t = performance.now();
      try {
        scanXmp(s);
      } catch {
        // Expected for most inputs; only time matters here.
      }
      expect(performance.now() - t).toBeLessThan(1500);
    }
  });
});

describe('merging', () => {
  const base = wrap(`<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>image/png</dc:format></rdf:Description>`);
  const values = xmpValues('trainedAlgorithmicMedia', 'Sys', undefined);

  it('inserts one description before the end of rdf:RDF and keeps everything else', () => {
    const r = mergeIntoPacket(base, values);
    expect(r.changed).toBe(true);
    expect(r.xml).toContain('<dc:format>image/png</dc:format>');
    expect(r.xml.indexOf('Iptc4xmpExt:DigitalSourceType')).toBeLessThan(r.xml.indexOf('</rdf:RDF>'));
    const s = scanXmp(r.xml);
    expect(s.values.DigitalSourceType).toEqual([DST]);
    expect(s.values.AISystemUsed).toEqual(['Sys']);
  });

  it('is idempotent', () => {
    const once = mergeIntoPacket(base, values).xml;
    const twice = mergeIntoPacket(once, values);
    expect(twice.changed).toBe(false);
    expect(twice.xml).toBe(once);
  });

  it('works when rdf uses another prefix', () => {
    const xml = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><R:RDF xmlns:R="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></R:RDF></x:xmpmeta>';
    const r = mergeIntoPacket(xml, values);
    expect(scanXmp(r.xml).values.DigitalSourceType).toEqual([DST]);
  });

  it('refuses conflicting values', () => {
    const xml = wrap(`<rdf:Description xmlns:I="${IPTC}" I:AISystemUsed="Other"/>`);
    expect(code(() => mergeIntoPacket(xml, values))).toBe('XMP_CONFLICT');
  });

  it('refuses a property it cannot compare instead of adding a second value', () => {
    for (const inner of [
      `<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType rdf:parseType="Resource"><rdf:value>x</rdf:value></I:DigitalSourceType></rdf:Description>`,
      `<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType rdf:resource="a">b</I:DigitalSourceType></rdf:Description>`,
    ]) {
      expect(code(() => mergeIntoPacket(wrap(inner), values))).toBe('XMP_UNSUPPORTED');
    }
  });

  it('compares values written as CDATA, with comments or as empty elements', () => {
    const other = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture';
    for (const inner of [
      `<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType><![CDATA[${other}]]></I:DigitalSourceType></rdf:Description>`,
      `<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType>${other}<!-- c --></I:DigitalSourceType></rdf:Description>`,
      `<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType/></rdf:Description>`,
    ]) {
      expect(code(() => mergeIntoPacket(wrap(inner), values))).toBe('XMP_CONFLICT');
    }
    const same = wrap(`<rdf:Description xmlns:I="${IPTC}"><I:DigitalSourceType><![CDATA[${DST}]]></I:DigitalSourceType></rdf:Description>`);
    expect(scanXmp(mergeIntoPacket(same, values).xml).values.DigitalSourceType).toEqual([DST]);
  });

  it('reuses the packet rdf:about value, escaped', () => {
    const xml = wrap(`<rdf:Description rdf:about="uuid:1&amp;&quot;&#xA;" xmlns:dc="http://purl.org/dc/elements/1.1/" dc:format="image/png"/>`);
    const r = mergeIntoPacket(xml, values);
    expect(r.xml).toContain('rdf:about="uuid:1&amp;&quot;&#xA;" xmlns:rdf=');
    expect(new Set(scanXmp(r.xml).abouts)).toEqual(new Set(['uuid:1&"\n']));
  });

  it('refuses packets whose descriptions disagree on rdf:about', () => {
    const xml = wrap(`<rdf:Description rdf:about="a"/><rdf:Description rdf:about="b"/>`);
    expect(code(() => mergeIntoPacket(xml, values))).toBe('XMP_UNSUPPORTED');
  });

  it('refuses packets without exactly one rdf:RDF', () => {
    expect(code(() => mergeIntoPacket('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>', values))).toBe('XMP_UNSUPPORTED');
    expect(code(() => mergeIntoPacket(`<r>${wrap('')}${wrap('')}</r>`, values))).toBe('XMP_UNSUPPORTED');
    expect(code(() => mergeIntoPacket(`<rdf:RDF ${RDF}/>`, values))).toBe('XMP_UNSUPPORTED');
  });
});
