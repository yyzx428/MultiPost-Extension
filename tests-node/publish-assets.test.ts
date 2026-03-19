/* eslint-disable @typescript-eslint/no-require-imports */
import assert from "node:assert/strict"
import path from "node:path"

export type TestCase = { name: string; fn: () => Promise<void> }

function loadHelper() {
  const distRoot = path.resolve(__dirname, "..")
  return require(path.join(distRoot, "src", "tabs", "publish-assets.js")) as typeof import("../src/tabs/publish-assets")
}

export const tests: TestCase[] = [
  {
    name: "inline all assets when mode is always",
    fn: async () => {
      const { shouldInlineAsset } = loadHelper()
      assert.equal(shouldInlineAsset("https://example.com/image.png", "always"), true)
      assert.equal(shouldInlineAsset("http://example.com/image.png", "always"), true)
    }
  },
  {
    name: "inline only insecure assets when mode is unsafe-only",
    fn: async () => {
      const { shouldInlineAsset } = loadHelper()
      assert.equal(shouldInlineAsset("http://example.com/video.mp4", "unsafe-only"), true)
      assert.equal(shouldInlineAsset("https://example.com/video.mp4", "unsafe-only"), false)
    }
  },
  {
    name: "keep remote asset when mode is never",
    fn: async () => {
      const { shouldInlineAsset } = loadHelper()
      assert.equal(shouldInlineAsset("http://example.com/file.bin", "never"), false)
      assert.equal(shouldInlineAsset("https://example.com/file.bin", "never"), false)
    }
  }
]
