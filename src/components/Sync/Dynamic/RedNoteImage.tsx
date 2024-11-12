import { useState, useEffect } from 'react';
import { Image, Checkbox, Link, Tooltip } from '@nextui-org/react';
import { AlertCircle } from 'lucide-react';

interface RedNoteUser {
  nickName: string;
  url: string;
}

interface SyncRedNoteImageProps {
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncRedNoteImage({ isSelected, isDisabled, onChange }: SyncRedNoteImageProps) {
  const key = 'RedNoteImage';
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
      <Tooltip
        content={isDisabled ? '请先上传图片才能同步到小红书' : ''}
        isDisabled={!isDisabled}>
        <div className="flex items-center space-x-1">
          <Checkbox
            isSelected={isSelected}
            isDisabled={isDisabled}
            onChange={(e) => onChange(key, e.target.checked)}>
            <div className="flex items-center space-x-1">
              <Image
                src="https://www.xiaohongshu.com/favicon.ico"
                alt="小红书 · 图文"
                width={20}
                height={20}
                className="rounded-none"
              />
              <span className="text-sm font-medium">小红书 · 图文</span>
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
