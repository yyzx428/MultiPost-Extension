export {};
import type { PlasmoCSConfig } from 'plasmo';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle',
};

// 全局变量
let shadowRoot: ShadowRoot | null = null;
let currentPopup: HTMLElement | null = null;
let currentSelection: Selection | null = null;
let currentContext = ''; // 新增：存储当前上下文

function initializeShadowRoot() {
  const container = document.createElement('div');
  container.id = '2someone-extension-container';
  document.body.appendChild(container);
  shadowRoot = container.attachShadow({ mode: 'open' });

  // 修改样式元素
  const style = document.createElement('style');
  style.textContent = `
    .popup {
      position: absolute;
      background-color: #f5f5f5; /* 灰白色背景 */
      border: 1px solid #e0e0e0;
      padding: 4px 12px;
      border-radius: 9999px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      max-width: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .popup.show {
      opacity: 1;
    }
    .popup-button {
      background-color: transparent;
      border: none;
      border-radius: 9999px;
      padding: 2px 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
      color: #333; /* 深灰色文字，接近黑色 */
    }
    .popup-button:hover {
      background-color: #e0e0e0;
    }
  `;
  shadowRoot.appendChild(style);
}

function createPopup() {
  if (!shadowRoot) return;

  // 移除现有的弹窗（如果有）
  removePopup();

  // 创建弹窗元素
  const popup = document.createElement('div');
  popup.className = 'popup';

  const buttons = [
    { text: '翻译', action: translate },
    { text: '解释', action: explain },
    { text: '收藏', action: collection },
  ];

  buttons.forEach((button) => {
    const btn = document.createElement('button');
    btn.className = 'popup-button';
    btn.textContent = button.text;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.action();
    });
    popup.appendChild(btn);
  });

  // 将弹窗添加到 shadow root
  shadowRoot.appendChild(popup);

  // 保存当前弹窗和选择
  currentPopup = popup;
  currentSelection = window.getSelection();

  updatePopupPosition();
}

function updatePopupPosition() {
  if (!currentPopup || !currentSelection || !shadowRoot) return;

  const range = currentSelection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // 计算弹窗的尺寸
  const popupRect = currentPopup.getBoundingClientRect();

  // 设置与文本的垂直距离
  const verticalGap = 10;

  // 获取视口尺寸
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 计算弹窗的初始位置
  let left = rect.left + rect.width / 2 - popupRect.width / 2 + window.scrollX;
  let top = rect.bottom + verticalGap + window.scrollY;

  // 检查并调整水平位置
  if (left < window.scrollX) {
    left = window.scrollX;
  } else if (left + popupRect.width > window.scrollX + viewportWidth) {
    left = window.scrollX + viewportWidth - popupRect.width;
  }

  // 检查并调整垂直位置
  if (top + popupRect.height > window.scrollY + viewportHeight) {
    // 如果下方放不下，尝试放在选中文本上方
    top = rect.top - verticalGap - popupRect.height + window.scrollY;

    // 如果上方也放不下，就放在视口底部
    if (top < window.scrollY) {
      top = window.scrollY + viewportHeight - popupRect.height;
    }
  }

  // 设置弹窗位置
  currentPopup.style.left = `${left}px`;
  currentPopup.style.top = `${top}px`;

  // 确保弹窗可见
  currentPopup.classList.add('show');
}

function handleSelection() {
  const selectedText = window.getSelection()?.toString().trim();
  if (selectedText && (!currentPopup || selectedText !== currentSelection?.toString().trim())) {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();

    if (rect && selection) {
      currentContext = getContext(selection); // 更新当前上下文
      createPopup();
    }
  }
}

function removePopup() {
  if (currentPopup && shadowRoot) {
    currentPopup.classList.remove('show');
    shadowRoot.removeChild(currentPopup);
    currentPopup = null;
    currentSelection = null;
    currentContext = '';
  }
}

// 初始化 shadow root
initializeShadowRoot();

// 添加事件监听器
document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', handleSelection);
document.addEventListener('selectionchange', () => {
  const selectedText = window.getSelection()?.toString().trim();
  if (!selectedText) {
    removePopup();
  }
});

// 添加滚动事件监听器
window.addEventListener('scroll', () => {
  if (currentPopup) {
    updatePopupPosition();
  }
});

// 添加新的功能函数
function translate() {
  if (!currentSelection) return;
  const text = currentSelection.toString().trim();
  console.log('翻译:', text);
  console.log('上下文:', currentContext);
  // 实现翻译逻辑
}

function explain() {
  if (!currentSelection) return;
  const text = currentSelection.toString().trim();
  console.log('解释:', text);
  console.log('上下文:', currentContext);
  // 实现解释逻辑
}

function collection() {
  if (!currentSelection) return;
  const text = currentSelection.toString().trim();

  const collectionData = {
    type: 'text',
    content: text,
    context: currentContext,
    source: window.location.href,
    sourceTitle: document.title, // 新增: 获取页面标题
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
  // 实现收藏逻辑
  chrome.runtime
    .sendMessage({
      type: 'MUTLIPOST_EXTENSION_REQUEST_OPEN_SIDEPANEL_COLLECTION',
    })
    .then(() => {
      chrome.runtime.sendMessage({
        type: 'MUTLIPOST_EXTENSION_REQUEST_ADD_ITEM_TO_CURRENT_COLLECTION',
        item: collectionData,
      });
    });
}

// 添加新的事件监听器
document.addEventListener('mousedown', (e) => {
  if (currentPopup && !currentPopup.contains(e.target as Node) && !window.getSelection()?.toString().trim()) {
    removePopup();
  }
});

// 添加这个事件监听器来防止弹窗内的点击事件影响选择
shadowRoot?.addEventListener('mousedown', (e) => {
  if (currentPopup && currentPopup.contains(e.target as Node)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removePopup();
  }
});

function getContext(selection: Selection, contextLength: number = 100): string {
  const range = selection.getRangeAt(0);
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;

  // 获取前文
  let beforeContext = '';
  let node = startContainer;
  let offset = range.startOffset;
  while (beforeContext.length < contextLength && node) {
    if (node.nodeType === Node.TEXT_NODE) {
      beforeContext = (node.textContent || '').slice(Math.max(0, offset - contextLength), offset) + beforeContext;
    }
    if (beforeContext.length < contextLength) {
      const previousNode = node.previousSibling || (node.parentNode as Node).previousSibling;
      node = previousNode;
      offset = node?.textContent?.length || 0;
    } else {
      break;
    }
  }

  // 获取选中的文本
  const selectedText = range.toString();

  // 获取后文
  let afterContext = '';
  node = endContainer;
  offset = range.endOffset;
  while (afterContext.length < contextLength && node) {
    if (node.nodeType === Node.TEXT_NODE) {
      afterContext += (node.textContent || '').slice(offset, offset + contextLength);
    }
    if (afterContext.length < contextLength) {
      const nextNode = node.nextSibling || (node.parentNode as Node).nextSibling;
      node = nextNode;
      offset = 0;
    } else {
      break;
    }
  }

  return beforeContext.trim() + selectedText + afterContext.trim();
}
