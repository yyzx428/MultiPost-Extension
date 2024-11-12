import { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface BilibiliUser {
  uname: string;
  face: string;
}

interface SyncBilibiliDynamicProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncBilibiliDynamic({ isSelected, onChange }: SyncBilibiliDynamicProps) {
  const key = 'BilibiliDynamic';
  const [bilibiliUser, setBilibiliUser] = useState<BilibiliUser | null>(null);

  useEffect(() => {
    async function fetchBilibiliUserData() {
      try {
        const response = await fetch('https://api.bilibili.com/x/web-interface/nav');
        const data = await response.json();
        if (data.code === 0 && data.data) {
          setBilibiliUser({
            uname: data.data.uname,
            face: data.data.face,
          });
        } else {
          throw new Error('未找到用户信息');
        }
      } catch (error) {
        console.error('获取哔哩哔哩用户数据时出错:', error);
      }
    }

    fetchBilibiliUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://www.bilibili.com/favicon.ico"
            alt="哔哩哔哩"
            width={20}
            height={20}
            className="rounded-none"
          />
          <span className="text-sm font-medium">哔哩哔哩</span>
        </div>
      </Checkbox>
      {bilibiliUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={bilibiliUser.face}
            alt="哔哩哔哩用户头像"
            width={20}
            height={20}
          />
          <span>@</span>
          <Link
            href="https://t.bilibili.com/"
            isExternal>
            <span className="text-sm text-default-500">{bilibiliUser.uname}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
