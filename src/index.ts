/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Telltale: building blocks for the transparency obligations in Article 50
 * of Regulation (EU) 2024/1689 (the AI Act).
 *
 * The root entry point is platform-neutral (browser, Node 22+, workers). Web
 * components live in `@afkzona/telltale/components`, Node-only helpers in
 * `@afkzona/telltale/node`.
 *
 * Not legal advice. Using this package does not by itself make anyone compliant.
 *
 * @packageDocumentation
 */

export * from './errors.js';
export * from './law.js';
export * from './texts/index.js';
export * from './marking/index.js';
export * from './text-marking/index.js';
export * from './log/index.js';
export { VERSION } from './version.js';
