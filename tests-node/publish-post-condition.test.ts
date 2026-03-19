/* eslint-disable @typescript-eslint/no-require-imports */
import assert from "node:assert/strict"
import path from "node:path"

export type TestCase = { name: string; fn: () => Promise<void> }

function loadHelper() {
  const distRoot = path.resolve(__dirname, "..")
  return require(path.join(distRoot, "src", "sync", "publish-post-condition.js")) as typeof import("../src/sync/publish-post-condition")
}

export const tests: TestCase[] = [
  {
    name: "infer rednote creator post condition by url",
    fn: async () => {
      const { inferPublishPostCondition } = loadHelper()
      const result = inferPublishPostCondition({
        name: "VIDEO_REDNOTE",
        type: "VIDEO",
        accountKey: "rednote",
        injectUrl: "https://creator.xiaohongshu.com/publish/publish"
      })

      assert.ok(result)
      assert.equal(result?.timeoutErrorCode, "REDNOTE_NO_SUCCESS_SIGNAL")
      assert.ok(result?.success.selectors?.includes(".d-toast"))
      assert.ok(result?.failure?.urlIncludes?.includes("creator.xiaohongshu.com/login"))
      assert.equal(result?.failureErrorCode, "LOGIN_REQUIRED")
    }
  },
  {
    name: "infer agiso post condition by url",
    fn: async () => {
      const { inferPublishPostCondition } = loadHelper()
      const result = inferPublishPostCondition({
        name: "SHANGPIN_AGISO",
        type: "SHANGPIN",
        accountKey: "agiso",
        injectUrl: "https://aldsxhs.agiso.com/#/alds/goods"
      })

      assert.ok(result)
      assert.equal(result?.timeoutMessage, "No Agiso success signal detected before timeout")
      assert.ok(result?.success.selectors?.includes(".ant-message-notice-content"))
    }
  },
  {
    name: "detect rednote login failure by current url",
    fn: async () => {
      const { getPublishFailureForUrl } = loadHelper()
      const result = getPublishFailureForUrl(
        {
          name: "DYNAMIC_REDNOTE",
          injectUrl: "https://creator.xiaohongshu.com/publish/publish"
        },
        "https://creator.xiaohongshu.com/login?redirectReason=401"
      )

      assert.deepEqual(result, {
        errorCode: "LOGIN_REQUIRED",
        errorMessage: "Rednote login required"
      })
    }
  },
  {
    name: "infer login failure by current url without platform metadata",
    fn: async () => {
      const { getPublishFailureForUrl } = loadHelper()
      const result = getPublishFailureForUrl(undefined, "https://ark.xiaohongshu.com/login")

      assert.deepEqual(result, {
        errorCode: "LOGIN_REQUIRED",
        errorMessage: "Rednote commerce login required"
      })
    }
  },
  {
    name: "leave unsupported platform without inferred post condition",
    fn: async () => {
      const { inferPublishPostCondition } = loadHelper()
      const result = inferPublishPostCondition({
        name: "DYNAMIC_X",
        type: "DYNAMIC",
        accountKey: "x",
        injectUrl: "https://x.com/home"
      })

      assert.equal(result, undefined)
    }
  },
  {
    name: "preserve explicit platform post condition",
    fn: async () => {
      const { withPublishPostCondition } = loadHelper()
      const explicit = {
        timeoutMs: 1000,
        success: { texts: ["ok"] },
        timeoutErrorCode: "EXPLICIT_TIMEOUT",
        timeoutMessage: "explicit"
      }

      const result = withPublishPostCondition({
        type: "DYNAMIC",
        name: "CUSTOM",
        homeUrl: "https://example.com",
        platformName: "Custom",
        injectUrl: "https://creator.xiaohongshu.com/publish/publish",
        injectFunction: async () => true,
        accountKey: "rednote",
        publishPostCondition: explicit
      })

      assert.equal(result.publishPostCondition, explicit)
    }
  }
]
