export {
  createChainActionConfig,
  executeChainAction as executeBaiduAgisoChainAction
} from "./baidu-agiso/chain-action"
export type { ChainActionConfig as BaiduAgisoChainActionConfig } from "./baidu-agiso/chain-action"

export { executeChainAction as executeBaiduRedChainAction } from "./baidu-red/red-chain-action"
export type { ChainActionConfig as BaiduRedChainActionConfig } from "./baidu-red/red-chain-action"

export { createDefaultShareConfig, executeBaiduSharePublishChain } from "./shared"

export interface ChainActionBase {
  name: string
  description: string
  execute: (config: unknown) => Promise<unknown>
}

export const chainActions: Record<string, ChainActionBase> = {
  "baidu-agiso": {
    name: "百度云分享 + Agiso 发布",
    description: "获取百度云分享链接并在 Agiso 平台发布商品",
    execute: async (config) => {
      const { executeChainAction } = await import("./baidu-agiso/chain-action")
      return executeChainAction(config as import("./baidu-agiso/chain-action").ChainActionConfig)
    }
  },
  "baidu-red": {
    name: "百度云分享 + 小红书千帆发布",
    description: "获取百度云分享链接并在小红书千帆平台发布商品",
    execute: async (config) => {
      const { executeChainAction } = await import("./baidu-red/red-chain-action")
      return executeChainAction(config as import("./baidu-red/red-chain-action").ChainActionConfig)
    }
  }
}

export function getAvailableChainActions(): ChainActionBase[] {
  return Object.values(chainActions)
}

export async function executeChainActionByName(actionName: string, config: unknown) {
  const action = chainActions[actionName]
  if (!action) {
    throw new Error(`Unknown chain action: ${actionName}`)
  }
  return action.execute(config)
}
