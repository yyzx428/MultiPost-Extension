import { useState, useEffect } from 'react';
import { Image, Checkbox, Link, Tooltip } from '@nextui-org/react';
import { AlertCircle } from 'lucide-react';

interface InstagramUser {
  username: string;
  avatar: string;
}

interface SyncInstagramImageProps {
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncInstagramImage({ isSelected, isDisabled, onChange }: SyncInstagramImageProps) {
  const key = 'InstagramImage';
  const [instagramUser, setInstagramUser] = useState<InstagramUser | null>(null);

  useEffect(() => {
    async function fetchInstagramUserData() {
      try {
        const response = await fetch("https://www.instagram.com/", {
          method: "GET",
          headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "zh,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,ja;q=0.6,zh-TW;q=0.5",
          },
        });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const canvas = doc.querySelector('canvas[width="108"][height="108"]');
        
        if (!canvas) {
          throw new Error('未找到用户信息');
        }
        
        const username = canvas.nextElementSibling?.getAttribute("href")?.replaceAll("/", "");
        const avatar = canvas.nextElementSibling?.querySelector("img")?.getAttribute("src") || 
          "https://picx.zhimg.com/80/v2-a3083aa8681376a2e80e19a6da535b0f_1440w.png";
        
        if (username) {
          setInstagramUser({
            username,
            avatar,
          });
        } else {
          throw new Error('未找到用户名');
        }
      } catch (error) {
        console.error('获取 Instagram 用户数据时出错:', error);
      }
    }

    fetchInstagramUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Tooltip
        content={isDisabled ? '请先上传图片才能同步到 Instagram' : ''}
        isDisabled={!isDisabled}>
        <div className="flex items-center space-x-1">
          <Checkbox
            isSelected={isSelected}
            isDisabled={isDisabled}
            onChange={(e) => onChange(key, e.target.checked)}>
            <div className="flex items-center space-x-1">
              {/* <Image
                src="https://www.instagram.com/favicon.ico"
                alt="Instagram"
                width={20}
                height={20}
                referrerPolicy="no-referrer"
              /> */}
              <span className="text-sm font-medium">Instagram · 图文</span>
            </div>
          </Checkbox>
          {isDisabled && (
            <AlertCircle
              className="text-warning"
              size={16}
            />
          )}
        </div>
      </Tooltip>
      {instagramUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={instagramUser.avatar}
            alt="Instagram 用户头像"
            width={20}
            height={20}
            className="rounded-full"
          />
          <Link
            href={`https://www.instagram.com/${instagramUser.username}/`}
            isExternal>
            <span className="text-sm text-default-500">{instagramUser.username}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
