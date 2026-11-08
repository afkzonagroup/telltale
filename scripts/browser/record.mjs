// Copyright 2026 MB AFKzona Group
// SPDX-License-Identifier: Apache-2.0

/** Records a wrapper callback in the page, for the browser check to read. */
export function record(type, detail) {
  (globalThis.__telltaleEvents ??= []).push({ type, detail });
}
