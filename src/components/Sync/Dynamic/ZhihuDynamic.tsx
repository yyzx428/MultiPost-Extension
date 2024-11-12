import { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface ZhihuUser {
  name: string;
  avatar_url: string;
}

interface SyncZhihuDynamicProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncZhihuDynamic({ isSelected, onChange }: SyncZhihuDynamicProps) {
  const key = 'ZhihuDynamic';
  const [zhihuUser, setZhihuUser] = useState<ZhihuUser | null>(null);

  useEffect(() => {
    async function fetchZhihuUserData() {
      try {
        const response = await fetch('https://www.zhihu.com/api/v4/me', { credentials: 'include' });
        const userData = await response.json();
        if (userData.id) {
          setZhihuUser({
            name: userData.name || '未知用户',
            avatar_url: userData.avatar_url || 'https://www.zhihu.com/favicon.ico',
          });
        } else {
          throw new Error('未找到用户信息');
        }
      } catch (error) {
        console.error('获取知乎用户数据时出错:', error);
      }
    }

    fetchZhihuUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://www.zhihu.com/favicon.ico"
            alt="知乎"
            width={20}
            height={20}
          />
          <span className="text-sm font-medium">知乎 · 写想法</span>
        </div>
      </Checkbox>
      {zhihuUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={zhihuUser.avatar_url}
            alt="知乎用户头像"
            width={20}
            height={20}
            className="rounded-none"
          />
          <span>@</span>
          <Link
            href="https://www.zhihu.com/"
            isExternal>
            <span className="text-sm text-default-500">{zhihuUser.name}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
