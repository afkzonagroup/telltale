/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * XMP packet writing, merging and reading for the IPTC Extension properties
 * `Iptc4xmpExt:DigitalSourceType`, `Iptc4xmpExt:AISystemUsed` and
 * `Iptc4xmpExt:AISystemVersionUsed`.
 *
 * This is not a general XML parser. It is a small, linear-time scanner that
 * understands elements, attributes, namespace declarations, comments,
 * processing instructions and CDATA. It rejects DOCTYPE declarations and
 * unknown entities, so entity expansion attacks cannot happen.
 *
 * The Python package implements the same rules; shared test vectors keep
 * both byte-identical.
 */

import { TelltaleError } from '../errors.js';
import {
  digitalSourceTypeUri,
  IPTC_EXT_NS,
  RDF_NS,
  type GenerativeDigitalSourceType,
} from './digital-source-type.js';

/** Largest XMP packet (in UTF-16 code units after decoding) that will be scanned. */
export const MAX_XMP_SCAN_LENGTH = 4 * 1024 * 1024;
/** Deepest element nesting accepted while scanning. */
export const MAX_XMP_DEPTH = 128;
/** Most namespace prefixes in scope at once (real packets use a few dozen). */
export const MAX_XMP_NAMESPACES = 256;
/** Longest accepted value for AISystemUsed / AISystemVersionUsed. */
export const MAX_PROPERTY_LENGTH = 256;

/** The IPTC properties this module writes and reads, in write order. */
export const IPTC_PROPERTIES = ['DigitalSourceType', 'AISystemUsed', 'AISystemVersionUsed'] as const;
export type IptcProperty = (typeof IPTC_PROPERTIES)[number];

/** Values to record. `DigitalSourceType` is always present. */
export type XmpValues = Readonly<Partial<Record<IptcProperty, string>>> & { readonly DigitalSourceType: string };

