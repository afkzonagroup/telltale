# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Telltale for Python: mark AI-generated PNG, JPEG and WebP images with XMP.

Writes the IPTC ``Iptc4xmpExt:DigitalSourceType`` property with a generative
AI NewsCodes value (for example
``http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia``).
Pure Python, standard library only, byte-identical to the TypeScript package.

This is unsigned metadata: easy to strip or forge. It is not a watermark and
not a C2PA manifest, and on its own it does not meet the multi-layer marking
approach of the Commission's Code of Practice on Transparency of
AI-Generated Content. Not legal advice.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional, Tuple, Union

BytesLike = Union[bytes, bytearray, memoryview]

from ._containers import (
    MAX_JPEG_XMP_PACKET,
    MarkResult,
    mark_jpeg,
    mark_png,
    mark_webp,
    read_jpeg_xmp,
    read_png_xmp,
    read_webp_xmp,
)
from ._errors import TelltaleError
from ._options import DEFAULT_MAX_INPUT_BYTES, HARD_MAX_INPUT_BYTES, check_input, decode_utf8, resolve_options
from ._xmp import (
    GENERATIVE_DIGITAL_SOURCE_TYPES,
    IPTC_DIGITAL_SOURCE_TYPE_SCHEME,
    IPTC_EXT_NS,
    build_xmp_packet,
    is_generative_uri,
    scan_xmp,
)

__version__ = "0.1.1"

__all__ = [
    "DEFAULT_MAX_INPUT_BYTES",
    "GENERATIVE_DIGITAL_SOURCE_TYPES",
    "HARD_MAX_INPUT_BYTES",
    "IPTC_DIGITAL_SOURCE_TYPE_SCHEME",
    "IPTC_EXT_NS",
    "MAX_JPEG_XMP_PACKET",
    "ImageMarking",
    "MarkResult",
    "TelltaleError",
    "build_xmp_packet",
    "detect_image_format",
    "mark_image",
    "mark_image_with_options",
    "read_image_marking",
]


def detect_image_format(data: BytesLike) -> Optional[str]:
    """Returns ``"png"``, ``"jpeg"``, ``"webp"`` or None."""
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def mark_image_with_options(data: BytesLike, options: Optional[Mapping[str, object]] = None) -> MarkResult:
    """Same as :func:`mark_image`, with options keyed like the TypeScript API
    (``digitalSourceType``, ``aiSystemUsed``, ``aiSystemVersionUsed``,
    ``existingXmp``, ``allowC2paInvalidation``, ``maxInputBytes``).
    Unknown keys raise ``TelltaleError("INVALID_OPTION")``. Useful for config files."""
    opts = resolve_options(options)
    b = check_input(data, opts.max_input_bytes)
    fmt = detect_image_format(b)
    if fmt == "png":
        return mark_png(b, opts)
    if fmt == "jpeg":
        return mark_jpeg(b, opts)
    if fmt == "webp":
        return mark_webp(b, opts)
    raise TelltaleError("UNKNOWN_FORMAT", "Only PNG, JPEG and WebP are supported.")


def mark_image(
    data: BytesLike,
    *,
    digital_source_type: str = "trainedAlgorithmicMedia",
    ai_system_used: Optional[str] = None,
    ai_system_version_used: Optional[str] = None,
    existing_xmp: str = "merge",
    allow_c2pa_invalidation: bool = False,
    max_input_bytes: int = DEFAULT_MAX_INPUT_BYTES,
) -> MarkResult:
    """Writes (or merges) an XMP packet marking the image as AI-generated.

    Returns a new :class:`MarkResult`; ``data`` is never modified. Raises
    :class:`TelltaleError` for malformed or unsupported input.

    >>> result = mark_image(png_bytes, ai_system_used="Example Model")  # doctest: +SKIP
    >>> result.action  # doctest: +SKIP
    'inserted'
    """
    options = {
        "digitalSourceType": digital_source_type,
        "existingXmp": existing_xmp,
        "allowC2paInvalidation": allow_c2pa_invalidation,
        "maxInputBytes": max_input_bytes,
    }
    if ai_system_used is not None:
        options["aiSystemUsed"] = ai_system_used
    if ai_system_version_used is not None:
        options["aiSystemVersionUsed"] = ai_system_version_used
    return mark_image_with_options(data, options)


@dataclass(frozen=True)
class ImageMarking:
    """What :func:`read_image_marking` found. Informational only: metadata is easy to strip or forge."""

    format: str
    has_xmp: bool
    xmp_count: int
    xmp_unreadable: bool
    digital_source_types: Tuple[str, ...]
    generative_ai: bool
    ai_system_used: Tuple[str, ...]
    ai_system_version_used: Tuple[str, ...]
    c2pa_present: bool


def _unique(values: "list[str]") -> Tuple[str, ...]:
    return tuple(dict.fromkeys(values))


def read_image_marking(data: BytesLike, *, max_input_bytes: int = DEFAULT_MAX_INPUT_BYTES) -> ImageMarking:
    """Reads the AI marking from an image without modifying it."""
    resolve_options({"maxInputBytes": max_input_bytes})
    b = check_input(data, max_input_bytes)
    fmt = detect_image_format(b)
    if fmt == "png":
        container = read_png_xmp(b)
    elif fmt == "jpeg":
        container = read_jpeg_xmp(b)
    elif fmt == "webp":
        container = read_webp_xmp(b)
    else:
        raise TelltaleError("UNKNOWN_FORMAT", "Only PNG, JPEG and WebP are supported.")
    unreadable = container.unreadable_xmp
    dst: Tuple[str, ...] = ()
    system: Tuple[str, ...] = ()
    version: Tuple[str, ...] = ()
    if container.packet is not None:
        try:
            scan = scan_xmp(decode_utf8(container.packet))
            dst = _unique(scan.values["DigitalSourceType"])
            system = _unique(scan.values["AISystemUsed"])
            version = _unique(scan.values["AISystemVersionUsed"])
            if scan.unreadable:
                unreadable = True
        except TelltaleError:
            unreadable = True
    return ImageMarking(
        format=fmt,
        has_xmp=container.xmp_count > 0,
        xmp_count=container.xmp_count,
        xmp_unreadable=unreadable,
        digital_source_types=dst,
        generative_ai=any(is_generative_uri(v) for v in dst),
        ai_system_used=system,
        ai_system_version_used=version,
        c2pa_present=container.c2pa_present,
    )
