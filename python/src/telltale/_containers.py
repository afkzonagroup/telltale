# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""PNG, JPEG and WebP container handling (mirrors png.ts, jpeg.ts, webp.ts).

Specs: W3C PNG Third Edition (chunks, CRC, iTXt); Adobe XMP Specification
Part 3 (2020) sections 1.1.3 and 1.1.5; ITU-T T.81 Annex B (JPEG markers);
RFC 9649 (WebP container, VP8X, VP8L header); RFC 6386 section 9.1 (VP8
key frame); C2PA Technical Specification 2.2 appendix A.3.
"""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass
from typing import List, Optional, Set

from ._errors import TelltaleError
from ._options import ResolvedOptions, c2pa_refused, decide_packet

# --------------------------------------------------------------------- PNG

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_XMP_KEYWORD = b"XML:com.adobe.xmp"
_MAX_CHUNK_LENGTH = 0x7FFFFFFF
_MAX_PNG_CHUNKS = 100_000


@dataclass(frozen=True)
class MarkResult:
    """The marked file (a new bytes object), its format and what happened."""

    data: bytes
    format: str
    action: str


@dataclass(frozen=True)
class ContainerXmp:
    packet: Optional[bytes]
    xmp_count: int
    unreadable_xmp: bool
    c2pa_present: bool


@dataclass(frozen=True)
class _PngChunk:
    type: bytes
    start: int
    data_start: int
    data_length: int
    end: int


def _is_chunk_type_byte(c: int) -> bool:
    return 0x41 <= c <= 0x5A or 0x61 <= c <= 0x7A


def parse_png(b: bytes) -> List[_PngChunk]:
    if len(b) < 8 or b[:8] != PNG_SIGNATURE:
        raise TelltaleError("UNKNOWN_FORMAT", "Not a PNG file.")
    chunks: List[_PngChunk] = []
    pos = 8
    while True:
        if len(chunks) >= _MAX_PNG_CHUNKS:
            raise TelltaleError("MALFORMED", "Too many PNG chunks.")
        if pos + 12 > len(b):
            raise TelltaleError("TRUNCATED", "PNG ends inside a chunk header.")
        (length,) = struct.unpack_from(">I", b, pos)
        if length > _MAX_CHUNK_LENGTH:
            raise TelltaleError("MALFORMED", "PNG chunk length exceeds 2^31-1.")
        data_start = pos + 8
        end = data_start + length + 4
        if end > len(b):
            raise TelltaleError("TRUNCATED", "PNG ends inside a chunk.")
        ctype = b[pos + 4 : pos + 8]
        if not all(_is_chunk_type_byte(c) for c in ctype):
            raise TelltaleError("MALFORMED", "Invalid PNG chunk type.")
        crc = zlib.crc32(b[pos + 4 : data_start + length]) & 0xFFFFFFFF
        if crc != struct.unpack_from(">I", b, data_start + length)[0]:
            raise TelltaleError("BAD_CRC", "PNG chunk CRC does not match.")
        if not chunks and (ctype != b"IHDR" or length != 13):
            raise TelltaleError("MALFORMED", "PNG must start with a 13-byte IHDR chunk.")
        chunks.append(_PngChunk(ctype, pos, data_start, length, end))
        pos = end
        if ctype == b"IEND":
            if length != 0:
                raise TelltaleError("MALFORMED", "IEND must be empty.")
            if pos != len(b):
                raise TelltaleError("TRAILING_DATA", "Data after IEND.")
            return chunks


def _is_xmp_text_chunk(b: bytes, c: _PngChunk) -> bool:
    if c.type not in (b"iTXt", b"tEXt", b"zTXt"):
        return False
    k = len(_XMP_KEYWORD)
    return c.data_length > k and b[c.data_start : c.data_start + k] == _XMP_KEYWORD and b[c.data_start + k] == 0


def _xmp_chunk_packet(b: bytes, c: _PngChunk) -> Optional[bytes]:
    if c.type != b"iTXt":
        return None
    data_end = c.data_start + c.data_length
    p = c.data_start + len(_XMP_KEYWORD) + 1
    if p + 2 > data_end:
        raise TelltaleError("MALFORMED", "Truncated iTXt chunk.")
    compressed = b[p]
    if compressed not in (0, 1):
        raise TelltaleError("MALFORMED", "Invalid iTXt compression flag.")
    p += 2
    for _ in range(2):
        z = b.find(b"\x00", p, data_end)
        if z < 0:
            raise TelltaleError("MALFORMED", "Truncated iTXt chunk.")
        p = z + 1
    if compressed == 1:
        return None
    return b[p:data_end]


def build_png_xmp_chunk(packet: bytes) -> bytes:
    header = _XMP_KEYWORD + b"\x00\x00\x00\x00\x00"
    data = header + packet
    if len(data) > _MAX_CHUNK_LENGTH:
        raise TelltaleError("XMP_TOO_LARGE", "XMP packet too large for a PNG chunk.")
    body = b"iTXt" + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def _find_png_xmp(b: bytes, chunks: List[_PngChunk]) -> "List[tuple[int, Optional[bytes]]]":
    return [(i, _xmp_chunk_packet(b, c)) for i, c in enumerate(chunks) if _is_xmp_text_chunk(b, c)]


def mark_png(b: bytes, opts: ResolvedOptions) -> MarkResult:
    chunks = parse_png(b)
    if not opts.allow_c2pa_invalidation and any(c.type == b"caBX" for c in chunks):
        raise c2pa_refused()
    xmp = _find_png_xmp(b, chunks)
    if len(xmp) > 1:
        raise TelltaleError("DUPLICATE_XMP", "The PNG has more than one XMP chunk.")
    found = xmp[0] if xmp else None
    packet, action = decide_packet(found is not None, found[1] if found else None, opts)
    if packet is None:
        return MarkResult(bytes(b), "png", action)
    new_chunk = build_png_xmp_chunk(packet)
    ihdr = chunks[0]
    if found is None:
        out = b[: ihdr.end] + new_chunk + b[ihdr.end :]
    else:
        old = chunks[found[0]]
        if old.type == b"iTXt":
            out = b[: old.start] + new_chunk + b[old.end :]
        else:
            out = b[: ihdr.end] + new_chunk + b[ihdr.end : old.start] + b[old.end :]
    return MarkResult(out, "png", action)


def read_png_xmp(b: bytes) -> ContainerXmp:
    chunks = parse_png(b)
    xmp = _find_png_xmp(b, chunks)
    first = xmp[0][1] if xmp else None
    return ContainerXmp(
        packet=first,
        xmp_count=len(xmp),
        unreadable_xmp=bool(xmp) and first is None,
        c2pa_present=any(c.type == b"caBX" for c in chunks),
    )


# -------------------------------------------------------------------- JPEG

XMP_NAMESPACE = b"http://ns.adobe.com/xap/1.0/\x00"
EXTENDED_XMP_NAMESPACE = b"http://ns.adobe.com/xmp/extension/\x00"
MAX_JPEG_XMP_PACKET = 65502
_MAX_SEGMENTS = 65536


@dataclass(frozen=True)
class _Segment:
    marker: int
    start: int
    data_start: int
    end: int


def _is_sof(m: int) -> bool:
    return 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC)


def parse_jpeg_header(b: bytes) -> List[_Segment]:
    if len(b) < 3 or b[0] != 0xFF or b[1] != 0xD8:
        raise TelltaleError("UNKNOWN_FORMAT", "Not a JPEG file.")
    segments: List[_Segment] = []
    pos = 2
    saw_sof = False
    n = len(b)
    while True:
        if len(segments) >= _MAX_SEGMENTS:
            raise TelltaleError("MALFORMED", "Too many JPEG segments.")
        start = pos
        if pos >= n:
            raise TelltaleError("TRUNCATED", "JPEG ends before the image data.")
        if b[pos] != 0xFF:
            raise TelltaleError("MALFORMED", "Expected a JPEG marker.")
        while pos + 1 < n and b[pos + 1] == 0xFF:
            pos += 1
        if pos + 1 >= n:
            raise TelltaleError("TRUNCATED", "JPEG ends inside a marker.")
        marker = b[pos + 1]
        if marker in (0x00, 0xD8):
            raise TelltaleError("MALFORMED", "Unexpected JPEG marker.")
        if marker == 0xD9:
            raise TelltaleError("MALFORMED", "JPEG ends before the image data.")
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            segments.append(_Segment(marker, start, pos + 2, pos + 2))
            pos += 2
            continue
        if pos + 4 > n:
            raise TelltaleError("TRUNCATED", "JPEG ends inside a segment header.")
        (length,) = struct.unpack_from(">H", b, pos + 2)
        if length < 2:
            raise TelltaleError("MALFORMED", "Invalid JPEG segment length.")
        end = pos + 2 + length
        if end > n:
            raise TelltaleError("TRUNCATED", "JPEG ends inside a segment.")
        segments.append(_Segment(marker, start, pos + 4, end))
        if _is_sof(marker):
            saw_sof = True
        if marker == 0xDA:
            if not saw_sof:
                raise TelltaleError("MALFORMED", "JPEG has no frame header before the scan.")
            return segments
        pos = end


def _is_app1_with(b: bytes, s: _Segment, ns: bytes) -> bool:
    return s.marker == 0xE1 and s.end - s.data_start >= len(ns) and b[s.data_start : s.data_start + len(ns)] == ns


def _is_c2pa_segment(b: bytes, s: _Segment) -> bool:
    if s.marker != 0xEB or b[s.data_start : s.data_start + 2] != b"JP":
        return False
    return b.find(b"c2pa", s.data_start, min(s.end, s.data_start + 64)) >= 0


def build_jpeg_xmp_segment(packet: bytes) -> bytes:
    if len(packet) > MAX_JPEG_XMP_PACKET:
        raise TelltaleError("XMP_TOO_LARGE", f"XMP packet exceeds {MAX_JPEG_XMP_PACKET} bytes; ExtendedXMP is not written.")
    return b"\xff\xe1" + struct.pack(">H", 2 + len(XMP_NAMESPACE) + len(packet)) + XMP_NAMESPACE + packet


def mark_jpeg(b: bytes, opts: ResolvedOptions) -> MarkResult:
    segs = parse_jpeg_header(b)
    if not opts.allow_c2pa_invalidation and any(_is_c2pa_segment(b, s) for s in segs):
        raise c2pa_refused()
    xmp_idx = [i for i, s in enumerate(segs) if _is_app1_with(b, s, XMP_NAMESPACE)]
    if len(xmp_idx) > 1:
        raise TelltaleError("DUPLICATE_XMP", "The JPEG has more than one standard XMP segment.")
    found_idx = xmp_idx[0] if xmp_idx else None
    existing = None
    if found_idx is not None:
        f = segs[found_idx]
        existing = b[f.data_start + len(XMP_NAMESPACE) : f.end]
    packet, action = decide_packet(found_idx is not None, existing, opts)
    if packet is None:
        return MarkResult(bytes(b), "jpeg", action)
    new_seg = build_jpeg_xmp_segment(packet)
    touched: Set[int] = set()
    if found_idx is not None:
        touched.add(found_idx)
        insert_at = found_idx
        if action == "replaced":
            touched.update(i for i, s in enumerate(segs) if _is_app1_with(b, s, EXTENDED_XMP_NAMESPACE))
    else:
        insert_at = 0
        while insert_at < len(segs):
            s = segs[insert_at]
            if not (s.marker == 0xE0 or _is_app1_with(b, s, b"Exif\x00\x00")):
                break
            insert_at += 1
    mpf_idx = next((i for i, s in enumerate(segs) if s.marker == 0xE2 and b[s.data_start : s.data_start + 4] == b"MPF\x00"), -1)
    if mpf_idx >= 0 and (insert_at > mpf_idx or any(i > mpf_idx for i in touched)):
        raise TelltaleError("UNSUPPORTED_LAYOUT", "Changing this JPEG would shift Multi-Picture Format offsets.")
    parts = [b[:2]]
    for i, s in enumerate(segs):
        if i == insert_at:
            parts.append(new_seg)
        if i not in touched:
            parts.append(b[s.start : s.end])
    parts.append(b[segs[-1].end :])
    return MarkResult(b"".join(parts), "jpeg", action)


def read_jpeg_xmp(b: bytes) -> ContainerXmp:
    segs = parse_jpeg_header(b)
    xmp = [s for s in segs if _is_app1_with(b, s, XMP_NAMESPACE)]
    return ContainerXmp(
        packet=b[xmp[0].data_start + len(XMP_NAMESPACE) : xmp[0].end] if xmp else None,
        xmp_count=len(xmp),
        unreadable_xmp=False,
        c2pa_present=any(_is_c2pa_segment(b, s) for s in segs),
    )


# -------------------------------------------------------------------- WebP

_FLAG_ALPHA = 0x10
_FLAG_XMP = 0x04
_MAX_RIFF_CHUNKS = 100_000
_MAX_RIFF_SIZE = 0xFFFFFFF6
_IMAGE_CHUNKS = frozenset({b"VP8X", b"ICCP", b"ANIM", b"ANMF", b"ALPH", b"VP8 ", b"VP8L", b"EXIF"})


@dataclass(frozen=True)
class _RiffChunk:
    fourcc: bytes
    start: int
    data_start: int
    size: int
    end: int


def parse_webp(b: bytes) -> List[_RiffChunk]:
    if len(b) < 12 or b[:4] != b"RIFF" or b[8:12] != b"WEBP":
        raise TelltaleError("UNKNOWN_FORMAT", "Not a WebP file.")
    (riff_size,) = struct.unpack_from("<I", b, 4)
    if riff_size % 2 != 0 or riff_size < 4:
        raise TelltaleError("MALFORMED", "Invalid RIFF size.")
    if riff_size + 8 > len(b):
        raise TelltaleError("TRUNCATED", "WebP is shorter than its RIFF size.")
    if riff_size + 8 < len(b):
        raise TelltaleError("TRAILING_DATA", "Data after the RIFF chunk.")
    chunks: List[_RiffChunk] = []
    pos = 12
    while pos < len(b):
        if len(chunks) >= _MAX_RIFF_CHUNKS:
            raise TelltaleError("MALFORMED", "Too many WebP chunks.")
        if pos + 8 > len(b):
            raise TelltaleError("TRUNCATED", "WebP ends inside a chunk header.")
        (size,) = struct.unpack_from("<I", b, pos + 4)
        end = pos + 8 + size + (size % 2)
        if end > len(b):
            raise TelltaleError("TRUNCATED", "WebP ends inside a chunk.")
        chunks.append(_RiffChunk(b[pos : pos + 4], pos, pos + 8, size, end))
        pos = end
    if not chunks:
        raise TelltaleError("MALFORMED", "WebP has no chunks.")
    first = chunks[0]
    if first.fourcc not in (b"VP8 ", b"VP8L", b"VP8X"):
        raise TelltaleError("MALFORMED", "WebP must start with VP8, VP8L or VP8X.")
    if first.fourcc == b"VP8X" and first.size < 10:
        raise TelltaleError("MALFORMED", "VP8X chunk too short.")
    return chunks


def _vp8_canvas(b: bytes, c: _RiffChunk) -> "tuple[int, int, bool]":
    d = c.data_start
    if c.size < 10:
        raise TelltaleError("MALFORMED", "VP8 chunk too short.")
    if b[d] & 1 != 0:
        raise TelltaleError("MALFORMED", "VP8 data does not start with a key frame.")
    if b[d + 3 : d + 6] != b"\x9d\x01\x2a":
        raise TelltaleError("MALFORMED", "Missing VP8 start code.")
    width = struct.unpack_from("<H", b, d + 6)[0] & 0x3FFF
    height = struct.unpack_from("<H", b, d + 8)[0] & 0x3FFF
    if width == 0 or height == 0:
        raise TelltaleError("MALFORMED", "VP8 image has zero size.")
    return width, height, False


def _vp8l_canvas(b: bytes, c: _RiffChunk) -> "tuple[int, int, bool]":
    d = c.data_start
    if c.size < 5:
        raise TelltaleError("MALFORMED", "VP8L chunk too short.")
    if b[d] != 0x2F:
        raise TelltaleError("MALFORMED", "Missing VP8L signature.")
    (bits,) = struct.unpack_from("<I", b, d + 1)
    if bits >> 29 != 0:
        raise TelltaleError("MALFORMED", "Unsupported VP8L version.")
    return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1, ((bits >> 28) & 1) == 1


def _vp8x_chunk(width: int, height: int, alpha: bool) -> bytes:
    flags = _FLAG_XMP | (_FLAG_ALPHA if alpha else 0)
    return b"VP8X" + struct.pack("<I", 10) + bytes([flags, 0, 0, 0]) + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")


def build_webp_xmp_chunk(packet: bytes) -> bytes:
    return b"XMP " + struct.pack("<I", len(packet)) + packet + (b"\x00" if len(packet) % 2 else b"")


def mark_webp(b: bytes, opts: ResolvedOptions) -> MarkResult:
    chunks = parse_webp(b)
    if not opts.allow_c2pa_invalidation and any(c.fourcc == b"C2PA" for c in chunks):
        raise c2pa_refused()
    xmp_idx = [i for i, c in enumerate(chunks) if c.fourcc == b"XMP "]
    if len(xmp_idx) > 1:
        raise TelltaleError("DUPLICATE_XMP", "The WebP has more than one XMP chunk.")
    found_idx = xmp_idx[0] if xmp_idx else None
    existing = None
    if found_idx is not None:
        f = chunks[found_idx]
        existing = b[f.data_start : f.data_start + f.size]
    packet, action = decide_packet(found_idx is not None, existing, opts)
    first = chunks[0]
    is_extended = first.fourcc == b"VP8X"
    flag_set = is_extended and (b[first.data_start] & _FLAG_XMP) != 0
    if packet is None and flag_set:
        return MarkResult(bytes(b), "webp", action)
    packet_chunk = build_webp_xmp_chunk(packet) if packet is not None else None
    insert_after = 0
    for i, c in enumerate(chunks):
        if c.fourcc in _IMAGE_CHUNKS:
            insert_after = i
    parts = [b[:12]]
    for i, c in enumerate(chunks):
        if i == 0:
            if is_extended:
                vp8x = bytearray(b[c.start : c.end])
                vp8x[8] |= _FLAG_XMP
                parts.append(bytes(vp8x))
            else:
                w, h, alpha = _vp8_canvas(b, c) if c.fourcc == b"VP8 " else _vp8l_canvas(b, c)
                parts.append(_vp8x_chunk(w, h, alpha))
                parts.append(b[c.start : c.end])
        elif i == found_idx and packet_chunk is not None:
            parts.append(packet_chunk)
        else:
            parts.append(b[c.start : c.end])
        if i == insert_after and found_idx is None and packet_chunk is not None:
            parts.append(packet_chunk)
    out = bytearray(b"".join(parts))
    riff_size = len(out) - 8
    if riff_size > _MAX_RIFF_SIZE:
        raise TelltaleError("XMP_TOO_LARGE", "Result exceeds the RIFF size limit.")
    out[4:8] = struct.pack("<I", riff_size)
    return MarkResult(bytes(out), "webp", "merged" if action == "unchanged" else action)


def read_webp_xmp(b: bytes) -> ContainerXmp:
    chunks = parse_webp(b)
    xmp = [c for c in chunks if c.fourcc == b"XMP "]
    return ContainerXmp(
        packet=b[xmp[0].data_start : xmp[0].data_start + xmp[0].size] if xmp else None,
        xmp_count=len(xmp),
        unreadable_xmp=False,
        c2pa_present=any(c.fourcc == b"C2PA" for c in chunks),
    )
