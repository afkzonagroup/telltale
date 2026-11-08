# Telltale for Python

Marks AI-generated PNG, JPEG and WebP images with XMP metadata, for the
machine-readable marking duty in Article 50(2) of the EU AI Act
([Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)).
Standard library only, Python 3.10 or newer. Not legal advice.

It writes the IPTC property `Iptc4xmpExt:DigitalSourceType` with a
generative AI value from the
[IPTC Digital Source Type NewsCodes](https://cv.iptc.org/newscodes/digitalsourcetype/),
and optionally `AISystemUsed` and `AISystemVersionUsed`. Output is
byte-identical to the TypeScript package (`@afkzona/telltale`): both run the
same test vectors.

## Install

From this repository:

```sh
pip install ./python
```

The distribution name is `afkzona-telltale`; the import name is `telltale`.

## Use

```python
from telltale import TelltaleError, mark_image, read_image_marking

with open("generated.png", "rb") as f:
    data = f.read()

try:
    result = mark_image(
        data,
        digital_source_type="trainedAlgorithmicMedia",
        ai_system_used="Example Image Model",
        ai_system_version_used="2.0",
    )
except TelltaleError as e:
    print("not marked:", e.code)
else:
    with open("generated.marked.png", "wb") as f:
        f.write(result.data)
    print(result.action)                                   # inserted
    print(read_image_marking(result.data).generative_ai)   # True
```

Options:

| Argument | Default | Values |
|---|---|---|
| `digital_source_type` | `trainedAlgorithmicMedia` | `trainedAlgorithmicMedia`, `compositeWithTrainedAlgorithmicMedia`, `compositeSynthetic` |
| `ai_system_used`, `ai_system_version_used` | `None` | 1-256 characters, no control characters |
| `existing_xmp` | `merge` | `merge` keeps other metadata, `replace`, `error` |
| `allow_c2pa_invalidation` | `False` | files with a C2PA manifest are refused unless `True` |
| `max_input_bytes` | 64 MiB | up to 1 GiB |

`mark_image_with_options(data, {...})` takes the same options with the
TypeScript (camelCase) names, which suits configuration files.

Errors are `TelltaleError` with a stable `code` such as `TRUNCATED`,
`MALFORMED`, `BAD_CRC`, `XMP_CONFLICT` or `C2PA_PRESENT`. The input is never
modified. Every byte outside the XMP segment is copied unchanged, except
for WebP the RIFF size and the `VP8X` header, and old JPEG ExtendedXMP
segments when the packet is replaced. See the main README.

## Limits

This is unsigned metadata. It is easy to remove or forge, and many platforms
strip it. It is not a watermark and not a C2PA manifest. The Commission's Code
of Practice on Transparency of AI-Generated Content (Measure 1.1) expects
signed metadata plus an imperceptible watermark. Use this as one layer.

## Development

```sh
python3 -m venv .venv
.venv/bin/python -m pip install mypy==2.4.0
.venv/bin/python -m mypy
PYTHONPATH=src .venv/bin/python -m unittest discover -s tests -t .
```

Licence: Apache-2.0. Copyright 2026 MB AFKzona Group. See LICENSE and NOTICE.
