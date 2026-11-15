import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The default worker pools intermittently fail on this machine with
    // "Vitest failed to find the runner" (even for a one-line test); the VM pool is stable.
    pool: 'vmForks',
  },
})
