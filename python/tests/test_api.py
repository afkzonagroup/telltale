# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Public API behaviour beyond the shared vectors."""

from __future__ import annotations

import dataclasses
import random
import time
import unittest

import telltale
from telltale import TelltaleError, detect_image_format, mark_image, read_image_marking
from telltale._xmp import (
    MAX_XMP_DEPTH,
    MAX_XMP_SCAN_LENGTH,
    build_xmp_packet,
    decode_entities,
    merge_into_packet,
    scan_xmp,
    validate_text_value,
)

from .vectors import fixture

DST = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
IPTC = "http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
RDF = 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"'


def wrap(inner: str) -> str:
    return f'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF {RDF}>{inner}</rdf:RDF></x:xmpmeta>'


class Api(unittest.TestCase):
    def test_keyword_api_round_trip_and_idempotence(self) -> None:
        for name in ("basic.png", "basic.jpg", "sips.jpg", "lossy.webp", "lossless.webp", "alpha.webp", "animated.webp"):
            with self.subTest(name):
                src = fixture(name)
                once = mark_image(src, ai_system_used="Example Model", ai_system_version_used="1.0")
                self.assertEqual(once.action, "inserted")
                read = read_image_marking(once.data)
                self.assertTrue(read.generative_ai)
                self.assertEqual(read.digital_source_types, (DST,))
                self.assertEqual(read.ai_system_used, ("Example Model",))
                twice = mark_image(once.data, ai_system_used="Example Model", ai_system_version_used="1.0")
                self.assertEqual(twice.action, "unchanged")
                self.assertEqual(twice.data, once.data)

    def test_accepts_bytes_like_and_never_modifies_input(self) -> None:
        src = bytearray(fixture("basic.png"))
        before = bytes(src)
        out = mark_image(src)
        self.assertEqual(bytes(src), before)
        self.assertIsInstance(out.data, bytes)
        self.assertEqual(mark_image(memoryview(before)).data, out.data)
        with self.assertRaises(TelltaleError) as ctx:
            mark_image("not bytes")  # type: ignore[arg-type]
        self.assertEqual(ctx.exception.code, "INVALID_OPTION")

    def test_options_are_validated(self) -> None:
        src = fixture("basic.png")
        for kwargs in (
            {"digital_source_type": "digitalCapture"},
            {"existing_xmp": "keep"},
            {"max_input_bytes": 0},
            {"max_input_bytes": True},
            {"ai_system_used": "<script>\x07"},
        ):
            with self.subTest(kwargs):
                with self.assertRaises(TelltaleError):
                    mark_image(src, **kwargs)
        with self.assertRaises(TelltaleError):
            telltale.mark_image_with_options(src, ["x"])  # type: ignore[arg-type]
        with self.assertRaises(TelltaleError):
            read_image_marking(src, max_input_bytes=10)

    def test_results_are_immutable(self) -> None:
        r = mark_image(fixture("basic.png"))
        with self.assertRaises(dataclasses.FrozenInstanceError):
            r.action = "x"  # type: ignore[misc]

    def test_detect(self) -> None:
        self.assertEqual(detect_image_format(fixture("basic.png")), "png")
        self.assertEqual(detect_image_format(fixture("basic.jpg")), "jpeg")
        self.assertEqual(detect_image_format(fixture("lossy.webp")), "webp")
        self.assertIsNone(detect_image_format(b"GIF89a"))

    def test_version(self) -> None:
        self.assertEqual(telltale.__version__, "0.1.1")