/** Builds the property values from validated options. */
export function xmpValues(
  digitalSourceType: GenerativeDigitalSourceType,
  aiSystemUsed: string | undefined,
  aiSystemVersionUsed: string | undefined,
): XmpValues {
  const v: { DigitalSourceType: string; AISystemUsed?: string; AISystemVersionUsed?: string } = {
    DigitalSourceType: digitalSourceTypeUri(digitalSourceType),
  };
  if (aiSystemUsed !== undefined) v.AISystemUsed = aiSystemUsed;
  if (aiSystemVersionUsed !== undefined) v.AISystemVersionUsed = aiSystemVersionUsed;
  return v;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// C0 controls, DEL, C1 controls, and the Unicode line/paragraph separators.
// eslint-disable-next-line no-control-regex -- matching control characters is the purpose of this pattern
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

/**
 * Validates a free-text property value: 1..256 characters, no control
 * characters, no lone surrogates. Throws INVALID_OPTION.
 */
export function validateTextValue(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new TelltaleError('INVALID_OPTION', `${name} must be a string.`);
  if (value.length === 0 || value.length > MAX_PROPERTY_LENGTH) {
    throw new TelltaleError('INVALID_OPTION', `${name} must be 1 to ${MAX_PROPERTY_LENGTH} characters.`);
  }
  if (value.trim() !== value) throw new TelltaleError('INVALID_OPTION', `${name} must not start or end with whitespace.`);
  if (CONTROL.test(value)) throw new TelltaleError('INVALID_OPTION', `${name} must not contain control characters.`);
  if (LONE_SURROGATE.test(value)) throw new TelltaleError('INVALID_OPTION', `${name} must be well-formed Unicode.`);
  return value;
}

/** Escapes character data for XML element content. */
export function escapeXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escapes a double-quoted XML attribute value. Tab, line feed and carriage
 * return become character references so that attribute-value normalisation
 * gives back the same string.
 */
export function escapeXmlAttribute(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
}

/**
 * The `rdf:Description` block this library writes. Deterministic.
 * `about` is the `rdf:about` value; XMP requires the same value on every
 * top-level `rdf:Description` of a packet.
 */
export function descriptionXml(values: Readonly<Partial<Record<IptcProperty, string>>>, about = ''): string {
  let out = `<rdf:Description rdf:about="${escapeXmlAttribute(about)}" xmlns:rdf="${RDF_NS}" xmlns:Iptc4xmpExt="${IPTC_EXT_NS}">\n`;
  for (const p of IPTC_PROPERTIES) {
    const v = values[p];
    if (v !== undefined) out += `<Iptc4xmpExt:${p}>${escapeXmlText(v)}</Iptc4xmpExt:${p}>\n`;
  }
  out += '</rdf:Description>\n';
  return out;
}

/** A complete, read-only XMP packet holding only the given values. Deterministic. */
export function buildXmpPacket(values: XmpValues): string {
  return (
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
    `<rdf:RDF xmlns:rdf="${RDF_NS}">\n` +
    descriptionXml(values) +
    '</rdf:RDF>\n' +
    '</x:xmpmeta>\n' +
    '<?xpacket end="r"?>'
  );
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/** Result of scanning a packet. */
export interface XmpScan {
  /** Values found for each property, in document order. */
  readonly values: Readonly<Record<IptcProperty, readonly string[]>>;
  /**
   * Properties present in a form this scanner does not read (for example a
   * structured value with child elements, or both `rdf:resource` and text).
   */
  readonly unreadable: readonly IptcProperty[];
  /** `rdf:about` values of the `rdf:Description` elements directly inside `rdf:RDF`, in document order. */
  readonly abouts: readonly string[];
  /** Number of `rdf:RDF` elements. */
  readonly rdfCount: number;
  /** Offsets of the `<` of each `</...RDF>` end tag. */
  readonly rdfEndOffsets: readonly number[];
}

function unsupported(msg: string): TelltaleError {
  return new TelltaleError('XMP_UNSUPPORTED', `XMP packet not supported: ${msg}`);
}

function isWs(c: number): boolean {
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

function isNameStart(c: number): boolean {
  return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c === 0x3a || c >= 0x80;
}

function isNameChar(c: number): boolean {
  return isNameStart(c) || (c >= 0x30 && c <= 0x39) || c === 0x2e || c === 0x2d;
}

function readName(xml: string, pos: number): number {
  if (pos >= xml.length || !isNameStart(xml.charCodeAt(pos))) throw unsupported('invalid name.');
  let p = pos + 1;
  while (p < xml.length && isNameChar(xml.charCodeAt(p))) p++;
  return p;
}

function skipWs(xml: string, pos: number): number {
  let p = pos;
  while (p < xml.length && isWs(xml.charCodeAt(p))) p++;
  return p;
}

/** Decodes the five predefined entities and numeric character references. */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const amp = s.indexOf('&', i);
    if (amp < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, amp);
    const semi = s.indexOf(';', amp + 1);
    if (semi < 0 || semi - amp > 12) throw unsupported('bad entity reference.');
    const name = s.slice(amp + 1, semi);
    let ch: string;
    if (name === 'lt') ch = '<';
    else if (name === 'gt') ch = '>';
    else if (name === 'amp') ch = '&';
    else if (name === 'quot') ch = '"';
    else if (name === 'apos') ch = "'";
    else if (/^#[0-9]{1,7}$/.test(name) || /^#x[0-9a-fA-F]{1,6}$/.test(name)) {
      const cp = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      const valid =
        cp === 0x9 || cp === 0xa || cp === 0xd || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff);
      if (!valid) throw unsupported('invalid character reference.');
      ch = String.fromCodePoint(cp);
    } else {
      throw unsupported('unknown entity.');
    }
    out += ch;
    i = semi + 1;
  }
  return out;
}

