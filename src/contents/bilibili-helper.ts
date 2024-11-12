/* eslint-disable prefer-const */

export {};
import type { PlasmoCSConfig } from 'plasmo';

export const config: PlasmoCSConfig = {
  matches: ['https://t.bilibili.com/*'],
  world: 'MAIN',
  run_at: 'document_start',
};

let originalCreateElement = document.createElement.bind(document);
let createdInputs: HTMLInputElement[] = [];

document.createElement = function (tagName, options) {
  let element = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === 'input') {
    createdInputs.push(element);
  }
  return element;
};

interface UploadMessage {
  type: string;
  files: File[];
}

export function waitForElement(selector: string, timeout = 5000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

async function handleImageUpload(event: MessageEvent) {
  const { data } = event as { data: UploadMessage };
  if (data.type !== 'BILIBILI_DYNAMIC_UPLOAD_IMAGES') return;

  window.removeEventListener('message', handleImageUpload);

  const files = data.files;

  await waitForElement('.bili-dyn-publishing__image-upload');

  const uploadInput = createdInputs.find((input) => input.type === 'file' && input.name === 'upload');
  if (!uploadInput) {
    return;
  }


  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  uploadInput.files = dataTransfer.files;

  const addButton = document.querySelector('.bili-pics-uploader__add');

  uploadInput.disabled = true;
  addButton?.dispatchEvent(new Event('click', { bubbles: true }));

  await new Promise((resolve) => setTimeout(resolve, 1000));

  uploadInput.disabled = false;
  uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
}

window.addEventListener('message', handleImageUpload);
