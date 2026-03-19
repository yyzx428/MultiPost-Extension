import type { ShareConfig } from "../../file-ops/types"

import { createDefaultShareConfig, executeBaiduSharePublishChain } from "../shared"

export interface ChainActionConfig {
  baiduShare: {
    paths: string[]
    shareConfig: ShareConfig
  }
  agisoProduct: {
    title: string
    useInfo: string
  }
}

export async function executeChainAction(config: ChainActionConfig) {
  return executeBaiduSharePublishChain(config.baiduShare, {
    traceIdPrefix: "chain-action-agiso",
    stageName: "agisoPublish",
    buildSyncData: (shareResult) => ({
      platforms: [{ name: "SHANGPIN_AGISO" }],
      data: {
        title: config.agisoProduct.title,
        useInfo: config.agisoProduct.useInfo
          ? `${config.agisoProduct.useInfo}\n\n${shareResult.shareText}`
          : `${shareResult.shareText}`
      },
      isAutoPublish: true
    }),
    publishFailureMessage: "Agiso publish failed"
  })
}

export { createDefaultShareConfig }

export function createChainActionConfig(paths: string[], title: string, useInfo: string): ChainActionConfig {
  return {
    baiduShare: {
      paths,
      shareConfig: createDefaultShareConfig()
    },
    agisoProduct: {
      title,
      useInfo
    }
  }
}
