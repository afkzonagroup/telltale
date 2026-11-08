# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Option validation and the existing-XMP policy (mirrors options.ts and packet.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Mapping, Optional

from ._errors import TelltaleError
from ._xmp import (
    GENERATIVE_DIGITAL_SOURCE_TYPES,
    build_xmp_packet,
    digital_source_type_uri,
    merge_into_packet,
    validate_text_value,
)

DEFAULT_MAX_INPUT_BYTES = 64 * 1024 * 1024
HARD_MAX_INPUT_BYTES = 1024 * 1024 * 1024
_MAX_SAFE_INTEGER = 2**53 - 1

_KNOWN_KEYS = frozenset(
    {
        "digitalSourceType",
        "aiSystemUsed",
        "aiSystemVersionUsed",
        "existingXmp",
        "allowC2paInvalidation",
        "maxInputBytes",
    }
)


@dataclass(frozen=True)
class ResolvedOptions:
    values: Mapping[str, str]
    existing_xmp: str
    allow_c2pa_invalidation: bool
    max_input_bytes: int


def _as_int(value: object) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer() and abs(value) <= _MAX_SAFE_INTEGER:
        return int(value)
    return None


def resolve_options(options: object) -> ResolvedOptions:
    """Validates options given with the camelCase keys of the TypeScript API."""
    if options is None:
        options = {}
    if not isinstance(options, Mapping):
        raise TelltaleError("INVALID_OPTION", "Options must be an object.")
    for k in options:
        if k not in _KNOWN_KEYS:
            raise TelltaleError("INVALID_OPTION", f'Unknown option "{str(k)[:40]}".')
    dst = options.get("digitalSourceType")
    if dst is None:
        dst = "trainedAlgorithmicMedia"
    if not isinstance(dst, str) or dst not in GENERATIVE_DIGITAL_SOURCE_TYPES:
        raise TelltaleError("INVALID_OPTION", "digitalSourceType must be one of the generative AI codes.")
    values: Dict[str, str] = {"DigitalSourceType": digital_source_type_uri(dst)}
    if options.get("aiSystemUsed") is not None:
        values["AISystemUsed"] = validate_text_value("aiSystemUsed", options["aiSystemUsed"])
    if options.get("aiSystemVersionUsed") is not None:
        values["AISystemVersionUsed"] = validate_text_value("aiSystemVersionUsed", options["aiSystemVersionUsed"])
    existing = options.get("existingXmp")
    if existing is None:
        existing = "merge"
    if existing not in ("merge", "replace", "error"):
        raise TelltaleError("INVALID_OPTION", 'existingXmp must be "merge", "replace" or "error".')
    allow = options.get("allowC2paInvalidation")
    if allow is None:
        allow = False
    if not isinstance(allow, bool):
        raise TelltaleError("INVALID_OPTION", "allowC2paInvalidation must be a boolean.")
    raw_max = options.get("maxInputBytes")
    max_bytes = DEFAULT_MAX_INPUT_BYTES if raw_max is None else _as_int(raw_max)
    if max_bytes is None or max_bytes < 1 or max_bytes > HARD_MAX_INPUT_BYTES:
        raise TelltaleError("INVALID_OPTION", f"maxInputBytes must be an integer from 1 to {HARD_MAX_INPUT_BYTES}.")
    return ResolvedOptions(values=values, existing_xmp=str(existing), allow_c2pa_invalidation=allow, max_input_bytes=max_bytes)


def check_input(data: object, max_bytes: int) -> bytes:
    if not isinstance(data, (bytes, bytearray, memoryview)):
        raise TelltaleError("INVALID_OPTION", "Input must be bytes.")
    b = bytes(data)
    if len(b) > max_bytes:
        raise TelltaleError("INPUT_TOO_LARGE", f"Input is larger than the limit of {max_bytes} bytes.")
    return b


MAX_XMP_PACKET_BYTES = 3 * 4 * 1024 * 1024


def decode_utf8(b: bytes) -> str:
    """Strict UTF-8 decoding of an XMP packet, refusing packets that could not pass the scan limit."""
    if len(b) > MAX_XMP_PACKET_BYTES:
        raise TelltaleError("XMP_TOO_LARGE", "XMP packet is too large to scan.")
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        raise TelltaleError("XMP_UNSUPPORTED", "XMP packet is not valid UTF-8.") from None


def decide_packet(found: bool, packet: Optional[bytes], opts: ResolvedOptions) -> "tuple[Optional[bytes], str]":
    """Applies the existing-XMP policy. ``packet`` is None when existing XMP cannot be used.

    Returns (packet bytes, or None when nothing changes; action).
    """
    if not found:
        return build_xmp_packet(opts.values).encode("utf-8"), "inserted"
    if opts.existing_xmp == "error":
        raise TelltaleError("XMP_EXISTS", "The file already has an XMP packet.")
    if opts.existing_xmp == "replace":
        return build_xmp_packet(opts.values).encode("utf-8"), "replaced"
    if packet is None:
        raise TelltaleError(
            "XMP_UNSUPPORTED",
            'The existing XMP packet cannot be merged (compressed or legacy chunk). Use existingXmp "replace".',
        )
    merged, changed = merge_into_packet(decode_utf8(packet), opts.values)
    if not changed:
        return None, "unchanged"
    return merged.encode("utf-8"), "merged"


def c2pa_refused() -> TelltaleError:
    return TelltaleError(
        "C2PA_PRESENT",
        "The file has a C2PA manifest. Adding XMP would invalidate it. Set allowC2paInvalidation only if you re-sign the file.",
    )
