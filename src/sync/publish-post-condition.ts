type PublishSignalMatcher = {
  selectors?: string[]
  texts?: string[]
  urlIncludes?: string[]
}

export type PublishPostCondition = {
  timeoutMs?: number
  success: PublishSignalMatcher
  failure?: PublishSignalMatcher
  failureErrorCode?: string
  failureMessage?: string
  timeoutErrorCode?: string
  timeoutMessage?: string
}

type PlatformInfoLike = {
  injectUrl: string
  publishPostCondition?: PublishPostCondition
  accountKey?: string
  type?: string
  name?: string
}

type PlatformInfoLookup = Partial<PlatformInfoLike> | null | undefined

type PostConditionConfig = {
  timeoutMs: number
  selectors: string[]
  successTexts: string[]
  failureTexts: string[]
  failureUrlIncludes?: string[]
  timeoutErrorCode: string
  timeoutMessage: string
  failureErrorCode?: string
  failureMessage?: string
}

const BASE_TOAST_SELECTORS = [
  "[role='alert']",
  "[class*='toast']",
  "[class*='message']",
  "[class*='notification']"
]

const ANT_TOAST_SELECTORS = [...BASE_TOAST_SELECTORS, ".ant-message-notice-content", ".ant-notification-notice"]
const SEMI_TOAST_SELECTORS = [...BASE_TOAST_SELECTORS, ".semi-toast", ".semi-notification", "[class*='semi-toast']"]
const XHS_TOAST_SELECTORS = [...BASE_TOAST_SELECTORS, ".d-toast", ".css-toast-container"]

function createPostCondition(config: PostConditionConfig): PublishPostCondition {
  return {
    timeoutMs: config.timeoutMs,
    success: {
      selectors: config.selectors,
      texts: config.successTexts
    },
    failure: {
      selectors: config.selectors,
      texts: config.failureTexts,
      urlIncludes: config.failureUrlIncludes
    },
    failureErrorCode: config.failureErrorCode || "PLATFORM_FAILURE_SIGNAL",
    failureMessage: config.failureMessage || "Detected publish failure signal",
    timeoutErrorCode: config.timeoutErrorCode,
    timeoutMessage: config.timeoutMessage
  }
}