interface Frame {
  readonly qname: string;
  readonly ns: ReadonlyMap<string, string>;
  readonly target: IptcProperty | null;
  /** Value of an `rdf:resource` attribute on this element, if any. */
  readonly resource: string | null;
  /** True for an `rdf:RDF` element. */
  readonly isRdf: boolean;
  readonly contentStart: number;
  hasChild: boolean;
}

function resolve(qname: string, ns: ReadonlyMap<string, string>, isAttribute: boolean): { uri: string | null; local: string } {
  const colon = qname.indexOf(':');
  if (colon < 0) {
    return { uri: isAttribute ? null : (ns.get('') ?? null), local: qname };
  }
  const prefix = qname.slice(0, colon);
  const local = qname.slice(colon + 1);
  if (local.length === 0 || local.includes(':')) throw unsupported('invalid qualified name.');
  const uri = ns.get(prefix);
  if (uri === undefined) throw unsupported('undeclared namespace prefix.');
  return { uri, local };
}

function targetOf(uri: string | null, local: string): IptcProperty | null {
  if (uri !== IPTC_EXT_NS) return null;
  return (IPTC_PROPERTIES as readonly string[]).includes(local) ? (local as IptcProperty) : null;
}

/**
 * Character data of an element without child elements: text with entities
 * decoded plus CDATA content; comments and processing instructions are
 * skipped. The main scanner has already checked that every construct is
 * terminated.
 */
function leafText(source: string): string {
  // XML line-end normalisation (XML 1.0, 2.11) applies before parsing, also inside CDATA.
  const raw = normalizeLineEnds(source);
  let out = '';
  let i = 0;
  for (;;) {
    const lt = raw.indexOf('<', i);
    if (lt < 0) return out + decodeEntities(raw.slice(i));
    out += decodeEntities(raw.slice(i, lt));
    if (raw.startsWith('<![CDATA[', lt)) {
      const end = raw.indexOf(']]>', lt + 9);
      if (end < 0) throw unsupported('unterminated CDATA section.');
      out += raw.slice(lt + 9, end);
      i = end + 3;
    } else if (raw.startsWith('<!--', lt)) {
      const end = raw.indexOf('-->', lt + 4);
      if (end < 0) throw unsupported('unterminated comment.');
      i = end + 3;
    } else if (raw.startsWith('<?', lt)) {
      const end = raw.indexOf('?>', lt + 2);
      if (end < 0) throw unsupported('unterminated processing instruction.');
      i = end + 2;
    } else {
      throw unsupported('unexpected markup in a property value.');
    }
  }
}

/** Replaces CR LF and lone CR with LF, as an XML processor does before parsing. */
function normalizeLineEnds(s: string): string {
  return s.includes('\r') ? s.replace(/\r\n?/g, '\n') : s;
}

function trimXmlWs(s: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && isWs(s.charCodeAt(a))) a++;
  while (b > a && isWs(s.charCodeAt(b - 1))) b--;
  return s.slice(a, b);
}

/**
 * Scans an XMP packet. Throws XMP_UNSUPPORTED when the packet is not
 * namespace-well-formed in the subset this scanner accepts.
 */
