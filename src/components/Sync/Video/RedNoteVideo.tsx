import React, { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface RedNoteUser {
  nickName: string;
  url: string;
}

interface SyncRedNoteVideoProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncRedNoteVideo({ isSelected, onChange }: SyncRedNoteVideoProps) {
  const key = 'RedNoteVideo';
  const [redNoteUser, setRedNoteUser] = useState<RedNoteUser | null>(null);

  useEffect(() => {
    async function fetchRedNoteUserData() {
      try {
        const response = await fetch('https://creator.xiaohongshu.com/api/galaxy/user/my-info');
        const data = await response.json();
        if (data.success && data.data.userDetail) {
          setRedNoteUser({
            nickName: data.data.userDetail.nickName,
            url: data.data.userDetail.url,
          });
        } else {
          throw new Error('未找到用户信息');
        }
      } catch (error) {
        console.error('获取小红书用户数据时出错:', error);
      }
    }

    fetchRedNoteUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://www.xiaohongshu.com/favicon.ico"
            alt="小红书"
            width={20}
            height={20}
            className="rounded-none"
          />
          <span className="text-sm font-medium">小红书</span>
        </div>
      </Checkbox>
      {redNoteUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={redNoteUser.url}
            alt="小红书用户头像"
            width={20}
            height={20}
          />
          <Link
            href="https://www.xiaohongshu.com/user/profile/"
            isExternal>
            <span className="text-sm text-default-500">{redNoteUser.nickName}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
