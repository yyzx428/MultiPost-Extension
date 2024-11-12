import { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';
import { Video } from 'lucide-react';
import React from 'react';

interface DouyinUser {
  nick_name: string;
  avatar_url: string;
}

interface SyncDouyinVideoProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncDouyinVideo({ isSelected, onChange }: SyncDouyinVideoProps) {
  const key = 'DouyinVideo';
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
      <div className="flex items-center space-x-1">
        <Checkbox
          isSelected={isSelected}
          onChange={(e) => onChange(key, e.target.checked)}>
          <div className="flex items-center space-x-1">
            <Image
              src="https://www.douyin.com/favicon.ico"
              alt="抖音"
              width={20}
              height={20}
            />
            <span className="text-sm font-medium">抖音</span>
          </div>
        </Checkbox>
      </div>
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
          <Video size={16} className="text-default-500" />
        </div>
      )}
    </div>
  );
}