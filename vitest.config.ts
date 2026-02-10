import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Support tsconfig "paths": { "~*": ["./src/*"] } without extra deps.
    alias: [
      {
        find: /^~(.*)$/,
        replacement: `${path.resolve(__dirname, "src").replace(/\\/g, "/")}/$1`
      }
    ]
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"]
  }
})
