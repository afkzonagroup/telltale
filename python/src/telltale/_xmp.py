# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""XMP packet building, merging and scanning.

This mirrors ``src/marking/xmp.ts`` rule for rule; the shared test vectors
keep both implementations byte-identical. It is a small linear-time scanner,
not a general XML parser. DOCTYPE declarations and unknown entities are
rejected, so entity expansion cannot happen. Lengths are counted in UTF-16
code units to match JavaScript.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Set

from ._errors import TelltaleError

IPTC_DIGITAL_SOURCE_TYPE_SCHEME = "http://cv.iptc.org/newscodes/digitalsourcetype/"
IPTC_EXT_NS = "http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
XML_NS = "http://www.w3.org/XML/1998/namespace"

GENERATIVE_DIGITAL_SOURCE_TYPES = (
    "trainedAlgorithmicMedia",
    "compositeWithTrainedAlgorithmicMedia",
    "compositeSynthetic",
)

MAX_XMP_SCAN_LENGTH = 4 * 1024 * 1024
MAX_XMP_DEPTH = 128
MAX_XMP_NAMESPACES = 256
MAX_PROPERTY_LENGTH = 256

IPTC_PROPERTIES = ("DigitalSourceType", "AISystemUsed", "AISystemVersionUsed")

# Characters JavaScript's String.prototype.trim removes.
_JS_WHITESPACE = frozenset(
    "\t\n\x0b\x0c\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000\ufeff"
)
_CONTROL = re.compile("[\u0000-\u001f\u007f-\u009f\u2028\u2029]")
_DEC_REF = re.compile(r"#[0-9]{1,7}\Z")
_HEX_REF = re.compile(r"#x[0-9a-fA-F]{1,6}\Z")


def utf16_length(s: str) -> int:
    """Length in UTF-16 code units, as JavaScript counts it."""
    return len(s) + sum(1 for c in s if ord(c) > 0xFFFF)


def digital_source_type_uri(code: str) -> str:
    return IPTC_DIGITAL_SOURCE_TYPE_SCHEME + code


def is_generative_uri(uri: str) -> bool:
    return any(IPTC_DIGITAL_SOURCE_TYPE_SCHEME + c == uri for c in GENERATIVE_DIGITAL_SOURCE_TYPES)


def validate_text_value(name: str, value: object) -> str:
    """1..256 UTF-16 units, no surrounding whitespace, no control characters, no lone surrogates."""
    if not isinstance(value, str):
        raise TelltaleError("INVALID_OPTION", f"{name} must be a string.")
    n = utf16_length(value)
    if n == 0 or n > MAX_PROPERTY_LENGTH:
        raise TelltaleError("INVALID_OPTION", f"{name} must be 1 to {MAX_PROPERTY_LENGTH} characters.")
    if value[0] in _JS_WHITESPACE or value[-1] in _JS_WHITESPACE:
        raise TelltaleError("INVALID_OPTION", f"{name} must not start or end with whitespace.")
    if _CONTROL.search(value):
        raise TelltaleError("INVALID_OPTION", f"{name} must not contain control characters.")
    if any(0xD800 <= ord(c) <= 0xDFFF for c in value):
        raise TelltaleError("INVALID_OPTION", f"{name} must be well-formed Unicode.")
    return value


