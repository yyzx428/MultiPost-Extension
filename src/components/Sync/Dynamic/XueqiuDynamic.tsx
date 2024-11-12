import { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface XueqiuUser {
  screen_name: string;
  profile_image_url: string;
  photo_domain: string;
}

interface SyncXueqiuDynamicProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncXueqiuDynamic({ isSelected, onChange }: SyncXueqiuDynamicProps) {
  const key = 'XueqiuDynamic';
  const [xueqiuUser, setXueqiuUser] = useState<XueqiuUser | null>(null);

  useEffect(() => {
    async function fetchXueqiuUserData() {
      try {
        const response = await fetch('https://xueqiu.com/', { credentials: 'include' });
        const text = await response.text();
        const match = text.match(/window\.SNOWMAN_USER\s*=\s*({[^;]+})/);
        if (match) {
          const userDataString = match[1];
          const userData = JSON.parse(userDataString);
          if (userData.id) {
            setXueqiuUser({
              screen_name: userData.screen_name || '未知用户',
              profile_image_url: (userData.profile_image_url && userData.profile_image_url.split(',')[0]) || 'https://xueqiu.com/favicon.ico',
              photo_domain: userData.photo_domain || '//xavatar.imedao.com/',
            });
          } else {
            throw new Error('未找到用户信息');
          }
        } else {
          throw new Error('未找到SNOWMAN_USER数据');
        }
      } catch (error) {
        console.error('获取雪球用户数据时出错:', error);
      }
    }

    fetchXueqiuUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://xueqiu.com/favicon.ico"
            alt="雪球"
            width={20}
            height={20}
          />
          <span className="text-sm font-medium">雪球</span>
        </div>
      </Checkbox>
      {xueqiuUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={`https:${xueqiuUser.photo_domain}${xueqiuUser.profile_image_url}`}
            alt="雪球用户头像"
            width={20}
            height={20}
          />
          <span>@</span>
          <Link
            href="https://xueqiu.com/"
            isExternal>
            <span className="text-sm text-default-500">{xueqiuUser.screen_name}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
