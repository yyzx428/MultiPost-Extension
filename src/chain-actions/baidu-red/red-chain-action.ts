import type { ShareConfig } from "../../file-ops/types"

import type { ShangPinData } from "~sync/common"

import { createDefaultShareConfig, executeBaiduSharePublishChain } from "../shared"

export interface ChainActionConfig {
  baiduShare: {
    paths: string[]
    shareConfig: ShareConfig
  }
  redProduct: ShangPinData
}

export async function executeChainAction(config: ChainActionConfig) {
  return executeBaiduSharePublishChain(config.baiduShare, {
    traceIdPrefix: "chain-action-red",
    stageName: "redPublish",
    buildSyncData: (shareResult) => ({
      platforms: [{ name: "SHANGPIN_REDNOTE" }],
      data: {
        ...config.redProduct,
        shareUrl: shareResult.shareUrl || "",
        shareText: shareResult.shareText || ""
      },
      isAutoPublish: true
    }),
    publishFailureMessage: "Red publish failed"
  })
}

export { createDefaultShareConfig }
