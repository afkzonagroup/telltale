/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Node.js-only helpers: an append-only log file writer and the CLI runner.
 *
 * @packageDocumentation
 */

export { DisclosureLogFile, type OpenLogFileOptions } from './log-file.js';
export { runCli, type CliIo } from './cli.js';
export { readRegularFile, writeFileAtomic } from './files.js';