function inferByUrl(url: string): PublishPostCondition | undefined {
  if (url.includes("creator.xiaohongshu.com")) {
    return createPostCondition({
      timeoutMs: 60000,
      selectors: XHS_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u53d1\u5e03\u7b14\u8bb0\u6210\u529f", "\u5b9a\u65f6\u53d1\u5e03\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      failureUrlIncludes: ["creator.xiaohongshu.com/login"],
      failureErrorCode: "LOGIN_REQUIRED",
      failureMessage: "Rednote login required",
      timeoutErrorCode: "REDNOTE_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Rednote success signal detected before timeout"
    })
  }

  if (url.includes("ark.xiaohongshu.com")) {
    return createPostCondition({
      timeoutMs: 60000,
      selectors: XHS_TOAST_SELECTORS,
      successTexts: ["\u63d0\u4ea4\u6210\u529f", "\u53d1\u5e03\u6210\u529f", "\u4fdd\u5b58\u6210\u529f", "\u521b\u5efa\u6210\u529f"],
      failureTexts: ["\u63d0\u4ea4\u5931\u8d25", "\u53d1\u5e03\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u521b\u5efa\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      failureUrlIncludes: ["ark.xiaohongshu.com/login"],
      failureErrorCode: "LOGIN_REQUIRED",
      failureMessage: "Rednote commerce login required",
      timeoutErrorCode: "REDNOTE_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Rednote commerce success signal detected before timeout"
    })
  }

  if (url.includes("aldsxhs.agiso.com")) {
    return createPostCondition({
      timeoutMs: 30000,
      selectors: ANT_TOAST_SELECTORS,
      successTexts: ["\u6210\u529f", "\u5df2\u4fdd\u5b58", "\u5df2\u63d0\u4ea4"],
      failureTexts: ["\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Agiso success signal detected before timeout"
    })
  }

  if (url.includes("creator.douyin.com")) {
    return createPostCondition({
      timeoutMs: 45000,
      selectors: SEMI_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Douyin success signal detected before timeout"
    })
  }

  if (url.includes("channels.weixin.qq.com")) {
    return createPostCondition({
      timeoutMs: 45000,
      selectors: ANT_TOAST_SELECTORS,
      successTexts: ["\u53d1\u8868\u6210\u529f", "\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u8868\u5931\u8d25", "\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Weixin Channel success signal detected before timeout"
    })
  }

  if (url.includes("baijiahao.baidu.com")) {
    return createPostCondition({
      timeoutMs: 45000,
      selectors: BASE_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f", "\u53d1\u8868\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Baijiahao success signal detected before timeout"
    })
  }

  if (url.includes("mp.toutiao.com")) {
    return createPostCondition({
      timeoutMs: 45000,
      selectors: ANT_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Toutiao success signal detected before timeout"
    })
  }

  if (url.includes("mp.eastmoney.com")) {
    return createPostCondition({
      timeoutMs: 45000,
      selectors: ANT_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Eastmoney success signal detected before timeout"
    })
  }

  if (url.includes("weibo.com")) {
    return createPostCondition({
      timeoutMs: 30000,
      selectors: BASE_TOAST_SELECTORS,
      successTexts: ["\u53d1\u5e03\u6210\u529f", "\u63d0\u4ea4\u6210\u529f", "\u4fdd\u5b58\u6210\u529f"],
      failureTexts: ["\u53d1\u5e03\u5931\u8d25", "\u63d0\u4ea4\u5931\u8d25", "\u4fdd\u5b58\u5931\u8d25", "\u9519\u8bef", "\u5f02\u5e38"],
      timeoutErrorCode: "PLATFORM_NO_SUCCESS_SIGNAL",
      timeoutMessage: "No Weibo success signal detected before timeout"
    })
  }

  return undefined
}

export function inferPublishPostCondition(
  platformInfo: Pick<PlatformInfoLike, "injectUrl" | "accountKey" | "type" | "name">,
): PublishPostCondition | undefined {
  return inferByUrl(platformInfo.injectUrl || "")
}

export function resolvePublishPostCondition(
  platformInfo?: PlatformInfoLookup,
  currentUrl?: string,
): PublishPostCondition | undefined {
  if (platformInfo?.publishPostCondition) return platformInfo.publishPostCondition
  if (platformInfo?.injectUrl) {
    const inferred = inferPublishPostCondition(platformInfo as Pick<PlatformInfoLike, "injectUrl" | "accountKey" | "type" | "name">)
    if (inferred) return inferred
  }
  if (currentUrl) return inferByUrl(currentUrl)
  return undefined
}

export function getPublishFailureForUrl(
  platformInfo?: PlatformInfoLookup,
  currentUrl?: string,
): { errorCode: string; errorMessage: string } | undefined {
  if (!currentUrl) return undefined

  const condition = resolvePublishPostCondition(platformInfo, currentUrl)
  const urlIncludes = condition?.failure?.urlIncludes
  if (!urlIncludes?.length) return undefined

  if (!urlIncludes.some((part) => currentUrl.includes(part))) {
    return undefined
  }

  return {
    errorCode: condition.failureErrorCode || "PLATFORM_FAILURE_SIGNAL",
    errorMessage: condition.failureMessage || "Detected publish failure signal"
  }
}

export function withPublishPostCondition<T extends PlatformInfoLike>(platformInfo: T): T {
  if (platformInfo.publishPostCondition) return platformInfo

  const inferred = inferPublishPostCondition(platformInfo)
  if (!inferred) return platformInfo

  return {
    ...platformInfo,
    publishPostCondition: inferred
  }
}

export function withPublishPostConditions<T extends PlatformInfoLike>(platformInfos: T[]): T[] {
  return platformInfos.map((platformInfo) => withPublishPostCondition(platformInfo))
}
