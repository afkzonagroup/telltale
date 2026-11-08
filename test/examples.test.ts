/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Doctest-style checks: every example file appears verbatim in README.md,
 * and running it prints exactly the output written in its comments.
 */

import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VECTOR_ROOT } from './helpers/vectors.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const examples = readdirSync(join(root, 'examples')).filter((f) => /\.tsx?$/.test(f));

/** Expected output: comment lines directly after a line with console.log. */
function expectedOutput(code: string): string[] {
  const lines = code.split('\n');
  return lines.filter((line, i) => line.startsWith('// ') && (lines[i - 1] ?? '').includes('console.log(')).map((line) => line.slice(3));
}

describe('README examples', () => {
  it('has at least five examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(5);
  });

  for (const f of examples) {
    it(`README contains examples/${f} verbatim`, () => {
      expect(readme).toContain(readFileSync(join(root, 'examples', f), 'utf8'));
    });
  }

  const cwd = process.cwd();
  let dir = '';
  afterEach(() => {
    process.chdir(cwd);
    if (dir) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  for (const f of ['mark-image.ts', 'texts.ts', 'web-text.ts', 'disclosure-log.ts']) {
    it(`runs examples/${f} and prints the documented output`, async () => {
      dir = mkdtempSync(join(tmpdir(), 'telltale-example-'));
      copyFileSync(join(VECTOR_ROOT, 'fixtures', 'basic.png'), join(dir, 'generated.png'));
      process.chdir(dir);
      const printed: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        printed.push(args.map(String).join(' '));
      });
      // eslint-disable-next-line no-restricted-syntax -- loads a fixed example file from this repository
      await import(pathToFileURL(join(root, 'examples', f)).href);
      const code = readFileSync(join(root, 'examples', f), 'utf8');
      expect(printed).toEqual(expectedOutput(code));
      expect(printed.length).toBeGreaterThan(0);
    });
  }
});
