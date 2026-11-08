# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Loads the shared test vectors (test-vectors/marking.json) used by both implementations."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Union

ROOT = Path(__file__).resolve().parents[2] / "test-vectors"


def load_vectors() -> Dict[str, Any]:
    with open(ROOT / "marking.json", encoding="utf-8") as f:
        data: Dict[str, Any] = json.load(f)
    return data


def fixture(name: str) -> bytes:
    return (ROOT / "fixtures" / name).read_bytes()


def materialise(spec: Union[str, Dict[str, Any]]) -> bytes:
    """Same semantics as scripts/generate-vectors.mjs and test/helpers/vectors.ts."""
    if isinstance(spec, str):
        return (ROOT / spec).read_bytes()
    b = bytearray() if spec["base"] is None else bytearray((ROOT / spec["base"]).read_bytes())
    for op in spec["ops"]:
        h = bytes.fromhex(op.get("hex", ""))
        offset = op.get("offset", 0)
        kind = op["op"]
        if kind == "truncate":
            b = b[: op["length"]]
        elif kind == "set":
            b[offset : offset + len(h)] = h
        elif kind == "xor":
            for i, m in enumerate(h):
                b[offset + i] ^= m
        elif kind == "append":
            b += h
        elif kind == "insert":
            b[offset:offset] = h
        elif kind == "remove":
            del b[offset : offset + op["length"]]
        else:
            raise ValueError(kind)
    return bytes(b)
