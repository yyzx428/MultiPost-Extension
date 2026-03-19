export {}

import type { PlasmoCSConfig } from "plasmo"

import { handleBilibiliImageUpload } from "./helper/bilibili"
import { handleBlueskyImageUpload, handleBlueskyVideoUpload } from "./helper/bluesky"
import { installInputTracker } from "./helper/input-tracker"

export const config: PlasmoCSConfig = {
  matches: [
    "https://t.bilibili.com/*",
    "https://bsky.app/*",
    "https://www.v2ex.com/write*",
    "https://v2ex.com/write*"
  ],
  world: "MAIN",
  run_at: "document_start"
}

interface CodeMirrorElement extends HTMLDivElement {
  CodeMirror: {
    setValue: (content: string) => void
  }
}

installInputTracker()

function handleMessage(event: MessageEvent) {
  const data = event.data
  if (!data || typeof data !== "object") return

  if (data.type === "BILIBILI_DYNAMIC_UPLOAD_IMAGES") {
    void handleBilibiliImageUpload(event)
    return
  }

  if (data.type === "BLUESKY_VIDEO_UPLOAD") {
    void handleBlueskyVideoUpload(event)
    return
  }

  if (data.type === "BLUESKY_IMAGE_UPLOAD") {
    void handleBlueskyImageUpload(event)
    return
  }

  if (data.type === "V2EX_DYNAMIC_UPLOAD") {
    const editor = document.querySelector(".CodeMirror") as CodeMirrorElement | null
    if (editor) {
      editor.CodeMirror.setValue(data.content)
    }
  }
}

window.addEventListener("message", handleMessage)