def escape_xml_text(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def escape_xml_attribute(s: str) -> str:
    """Escapes a double-quoted attribute value; tab, LF and CR become character references."""
    return (
        escape_xml_text(s).replace('"', "&quot;").replace("\t", "&#x9;").replace("\n", "&#xA;").replace("\r", "&#xD;")
    )


def description_xml(values: Mapping[str, str], about: str = "") -> str:
    out = (
        f'<rdf:Description rdf:about="{escape_xml_attribute(about)}" '
        f'xmlns:rdf="{RDF_NS}" xmlns:Iptc4xmpExt="{IPTC_EXT_NS}">\n'
    )
    for p in IPTC_PROPERTIES:
        v = values.get(p)
        if v is not None:
            out += f"<Iptc4xmpExt:{p}>{escape_xml_text(v)}</Iptc4xmpExt:{p}>\n"
    return out + "</rdf:Description>\n"


def build_xmp_packet(values: Mapping[str, str]) -> str:
    """A complete read-only packet holding only the given values. Deterministic."""
    return (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n'
        f'<rdf:RDF xmlns:rdf="{RDF_NS}">\n' + description_xml(values) + "</rdf:RDF>\n</x:xmpmeta>\n"
        '<?xpacket end="r"?>'
    )


def _unsupported(msg: str) -> TelltaleError:
    return TelltaleError("XMP_UNSUPPORTED", f"XMP packet not supported: {msg}")


def _is_ws(c: str) -> bool:
    return c in " \t\n\r"


def _is_name_start(c: str) -> bool:
    return ("A" <= c <= "Z") or ("a" <= c <= "z") or c == "_" or c == ":" or ord(c) >= 0x80


def _is_name_char(c: str) -> bool:
    return _is_name_start(c) or ("0" <= c <= "9") or c == "." or c == "-"


def _read_name(xml: str, pos: int) -> int:
    if pos >= len(xml) or not _is_name_start(xml[pos]):
        raise _unsupported("invalid name.")
    p = pos + 1
    n = len(xml)
    while p < n and _is_name_char(xml[p]):
        p += 1
    return p


def _skip_ws(xml: str, pos: int) -> int:
    p = pos
    n = len(xml)
    while p < n and _is_ws(xml[p]):
        p += 1
    return p


def decode_entities(s: str) -> str:
    if "&" not in s:
        return s
    out: List[str] = []
    i = 0
    while i < len(s):
        amp = s.find("&", i)
        if amp < 0:
            out.append(s[i:])
            break
        out.append(s[i:amp])
        semi = s.find(";", amp + 1)
        if semi < 0 or utf16_length(s[amp:semi]) > 12:
            raise _unsupported("bad entity reference.")
        name = s[amp + 1 : semi]
        if name == "lt":
            ch = "<"
        elif name == "gt":
            ch = ">"
        elif name == "amp":
            ch = "&"
        elif name == "quot":
            ch = '"'
        elif name == "apos":
            ch = "'"
        elif _DEC_REF.match(name) or _HEX_REF.match(name):
            cp = int(name[2:], 16) if name[1] == "x" else int(name[1:], 10)
            valid = (
                cp in (0x9, 0xA, 0xD)
                or 0x20 <= cp <= 0xD7FF
                or 0xE000 <= cp <= 0xFFFD
                or 0x10000 <= cp <= 0x10FFFF
            )
            if not valid:
                raise _unsupported("invalid character reference.")
            ch = chr(cp)
        else:
            raise _unsupported("unknown entity.")
        out.append(ch)
        i = semi + 1
    return "".join(out)


def _normalize_line_ends(s: str) -> str:
    """Replaces CR LF and lone CR with LF, as an XML processor does before parsing."""
    return s.replace("\r\n", "\n").replace("\r", "\n") if "\r" in s else s


def _leaf_text(source: str) -> str:
    """Text of an element without child elements: entities decoded, CDATA kept, comments and PIs skipped."""
    # XML line-end normalisation (XML 1.0, 2.11) applies before parsing, also inside CDATA.
    raw = _normalize_line_ends(source)
    out: List[str] = []
    i = 0
    while True:
        lt = raw.find("<", i)
        if lt < 0:
            out.append(decode_entities(raw[i:]))
            return "".join(out)
        out.append(decode_entities(raw[i:lt]))
        if raw.startswith("<![CDATA[", lt):
            end = raw.find("]]>", lt + 9)
            if end < 0:
                raise _unsupported("unterminated CDATA section.")
            out.append(raw[lt + 9 : end])
            i = end + 3
        elif raw.startswith("<!--", lt):
            end = raw.find("-->", lt + 4)
            if end < 0:
                raise _unsupported("unterminated comment.")
            i = end + 3
        elif raw.startswith("<?", lt):
            end = raw.find("?>", lt + 2)
            if end < 0:
                raise _unsupported("unterminated processing instruction.")
            i = end + 2
        else:
            raise _unsupported("unexpected markup in a property value.")


def _trim_xml_ws(s: str) -> str:
    return s.strip(" \t\n\r")


@dataclass
class _Frame:
    qname: str
    ns: Dict[str, str]
    target: Optional[str]
    resource: Optional[str]
    is_rdf: bool
    content_start: int
    has_child: bool = False


def _resolve(qname: str, ns: Mapping[str, str], is_attribute: bool) -> "tuple[Optional[str], str]":
    colon = qname.find(":")
    if colon < 0:
        return (None if is_attribute else ns.get(""), qname)
    prefix = qname[:colon]
    local = qname[colon + 1 :]
    if len(local) == 0 or ":" in local:
        raise _unsupported("invalid qualified name.")
    uri = ns.get(prefix)
    if uri is None:
        raise _unsupported("undeclared namespace prefix.")
    return (uri, local)


def _target_of(uri: Optional[str], local: str) -> Optional[str]:
    if uri != IPTC_EXT_NS:
        return None
    return local if local in IPTC_PROPERTIES else None


@dataclass(frozen=True)
class XmpScan:
    values: Mapping[str, List[str]]
    unreadable: List[str]
    abouts: List[str]
    rdf_count: int
    rdf_end_offsets: List[int]


def scan_xmp(xml: str) -> XmpScan:
    if utf16_length(xml) > MAX_XMP_SCAN_LENGTH:
        raise TelltaleError("XMP_TOO_LARGE", "XMP packet is too large to scan.")
    values: Dict[str, List[str]] = {p: [] for p in IPTC_PROPERTIES}
    unreadable: Set[str] = set()
    abouts: List[str] = []
    rdf_end_offsets: List[int] = []
    rdf_count = 0
    stack: List[_Frame] = []
    root_ns: Dict[str, str] = {"xml": XML_NS}
    pos = 0
    n = len(xml)
    while pos < n:
        lt = xml.find("<", pos)
        if lt < 0:
            if stack:
                raise _unsupported("unexpected end of packet.")
            break
        if xml.startswith("<?", lt):
            end = xml.find("?>", lt + 2)
            if end < 0:
                raise _unsupported("unterminated processing instruction.")
            pos = end + 2
            continue
        if xml.startswith("<!--", lt):
            end = xml.find("-->", lt + 4)
            if end < 0:
                raise _unsupported("unterminated comment.")
            pos = end + 3
            continue
        if xml.startswith("<![CDATA[", lt):
            if not stack:
                raise _unsupported("CDATA outside the root element.")
            end = xml.find("]]>", lt + 9)
            if end < 0:
                raise _unsupported("unterminated CDATA section.")
            pos = end + 3
            continue
        if xml.startswith("<!", lt):
            raise _unsupported("DOCTYPE and other declarations are not allowed.")

        if xml.startswith("</", lt):
            name_end = _read_name(xml, lt + 2)
            qname = xml[lt + 2 : name_end]
            gt = _skip_ws(xml, name_end)
            if gt >= n or xml[gt] != ">":
                raise _unsupported("malformed end tag.")
            if not stack or stack[-1].qname != qname:
                raise _unsupported("mismatched end tag.")
            frame = stack.pop()
            if frame.target is not None:
                if frame.has_child:
                    unreadable.add(frame.target)
                else:
                    text = _trim_xml_ws(_leaf_text(xml[frame.content_start : lt]))
                    if frame.resource is None:
                        values[frame.target].append(text)
                    elif text == "":
                        values[frame.target].append(_trim_xml_ws(frame.resource))
                    else:
                        unreadable.add(frame.target)
            uri, local = _resolve(qname, frame.ns, False)
            if uri == RDF_NS and local == "RDF":
                rdf_end_offsets.append(lt)
            pos = gt + 1
            continue

        name_end = _read_name(xml, lt + 1)
        qname = xml[lt + 1 : name_end]
        attrs: List["tuple[str, str]"] = []
        seen: Set[str] = set()
        p = name_end
        self_closing = False
        while True:
            after_ws = _skip_ws(xml, p)
            if after_ws >= n:
                raise _unsupported("unterminated start tag.")
            c = xml[after_ws]
            if c == ">":
                p = after_ws + 1
                break
            if c == "/":
                if after_ws + 1 >= n or xml[after_ws + 1] != ">":
                    raise _unsupported("malformed empty-element tag.")
                self_closing = True
                p = after_ws + 2
                break
            if after_ws == p:
                raise _unsupported("missing whitespace between attributes.")
            an = _read_name(xml, after_ws)
            attr_name = xml[after_ws:an]
            eq = _skip_ws(xml, an)
            if eq >= n or xml[eq] != "=":
                raise _unsupported("attribute without value.")
            q = _skip_ws(xml, eq + 1)
            if q >= n or xml[q] not in "\"'":
                raise _unsupported("unquoted attribute value.")
            close = xml.find(xml[q], q + 1)
            if close < 0:
                raise _unsupported("unterminated attribute value.")
            raw_value = xml[q + 1 : close]
            if "<" in raw_value:
                raise _unsupported('"<" in attribute value.')
            if attr_name in seen:
                raise _unsupported("duplicate attribute.")
            seen.add(attr_name)
            # Line ends are normalised first, then whitespace characters become spaces (XML 1.0, 3.3.3).
            normalised = _normalize_line_ends(raw_value).replace("\t", " ").replace("\n", " ")
            attrs.append((attr_name, decode_entities(normalised)))
            p = close + 1

        parent = stack[-1] if stack else None
        parent_ns = parent.ns if parent is not None else root_ns
        ns = parent_ns
        for k, v in attrs:
            if k == "xmlns" or k.startswith("xmlns:"):
                if ns is parent_ns:
                    ns = dict(parent_ns)
                prefix = "" if k == "xmlns" else k[6:]
                if prefix == "xmlns" or (prefix != "" and v == ""):
                    raise _unsupported("invalid namespace declaration.")
                ns[prefix] = v
                if len(ns) > MAX_XMP_NAMESPACES:
                    raise _unsupported("too many namespace declarations.")
        el_uri, el_local = _resolve(qname, ns, False)
        if parent is not None:
            parent.has_child = True
        is_rdf = el_uri == RDF_NS and el_local == "RDF"
        if is_rdf:
            rdf_count += 1
        is_top_description = parent is not None and parent.is_rdf and el_uri == RDF_NS and el_local == "Description"

        rdf_resource: Optional[str] = None
        for k, v in attrs:
            if k == "xmlns" or k.startswith("xmlns:"):
                continue
            a_uri, a_local = _resolve(k, ns, True)
            t = _target_of(a_uri, a_local)
            if t is not None:
                values[t].append(_trim_xml_ws(v))
            if a_uri == RDF_NS and a_local == "resource":
                rdf_resource = v
            if is_top_description and a_uri == RDF_NS and a_local == "about":
                abouts.append(v)
        target = _target_of(el_uri, el_local)
        if self_closing:
            # <p/> is the same as <p></p>: an empty value unless rdf:resource gives one.
            if target is not None:
                values[target].append(_trim_xml_ws(rdf_resource if rdf_resource is not None else ""))
            pos = p
            continue
        if len(stack) >= MAX_XMP_DEPTH:
            raise _unsupported("nesting too deep.")
        stack.append(_Frame(qname=qname, ns=ns, target=target, resource=rdf_resource, is_rdf=is_rdf, content_start=p))
        pos = p
    if stack:
        raise _unsupported("unclosed elements.")
    return XmpScan(
        values=values,
        unreadable=[p for p in IPTC_PROPERTIES if p in unreadable],
        abouts=abouts,
        rdf_count=rdf_count,
        rdf_end_offsets=rdf_end_offsets,
    )


def merge_into_packet(xml: str, values: Mapping[str, str]) -> "tuple[str, bool]":
    """Adds values before the end of the single rdf:RDF element. Returns (xml, changed)."""
    scan = scan_xmp(xml)
    if scan.rdf_count != 1 or len(scan.rdf_end_offsets) != 1:
        raise _unsupported("expected exactly one rdf:RDF element.")
    to_add: Dict[str, str] = {}
    for p in IPTC_PROPERTIES:
        wanted = values.get(p)
        if wanted is None:
            continue
        if p in scan.unreadable:
            raise _unsupported(f"existing Iptc4xmpExt:{p} has a form that cannot be compared.")
        existing = scan.values[p]
        if existing:
            if all(v == wanted for v in existing):
                continue
            raise TelltaleError("XMP_CONFLICT", f"Existing XMP already has a different Iptc4xmpExt:{p}.")
        to_add[p] = wanted
    if not to_add:
        return xml, False
    if len(set(scan.abouts)) > 1:
        raise _unsupported("rdf:Description elements have different rdf:about values.")
    at = scan.rdf_end_offsets[0]
    about = scan.abouts[0] if scan.abouts else ""
    return xml[:at] + description_xml(to_add, about) + xml[at:], True
