# Copyright 2026 MB AFKzona Group
# SPDX-License-Identifier: Apache-2.0
"""Error type shared by all modules. Codes match the TypeScript package."""

from __future__ import annotations


class TelltaleError(Exception):
    """The only exception raised for bad input. ``code`` is stable."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code

    def __repr__(self) -> str:
        return f"TelltaleError({self.code!r}, {str(self)!r})"
