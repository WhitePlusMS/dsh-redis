import { defineConfig } from 'vitest/config'

// A single worker keeps the full suite usable under Windows commit pressure.
export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], maxWorkers: 1 } })
