// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0
//
// Builds the derived test fixtures from the base images in
// test-vectors/fixtures. The base images were made with ffmpeg, sips, cwebp
// and img2webp (see test-vectors/README.md). The derived files hold
// third-party style XMP, C2PA placeholders, MPF segments and similar layouts.
// This script uses its own minimal chunk writers, independent of src/.
//
// Run: node scripts/make-fixtures.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test-vectors/fixtures/', import.meta.url));
const read = (n) => new Uint8Array(readFileSync(dir + n));
const write = (n, b) => writeFileSync(dir + n, b);
const enc = (s) => new TextEncoder().encode(s);
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const be32 = (v) => Uint8Array.of(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const le32 = (v) => Uint8Array.of(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24);
const be16 = (v) => Uint8Array.of(v >>> 8, v & 255);

const BOM = String.fromCharCode(0xfeff);
const THIRD_PARTY_XMP =
  `<?xpacket begin="${BOM}" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
  '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Example XMP Core 1.0">\n' +
  ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
  '  <rdf:Description rdf:about=""\n' +
  '    xmlns:dc="http://purl.org/dc/elements/1.1/"\n' +
  '    xmlns:xmp="http://ns.adobe.com/xap/1.0/"\n' +
  '   xmp:CreatorTool="Example Editor 2.0">\n' +
  '   <dc:title>\n' +
  '    <rdf:Alt>\n' +
  '     <rdf:li xml:lang="x-default">Harbour at dusk &amp; boats</rdf:li>\n' +
  '    </rdf:Alt>\n' +
  '   </dc:title>\n' +
  '  </rdf:Description>\n' +
  ' </rdf:RDF>\n' +
  '</x:xmpmeta>\n' +
  ' '.repeat(100) + '\n' + ' '.repeat(100) + '\n' +
  '<?xpacket end="w"?>';

const SAME_DST_XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:ext="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" ' +
  'ext:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>' +
  '</rdf:RDF></x:xmpmeta>';

const OTHER_DST_XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">' +
  '<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture</Iptc4xmpExt:DigitalSourceType>' +
  '</rdf:Description></rdf:RDF></x:xmpmeta>';

const DOCTYPE_XMP =
  '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>' +
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="">&lol2;</rdf:Description></rdf:RDF></x:xmpmeta>';

// ---------- PNG ----------
const pngChunk = (type, data) => {
  const td = cat(enc(type), data);
  return cat(be32(data.length), td, be32(crc(td)));
};
const itxt = (text, compressed = false) =>
  pngChunk(
    'iTXt',
    cat(enc('XML:com.adobe.xmp'), Uint8Array.of(0, compressed ? 1 : 0, 0, 0, 0), compressed ? deflateSync(enc(text)) : enc(text)),
  );
const pngBase = read('basic.png');
const IHDR_END = 8 + 25;
const pngWith = (...chunks) => cat(pngBase.subarray(0, IHDR_END), ...chunks, pngBase.subarray(IHDR_END));

write('png-with-xmp.png', pngWith(itxt(THIRD_PARTY_XMP)));
write('png-xmp-same-dst.png', pngWith(itxt(SAME_DST_XMP)));
write('png-xmp-other-dst.png', pngWith(itxt(OTHER_DST_XMP)));
write('png-xmp-compressed.png', pngWith(itxt(THIRD_PARTY_XMP, true)));
write('png-xmp-legacy-text.png', pngWith(pngChunk('tEXt', cat(enc('XML:com.adobe.xmp'), Uint8Array.of(0), enc(SAME_DST_XMP)))));
write('png-xmp-doctype.png', pngWith(itxt(DOCTYPE_XMP)));
write('png-two-xmp.png', pngWith(itxt(THIRD_PARTY_XMP), itxt(SAME_DST_XMP)));
// Placeholder JUMBF superbox with the c2pa label; not a valid manifest, only the container signal.
const JUMBF = cat(be32(36), enc('jumb'), be32(28), enc('jumd'), enc('c2pa'), Uint8Array.of(0, 0x11, 0, 0x10, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71), Uint8Array.of(3), enc('c2pa'), Uint8Array.of(0));
write('png-c2pa.png', pngWith(pngChunk('caBX', JUMBF)));

// ---------- JPEG ----------
const app = (marker, payload) => cat(Uint8Array.of(0xff, marker), be16(payload.length + 2), payload);
const XMP_NS = enc('http://ns.adobe.com/xap/1.0/\0');
const EXT_NS = enc('http://ns.adobe.com/xmp/extension/\0');
const sips = read('sips.jpg');
// sips.jpg: SOI, APP0 JFIF (18 bytes), APP1 Exif. Insert XMP after the Exif segment.
const exifLen = (sips[22] << 8) | sips[23];
const afterExif = 2 + 18 + 2 + exifLen;
write('jpeg-with-xmp.jpg', cat(sips.subarray(0, afterExif), app(0xe1, cat(XMP_NS, enc(THIRD_PARTY_XMP))), sips.subarray(afterExif)));
write('jpeg-two-xmp.jpg', cat(sips.subarray(0, afterExif), app(0xe1, cat(XMP_NS, enc(THIRD_PARTY_XMP))), app(0xe1, cat(XMP_NS, enc(SAME_DST_XMP))), sips.subarray(afterExif)));

const GUID = '0123456789ABCDEF0123456789ABCDEF';
const EXT_PACKET = enc('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" photoshop:History="long history"/></rdf:RDF></x:xmpmeta>');
const STD_WITH_EXT =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  `<rdf:Description rdf:about="" xmlns:xmpNote="http://ns.adobe.com/xmp/note/" xmpNote:HasExtendedXMP="${GUID}"/>` +
  '</rdf:RDF></x:xmpmeta>';
const extSeg = app(0xe1, cat(EXT_NS, enc(GUID), be32(EXT_PACKET.length), be32(0), EXT_PACKET));
write('jpeg-extended-xmp.jpg', cat(sips.subarray(0, afterExif), app(0xe1, cat(XMP_NS, enc(STD_WITH_EXT))), extSeg, sips.subarray(afterExif)));

// A packet close to the 65502-byte APP1 limit: merging more properties must fail with XMP_TOO_LARGE.
const bigPacket = THIRD_PARTY_XMP.replace('<?xpacket end="w"?>', ' '.repeat(65450 - enc(THIRD_PARTY_XMP).length) + '<?xpacket end="w"?>');
write('jpeg-big-xmp.jpg', cat(sips.subarray(0, afterExif), app(0xe1, cat(XMP_NS, enc(bigPacket))), sips.subarray(afterExif)));

const MPF = app(0xe2, cat(enc('MPF\0'), Uint8Array.of(0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8)));
const basicJpg = read('basic.jpg');
// basic.jpg: SOI, APP0 JFIF (18 bytes), COM, ...
write('jpeg-mpf-after-app0.jpg', cat(basicJpg.subarray(0, 20), MPF, basicJpg.subarray(20)));
write('jpeg-xmp-after-mpf.jpg', cat(basicJpg.subarray(0, 20), MPF, app(0xe1, cat(XMP_NS, enc(THIRD_PARTY_XMP))), basicJpg.subarray(20)));
write('jpeg-c2pa.jpg', cat(basicJpg.subarray(0, 20), app(0xeb, cat(enc('JP'), Uint8Array.of(0, 1), be32(1), JUMBF)), basicJpg.subarray(20)));
// Fill bytes before a marker are legal (T.81 B.1.1.2).
write('jpeg-fill-bytes.jpg', cat(basicJpg.subarray(0, 20), Uint8Array.of(0xff, 0xff), basicJpg.subarray(20)));

// ---------- WebP ----------
const riffChunk = (fourcc, data) => cat(enc(fourcc), le32(data.length), data, data.length % 2 ? Uint8Array.of(0) : new Uint8Array(0));
const withRiffSize = (b) => {
  const out = b.slice();
  out.set(le32(out.length - 8), 4);
  return out;
};
const alpha = read('alpha.webp');
write('webp-c2pa.webp', withRiffSize(cat(alpha, riffChunk('C2PA', JUMBF))));
write('webp-unknown-chunk.webp', withRiffSize(cat(alpha, riffChunk('ABCD', enc('odd')))));
const twoXmp = withRiffSize(cat(alpha, riffChunk('XMP ', enc(SAME_DST_XMP)), riffChunk('XMP ', enc(SAME_DST_XMP))));
twoXmp[20] |= 0x04;
write('webp-two-xmp.webp', twoXmp);
const noFlag = withRiffSize(cat(alpha, riffChunk('XMP ', enc(SAME_DST_XMP))));
write('webp-xmp-no-flag.webp', noFlag);

// Text file used by webpmux to make webp-with-xmp.webp and webp-exif.webp (third-party writer).
write('third-party.xmp', enc(THIRD_PARTY_XMP));
console.log('fixtures written');