class Scanner(unittest.TestCase):
    def test_build_and_scan(self) -> None:
        p = build_xmp_packet({"DigitalSourceType": DST, "AISystemUsed": "A & <B>"})
        s = scan_xmp(p)
        self.assertEqual(s.values["DigitalSourceType"], [DST])
        self.assertEqual(s.values["AISystemUsed"], ["A & <B>"])

    def test_forms(self) -> None:
        self.assertEqual(scan_xmp(wrap(f'<rdf:Description xmlns:e="{IPTC}" e:DigitalSourceType="{DST}"/>')).values["DigitalSourceType"], [DST])
        res = f'<rdf:Description xmlns:I="{IPTC}"><I:DigitalSourceType rdf:resource="{DST}"/></rdf:Description>'
        self.assertEqual(scan_xmp(wrap(res)).values["DigitalSourceType"], [DST])

    def test_rejects_doctype_and_bad_xml(self) -> None:
        for bad in (
            '<!DOCTYPE x [<!ENTITY a "a">]><a>&a;</a>',
            "<a>",
            "<a></b>",
            "<p:a></p:a>",
            '<a x="1" x="2"/>',
            "<a x=1/>",
            '<a x="<"/>',
            "&lol;",
        ):
            with self.subTest(bad):
                with self.assertRaises(TelltaleError) as ctx:
                    scan_xmp(bad) if not bad.startswith("&") else decode_entities(bad)
                self.assertEqual(ctx.exception.code, "XMP_UNSUPPORTED")

    def test_limits(self) -> None:
        scan_xmp("<a>" * MAX_XMP_DEPTH + "</a>" * MAX_XMP_DEPTH)
        with self.assertRaises(TelltaleError):
            scan_xmp("<a>" * (MAX_XMP_DEPTH + 1) + "</a>" * (MAX_XMP_DEPTH + 1))
        with self.assertRaises(TelltaleError) as ctx:
            scan_xmp(" " * (MAX_XMP_SCAN_LENGTH + 1))
        self.assertEqual(ctx.exception.code, "XMP_TOO_LARGE")
        decls = " ".join(f'xmlns:p{i}="u{i}"' for i in range(300))
        with self.assertRaises(TelltaleError):
            scan_xmp(f"<a {decls}/>")

    def test_linear_time_on_hostile_input(self) -> None:
        inputs = [
            "xmlns:" * 300_000,
            "<a " + 'x="1" ' * 200_000,
            "<a " + " ".join(f'a{i}="1"' for i in range(100_000)) + "/>",
            "<r>" + '<a xmlns:p="u"/>' * 100_000 + "</r>",
            "&" * 1_000_000,
        ]
        for s in inputs:
            t = time.perf_counter()
            try:
                scan_xmp(s)
            except TelltaleError:
                pass
            self.assertLess(time.perf_counter() - t, 5.0)

    def test_text_values_count_utf16_units(self) -> None:
        self.assertEqual(validate_text_value("v", "\U0001F600" * 128), "\U0001F600" * 128)
        for bad in ("\U0001F600" * 129, "\ufeffx", "x\u00a0", "a\ud800", "", "a\u2028"):
            with self.subTest(repr(bad)):
                with self.assertRaises(TelltaleError):
                    validate_text_value("v", bad)

    def test_merge(self) -> None:
        base = wrap('<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>image/png</dc:format></rdf:Description>')
        merged, changed = merge_into_packet(base, {"DigitalSourceType": DST})
        self.assertTrue(changed)
        self.assertIn("<dc:format>image/png</dc:format>", merged)
        again, changed2 = merge_into_packet(merged, {"DigitalSourceType": DST})
        self.assertFalse(changed2)
        self.assertEqual(again, merged)
        with self.assertRaises(TelltaleError) as ctx:
            merge_into_packet(wrap(f'<rdf:Description xmlns:I="{IPTC}" I:DigitalSourceType="x"/>'), {"DigitalSourceType": DST})
        self.assertEqual(ctx.exception.code, "XMP_CONFLICT")


class Limits(unittest.TestCase):
    def test_chunk_caps_match_typescript(self) -> None:
        import struct
        import zlib

        base = fixture("basic.png")
        empty = struct.pack(">I", 0) + b"tEXt" + struct.pack(">I", zlib.crc32(b"tEXt") & 0xFFFFFFFF)
        with self.assertRaises(TelltaleError) as ctx:
            mark_image(base[:33] + empty * 100_000 + base[33:])
        self.assertEqual(ctx.exception.code, "MALFORMED")
        self.assertEqual(mark_image(base[:33] + empty * 90_000 + base[33:]).action, "inserted")
        webp = fixture("alpha.webp") + b"ABCD\x00\x00\x00\x00" * 100_000
        webp = webp[:4] + struct.pack("<I", len(webp) - 8) + webp[8:]
        with self.assertRaises(TelltaleError) as ctx:
            mark_image(webp)
        self.assertEqual(ctx.exception.code, "MALFORMED")

    def test_oversized_packet_is_not_decoded(self) -> None:
        from telltale._options import MAX_XMP_PACKET_BYTES, decode_utf8

        with self.assertRaises(TelltaleError) as ctx:
            decode_utf8(b" " * (MAX_XMP_PACKET_BYTES + 1))
        self.assertEqual(ctx.exception.code, "XMP_TOO_LARGE")


class Fuzz(unittest.TestCase):
    def test_only_telltale_errors_and_readable_outputs(self) -> None:
        rnd = random.Random(20261108)
        names = ("basic.png", "png-with-xmp.png", "basic.jpg", "jpeg-with-xmp.jpg", "lossy.webp", "alpha.webp", "animated.webp")
        successes = 0
        for name in names:
            base = fixture(name)
            for _ in range(300):
                b = bytearray(base)
                for _ in range(rnd.randint(1, 4)):
                    pos = rnd.randrange(len(b) + 1)
                    op = rnd.randrange(4)
                    if op == 0 and b:
                        b[min(pos, len(b) - 1)] = rnd.randrange(256)
                    elif op == 1:
                        del b[pos:]
                    elif op == 2:
                        b[pos:pos] = bytes(rnd.randrange(256) for _ in range(rnd.randint(1, 16)))
                    else:
                        del b[pos : pos + rnd.randint(1, 16)]
                try:
                    out = mark_image(bytes(b))
                    self.assertIn(DST, read_image_marking(out.data).digital_source_types)
                    successes += 1
                except TelltaleError:
                    pass
        self.assertGreater(successes, 50)


if __name__ == "__main__":
    unittest.main()
