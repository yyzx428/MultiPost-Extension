import { useState, useEffect } from 'react';
import { Image, Checkbox, Link, Tooltip } from '@nextui-org/react';
import { AlertCircle } from 'lucide-react';

interface DouyinUser {
  nick_name: string;
  avatar_url: string;
}

interface SyncDouyinImageProps {
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncDouyinImage({ isSelected, isDisabled, onChange }: SyncDouyinImageProps) {
  const key = 'DouyinImage';
  const [douyinUser, setDouyinUser] = useState<DouyinUser | null>(null);

  useEffect(() => {
    async function fetchDouyinUserData() {
      try {
        // 注意：这里的 API 地址需要替换为实际的抖音 API
        const response = await fetch('https://creator.douyin.com/aweme/v1/creator/user/info');
        const data = await response.json();
        if (data.status_code === 0 && data.user_info) {
          setDouyinUser({
            nick_name: data.douyin_user_verify_info.nick_name,
            avatar_url: data.douyin_user_verify_info.avatar_url,
          });
        } else {
          throw new Error('未找到用户信息');
        }
      } catch (error) {
        console.error('获取抖音用户数据时出错:', error);
      }
    }

    fetchDouyinUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Tooltip
        content={isDisabled ? '请先上传图片才能同步到抖音' : ''}
        isDisabled={!isDisabled}>
        <div className="flex items-center space-x-1">
          <Checkbox
            isSelected={isSelected}
            isDisabled={isDisabled}
            onChange={(e) => onChange(key, e.target.checked)}>
            <div className="flex items-center space-x-1">
              <Image
                src="https://www.douyin.com/favicon.ico"
                alt="抖音"
                width={20}
                height={20}
              />
              <span className="text-sm font-medium">抖音 · 图文</span>
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
      {douyinUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={douyinUser.avatar_url}
            alt="抖音用户头像"
            width={20}
            height={20}
            className="rounded-none"
          />
          <Link
            href="https://www.douyin.com/user/"
            isExternal>
            <span className="text-sm text-default-500">{douyinUser.nick_name}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
