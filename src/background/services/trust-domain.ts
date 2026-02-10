import { Storage } from "@plasmohq/storage"
import { waitForRuntimeMessage } from "../messages/wait-for-runtime-message"

const storage = new Storage({ area: "local" })

function getSenderHostname(sender: chrome.runtime.MessageSender): string {
  const originLike = (sender as chrome.runtime.MessageSender & { origin?: string }).origin ?? sender.url ?? ""
  if (!originLike) return ""
  try {
    return new URL(originLike).hostname
  } catch {
    return ""
  }
}

type TrustDomainRequest =
  | { action: "MUTLIPOST_EXTENSION_GET_TRUSTED_DOMAINS" }
  | { action: "MUTLIPOST_EXTENSION_DELETE_TRUSTED_DOMAIN"; data: { domainId?: string } }
  | { action: "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN" }

export const handleTrustDomainMessage = async (request: unknown, sender: chrome.runtime.MessageSender) => {
  const req = request as Partial<TrustDomainRequest>

  if (req.action === "MUTLIPOST_EXTENSION_GET_TRUSTED_DOMAINS") {
    const trustedDomains = (await storage.get<Array<{ id: string; domain: string }>>("trustedDomains")) || []
    return { trustedDomains }
  }

  if (req.action === "MUTLIPOST_EXTENSION_DELETE_TRUSTED_DOMAIN") {
    const { domainId } = (req as Extract<TrustDomainRequest, { action: "MUTLIPOST_EXTENSION_DELETE_TRUSTED_DOMAIN" }>).data ?? {}
    if (!domainId) {
      return { success: false, message: "Missing domainId" }
    }

    const trustedDomains = (await storage.get<Array<{ id: string; domain: string }>>("trustedDomains")) || []
    const updatedDomains = trustedDomains.filter((item) => item.id !== domainId)
    await storage.set("trustedDomains", updatedDomains)
    return { success: true, trustedDomains: updatedDomains }
  }

  if (req.action === "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN") {
    const hostname = getSenderHostname(sender)
    if (!hostname) {
      return { trusted: false, status: "error" }
    }

    const trustedDomains = (await storage.get<Array<{ domain: string }>>("trustedDomains")) || []
    const isTrusted = trustedDomains.some(({ domain }) => {
      if (domain.startsWith("*.")) return hostname.endsWith(domain.slice(2))
      return hostname === domain
    })

    if (isTrusted) {
      return { trusted: true }
    }

    const params = { action: "MUTLIPOST_EXTENSION_REQUEST_TRUST_DOMAIN", origin: hostname }
    const encodedParams = btoa(JSON.stringify(params))

    const confirmPromise = waitForRuntimeMessage<{ trusted: boolean; status?: string; origin?: string }>(
      (message) => {
        const msg = message as { type?: string; origin?: string }
        return msg?.type === "MUTLIPOST_EXTENSION_TRUST_DOMAIN_CONFIRM" && msg?.origin === hostname
      },
      { timeoutMs: 60_000 },
    )

    // Open popup after listener is attached (avoids race in tests/fast confirmations).
    void chrome.windows.create({
      url: chrome.runtime.getURL(`tabs/trust-domain.html#${encodedParams}`),
      type: "popup",
      width: 800,
      height: 600
    })

    const confirm = await confirmPromise
    return { trusted: confirm.trusted, status: confirm.status }
  }

  return undefined
}

// Backward-compatible wrapper (kept to avoid touching unrelated callers).
export const trustDomainMessageHandler = async (
  request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => {
  const res = await handleTrustDomainMessage(request, sender)
  if (res !== undefined) sendResponse(res)
  return true
}
