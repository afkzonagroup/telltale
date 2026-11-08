# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Runs the shared vectors: Python output must be byte-identical to TypeScript."""

from __future__ import annotations

import hashlib
import unittest
from typing import Any, Dict

from telltale import TelltaleError, mark_image_with_options, read_image_marking

from .vectors import load_vectors, materialise

VECTORS = load_vectors()


def marking_as_dict(m: Any) -> Dict[str, Any]:
    return {
        "format": m.format,
        "hasXmp": m.has_xmp,
        "xmpCount": m.xmp_count,
        "xmpUnreadable": m.xmp_unreadable,
        "digitalSourceTypes": list(m.digital_source_types),
        "generativeAi": m.generative_ai,
        "aiSystemUsed": list(m.ai_system_used),
        "aiSystemVersionUsed": list(m.ai_system_version_used),
        "c2paPresent": m.c2pa_present,
    }


class SharedVectors(unittest.TestCase):
    def test_vector_counts(self) -> None:
        self.assertEqual(VECTORS["version"], 1)
        self.assertGreater(len(VECTORS["mark"]), 100)
        self.assertGreater(len(VECTORS["read"]), 50)

    def test_mark_vectors(self) -> None:
        for v in VECTORS["mark"]:
            with self.subTest(v["id"]):
                data = materialise(v["input"])
                expect = v["expect"]
                if "error" in expect:
                    with self.assertRaises(TelltaleError) as ctx:
                        mark_image_with_options(data, v["options"])
                    self.assertEqual(ctx.exception.code, expect["error"])
                else:
                    r = mark_image_with_options(data, v["options"])
                    self.assertEqual(r.action, expect["action"])
                    self.assertEqual(r.format, expect["format"])
                    self.assertEqual(len(r.data), expect["length"])
                    self.assertEqual(hashlib.sha256(r.data).hexdigest(), expect["sha256"])

    def test_read_vectors(self) -> None:
        for v in VECTORS["read"]:
            with self.subTest(v["id"]):
                data = materialise(v["input"])
                if "markOptions" in v:
                    data = mark_image_with_options(data, v["markOptions"]).data
                if "error" in v["expect"]:
                    with self.assertRaises(TelltaleError):
                        read_image_marking(data)
                else:
                    self.assertEqual(marking_as_dict(read_image_marking(data)), v["expect"])


if __name__ == "__main__":
    unittest.main()