export function scanXmp(xml: string): XmpScan {
  if (xml.length > MAX_XMP_SCAN_LENGTH) throw new TelltaleError('XMP_TOO_LARGE', 'XMP packet is too large to scan.');
  const values: Record<IptcProperty, string[]> = { DigitalSourceType: [], AISystemUsed: [], AISystemVersionUsed: [] };
  const unreadable = new Set<IptcProperty>();
  const abouts: string[] = [];
  const rdfEndOffsets: number[] = [];
  let rdfCount = 0;
  const stack: Frame[] = [];
  const rootNs: ReadonlyMap<string, string> = new Map([['xml', 'http://www.w3.org/XML/1998/namespace']]);
  let pos = 0;
  const n = xml.length;

  while (pos < n) {
    const lt = xml.indexOf('<', pos);
    if (lt < 0) {
      if (stack.length > 0) throw unsupported('unexpected end of packet.');
      // Text after the root element (for example padding) is ignored.
      break;
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      if (end < 0) throw unsupported('unterminated processing instruction.');
      pos = end + 2;
      continue;
    }
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end < 0) throw unsupported('unterminated comment.');
      pos = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      if (stack.length === 0) throw unsupported('CDATA outside the root element.');
      const end = xml.indexOf(']]>', lt + 9);
      if (end < 0) throw unsupported('unterminated CDATA section.');
      pos = end + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) throw unsupported('DOCTYPE and other declarations are not allowed.');

    if (xml.startsWith('</', lt)) {
      const nameEnd = readName(xml, lt + 2);
      const qname = xml.slice(lt + 2, nameEnd);
      const gt = skipWs(xml, nameEnd);
      if (xml.charCodeAt(gt) !== 0x3e) throw unsupported('malformed end tag.');
      const frame = stack.pop();
      if (frame?.qname !== qname) throw unsupported('mismatched end tag.');
      if (frame.target !== null) {
        // Structured values (child elements) cannot be compared; record that the property is there.
        if (frame.hasChild) unreadable.add(frame.target);
        else {
          const text = trimXmlWs(leafText(xml.slice(frame.contentStart, lt)));
          if (frame.resource === null) values[frame.target].push(text);
          else if (text === '') values[frame.target].push(trimXmlWs(frame.resource));
          else unreadable.add(frame.target);
        }
      }
      const r = resolve(qname, frame.ns, false);
      if (r.uri === RDF_NS && r.local === 'RDF') rdfEndOffsets.push(lt);
      pos = gt + 1;
      continue;
    }

    // Start tag.
    const nameEnd = readName(xml, lt + 1);
    const qname = xml.slice(lt + 1, nameEnd);
    const attrs: [string, string][] = [];
    const seen = new Set<string>();
    let p = nameEnd;
    let selfClosing = false;
    for (;;) {
      const afterWs = skipWs(xml, p);
      if (afterWs >= n) throw unsupported('unterminated start tag.');
      const c = xml.charCodeAt(afterWs);
      if (c === 0x3e) {
        p = afterWs + 1;
        break;
      }
      if (c === 0x2f) {
        if (xml.charCodeAt(afterWs + 1) !== 0x3e) throw unsupported('malformed empty-element tag.');
        selfClosing = true;
        p = afterWs + 2;
        break;
      }
      if (afterWs === p) throw unsupported('missing whitespace between attributes.');
      const an = readName(xml, afterWs);
      const attrName = xml.slice(afterWs, an);
      const eq = skipWs(xml, an);
      if (xml.charCodeAt(eq) !== 0x3d) throw unsupported('attribute without value.');
      const q = skipWs(xml, eq + 1);
      const quote = xml.charCodeAt(q);
      if (quote !== 0x22 && quote !== 0x27) throw unsupported('unquoted attribute value.');
      const close = xml.indexOf(quote === 0x22 ? '"' : "'", q + 1);
      if (close < 0) throw unsupported('unterminated attribute value.');
      const rawValue = xml.slice(q + 1, close);
      if (rawValue.includes('<')) throw unsupported('"<" in attribute value.');
      if (seen.has(attrName)) throw unsupported('duplicate attribute.');
      seen.add(attrName);
      // Line ends are normalised first, then whitespace characters become spaces (XML 1.0, 3.3.3).
      attrs.push([attrName, decodeEntities(normalizeLineEnds(rawValue).replace(/[\t\n]/g, ' '))]);
      p = close + 1;
    }

    const parent = stack[stack.length - 1];
    const parentNs = parent ? parent.ns : rootNs;
    let ns = parentNs;
    for (const [k, v] of attrs) {
      if (k === 'xmlns' || k.startsWith('xmlns:')) {
        if (ns === parentNs) ns = new Map(parentNs);
        const prefix = k === 'xmlns' ? '' : k.slice(6);
        if (prefix === 'xmlns' || (prefix !== '' && v === '')) throw unsupported('invalid namespace declaration.');
        (ns as Map<string, string>).set(prefix, v);
        if (ns.size > MAX_XMP_NAMESPACES) throw unsupported('too many namespace declarations.');
      }
    }
    const el = resolve(qname, ns, false);
    if (parent) parent.hasChild = true;
    const isRdf = el.uri === RDF_NS && el.local === 'RDF';
    if (isRdf) rdfCount++;
    const isTopDescription = parent?.isRdf === true && el.uri === RDF_NS && el.local === 'Description';

    let rdfResource: string | null = null;
    for (const [k, v] of attrs) {
      if (k === 'xmlns' || k.startsWith('xmlns:')) continue;
      const a = resolve(k, ns, true);
      const t = targetOf(a.uri, a.local);
      if (t !== null) values[t].push(trimXmlWs(v));
      if (a.uri === RDF_NS && a.local === 'resource') rdfResource = v;
      if (isTopDescription && a.uri === RDF_NS && a.local === 'about') abouts.push(v);
    }
    const target = targetOf(el.uri, el.local);
    if (selfClosing) {
      // <p/> is the same as <p></p>: an empty value unless rdf:resource gives one.
      if (target !== null) values[target].push(trimXmlWs(rdfResource ?? ''));
      pos = p;
      continue;
    }
    if (stack.length >= MAX_XMP_DEPTH) throw unsupported('nesting too deep.');
    stack.push({ qname, ns, target, resource: rdfResource, isRdf, contentStart: p, hasChild: false });
    pos = p;
  }
  if (stack.length > 0) throw unsupported('unclosed elements.');
  return { values, unreadable: IPTC_PROPERTIES.filter((p) => unreadable.has(p)), abouts, rdfCount, rdfEndOffsets };
}

