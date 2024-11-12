export function preprocessor(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  // 处理图片
  const images = doc.getElementsByTagName("img");
  for (const img of images) {
    if (!img.getAttribute("referrerpolicy")) {
      img.setAttribute("referrerpolicy", "no-referrer");
    }
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) {
      img.setAttribute("src", dataSrc);
      console.debug("设置src为data-src --> ", dataSrc);
    }
  }

  // 处理视频
  const videos = doc.getElementsByTagName("video");
  for (const video of videos) {
    const poster = video.getAttribute("poster");
    if (poster) {
      const img = doc.createElement("img");
      img.setAttribute("src", poster);
      video.parentNode?.replaceChild(img, video);
      console.debug("将视频替换为图片 -->", video, img);
    } else {
      video.parentNode?.removeChild(video);
    }
  }

  // 移除特定标签
  ["style", "script", "svg", "link"].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // 移除不可编辑的元素
  const nonEditableElements = doc.querySelectorAll('*[contenteditable="false"]');
  console.debug("不可编辑的元素 --> ", nonEditableElements);
  nonEditableElements.forEach(el => el.remove());

  // 移除空段落
  doc.querySelectorAll("p").forEach(p => {
    if (p.innerHTML.trim() === "") {
      p.remove();
    }
  });

  return doc.body.innerHTML;
}
