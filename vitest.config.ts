import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  // README examples import the package by name; point that at the sources.
  resolve: {
    alias: [
      { find: /^@afkzona\/telltale$/, replacement: `${src}index.ts` },
      { find: /^@afkzona\/telltale\/components\/auto$/, replacement: `${src}components/auto.ts` },
      { find: /^@afkzona\/telltale\/(.+)$/, replacement: `${src}$1/index.ts` },
      // The Vue example uses a template string, which needs the build with the compiler.
      { find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js' },
    ],
  },
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    // Each test file runs in its own process: the README example test changes the working directory.
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/log/index.ts', 'src/node/index.ts', 'src/components/auto.ts', 'src/node/bin.ts'],
      reporter: ['text', 'html'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