/** Outcome of merging values into an existing packet. */
export interface MergeResult {
  readonly xml: string;
  readonly changed: boolean;
}

/**
 * Adds the given values to an existing packet by inserting one
 * `rdf:Description` before the end of the single `rdf:RDF` element.
 *
 * - A property already present with the same value is left alone.
 * - A property present with a different value throws XMP_CONFLICT.
 * - A property present in a form the scanner cannot read throws
 *   XMP_UNSUPPORTED, so a second, contradicting value is never added.
 * - The new block reuses the packet's `rdf:about` value; packets whose
 *   top-level descriptions disagree on it throw XMP_UNSUPPORTED.
 * - Packets with zero or several `rdf:RDF` elements throw XMP_UNSUPPORTED.
 */
export function mergeIntoPacket(xml: string, values: XmpValues): MergeResult {
  const scan = scanXmp(xml);
  if (scan.rdfCount !== 1 || scan.rdfEndOffsets.length !== 1) {
    throw unsupported('expected exactly one rdf:RDF element.');
  }
  const toAdd: { DigitalSourceType?: string; AISystemUsed?: string; AISystemVersionUsed?: string } = {};
  let any = false;
  for (const p of IPTC_PROPERTIES) {
    const wanted = values[p];
    if (wanted === undefined) continue;
    if (scan.unreadable.includes(p)) throw unsupported(`existing Iptc4xmpExt:${p} has a form that cannot be compared.`);
    const existing = scan.values[p];
    if (existing.length > 0) {
      if (existing.every((v) => v === wanted)) continue;
      throw new TelltaleError('XMP_CONFLICT', `Existing XMP already has a different Iptc4xmpExt:${p}.`);
    }
    toAdd[p] = wanted;
    any = true;
  }
  if (!any) return { xml, changed: false };
  const distinctAbouts = new Set(scan.abouts);
  if (distinctAbouts.size > 1) throw unsupported('rdf:Description elements have different rdf:about values.');
  const at = scan.rdfEndOffsets[0] ?? 0;
  const block = descriptionXml(toAdd, scan.abouts[0] ?? '');
  return { xml: xml.slice(0, at) + block + xml.slice(at), changed: true };
}
