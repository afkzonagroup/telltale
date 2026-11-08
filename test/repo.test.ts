/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/**
 * Generated or tool-owned directories. They are skipped by name, before
 * descending, so a build, pack or Python install running at the same time
 * (creating and deleting files there) cannot make these tests fail.
 */
const GENERATED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-check', 'coverage', 'build', '.venv', '__pycache__', '.mypy_cache']);

/** Regular files under `dir` (relative to the repository), without generated directories. */
function walk(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = join(dir, d.name);
    if (d.isDirectory()) return GENERATED_DIRS.has(d.name) || d.name.endsWith('.egg-info') ? [] : walk(rel);
    return d.isFile() ? [rel] : [];
  });
}

interface Pkg {
  version: string;
  license: string;
  files: string[];
  engines: { node: string };
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
  exports: Record<string, unknown>;
}
const pkg = JSON.parse(read('package.json')) as Pkg;

describe('repository hygiene', () => {
  it('has no runtime dependencies and only exact dev versions', () => {
    expect(pkg.dependencies).toBeUndefined();
    for (const v of Object.values(pkg.devDependencies)) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has no install scripts and a files allow-list', () => {
    for (const s of ['preinstall', 'install', 'postinstall', 'prepare']) expect(pkg.scripts[s]).toBeUndefined();
    expect(pkg.files).toEqual(['dist', 'README.md', 'LICENSE', 'NOTICE', 'TRADEMARKS.md', 'SECURITY.md', 'CHANGELOG.md']);
    expect(pkg.license).toBe('Apache-2.0');
    expect(pkg.engines.node).toBe('>=22');
    expect(Object.keys(pkg.exports)).toContain('./components/auto');
  });

  it('keeps the Python package in sync', () => {
    expect(read('python/LICENSE')).toBe(read('LICENSE'));
    expect(read('python/NOTICE')).toBe(read('NOTICE'));
    expect(read('python/pyproject.toml')).toContain(`version = "${pkg.version}"`);
    expect(read('python/src/telltale/__init__.py')).toContain(`__version__ = "${pkg.version}"`);
  });

  it('puts the copyright header on every source file', () => {
    const files = [...walk('src'), ...walk('python/src')].filter((f) => /\.(ts|py)$/.test(f));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) expect(read(f), f).toContain('Copyright 2026 MB AFKzona Group');
  });

  it('uses no raw HTML sinks or eval in sources', () => {
    for (const f of walk('src')) {
      const code = read(f);
      expect(code, f).not.toMatch(/\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(|child_process/);
    }
  });

  it('runs CI only on pull requests and by hand, with pinned actions', () => {
    for (const f of ['.github/workflows/ci.yml', '.github/workflows/codeql.yml']) {
      const y = read(f);
      expect(y).not.toMatch(/^\s*(push|schedule):/m);
      expect(y).toMatch(/permissions:\s*\n\s*contents: read/);
      for (const m of y.matchAll(/uses:\s*(\S+)/g)) expect(m[1]).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('has the required repository documents', () => {
    for (const f of ['README.md', 'LICENSE', 'NOTICE', 'CLA.md', 'TRADEMARKS.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'CHANGELOG.md', 'REVIEW.md', '.editorconfig', '.npmrc', '.github/dependabot.yml']) {
      expect(read(f).length, f).toBeGreaterThan(20);
    }
    expect(read('.npmrc')).toContain('engine-strict=true');
    expect(read('LICENSE')).toContain('Apache License');
  });
});

describe('no hidden characters', () => {
  // Bidi controls, zero-width characters, line/paragraph separators and BOMs
  // can hide code ("Trojan Source"). Sources must use escapes instead.
  const HIDDEN = /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2069\uFEFF]/;
  it('finds none in any text file of the repository', () => {
    const text = /\.(ts|tsx|js|mjs|py|md|json|toml|yml|yaml|html|css|txt)$|^(LICENSE|NOTICE|\.gitignore|\.npmrc|\.editorconfig)$/;
    const topLevel = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name);
    const files = [...topLevel, ...['src', 'test', 'examples', 'scripts', 'python', '.github'].flatMap((d) => walk(d))].filter((f) =>
      text.test(f.split('/').pop() ?? ''),
    );
    expect(files.length).toBeGreaterThan(40);
    for (const f of files) expect(HIDDEN.test(read(f)), f).toBe(false);
    expect(HIDDEN.test(read('test-vectors/marking.json'))).toBe(false);
  });
});
