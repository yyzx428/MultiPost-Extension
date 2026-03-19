import type { FileData } from "~sync/common"

const FETCH_RETRY_DELAYS = [1000, 2000, 4000]

export type AssetInlineMode = "always" | "unsafe-only" | "never"

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(url: string) {
  let lastError: unknown
  for (let attempt = 0; attempt <= FETCH_RETRY_DELAYS.length; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`)
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < FETCH_RETRY_DELAYS.length) {
        await sleep(FETCH_RETRY_DELAYS[attempt])
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error("READ_BLOB_FAILED"))
    reader.readAsDataURL(blob)
  })
}

export function shouldInlineAsset(url: string, inlineMode: AssetInlineMode) {
  if (inlineMode === "always") return true
  if (inlineMode === "never") return false
  return /^http:\/\//i.test(url)
}

export async function prepareFileStrict(
  file: FileData,
  options: { inlineMode?: AssetInlineMode } = {},
): Promise<FileData> {
  const inlineMode = options.inlineMode || "never"
  const response = await fetchWithRetry(file.url)
  const blob = await response.blob()
  const baseFile: FileData = {
    ...file,
    type: file.type || blob.type,
    size: file.size || blob.size
  }

  if (!shouldInlineAsset(file.url, inlineMode)) {
    return baseFile
  }

  const contentDataUrl = await blobToDataUrl(blob)
  return {
    ...baseFile,
    url: contentDataUrl,
    contentDataUrl
  }
}

export async function prepareFilesStrict(
  files: FileData[],
  options: { inlineMode?: AssetInlineMode } = {},
) {
  return await Promise.all(files.map((file) => prepareFileStrict(file, options)))
}
