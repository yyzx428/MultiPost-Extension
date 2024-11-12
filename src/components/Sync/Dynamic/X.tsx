import { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface XUser {
  screen_name: string;
  name: string;
  profile_image_url_https: string;
}

interface SyncXProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncX({ isSelected, onChange }: SyncXProps) {
  const key = 'XDynamic';
  const [xUser, setXUser] = useState<XUser | null>(null);

  useEffect(() => {
    async function fetchXUserData() {
      try {
        const response = await fetch('https://x.com/home');
        const text = await response.text();
        const scriptRegex =
          /<script type="text\/javascript" charset="utf-8" nonce="[^"]*">[\s\S]*?window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});[\s\S]*?<\/script>/;
        const match = text.match(scriptRegex);

        if (match && match[1]) {
          const initialState = JSON.parse(match[1]);
          const usersEntities = initialState?.entities?.users?.entities;
          if (usersEntities) {
            const firstUserId = Object.keys(usersEntities)[0];
            setXUser(usersEntities[firstUserId]);
          } else {
            throw new Error('未找到用户信息');
          }
        } else {
          throw new Error('未找到匹配的脚本内容');
        }
      } catch (error) {
        console.error('获取X用户数据时出错:', error);
      } finally {
      }
    }

    fetchXUserData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://abs.twimg.com/favicons/twitter.3.ico"
            alt="X"
            width={20}
            height={20}
            className="rounded-none"
          />
          <span className="text-sm font-medium">X</span>
        </div>
      </Checkbox>
      {xUser && (
        <div className="flex items-center space-x-1">
          <Image
            src={xUser.profile_image_url_https}
            alt="X用户头像"
            width={20}
            height={20}
          />
          <span>@</span>
          <Link
            href={`https://x.com/home`}
            isExternal>
            <span className="text-sm text-default-500">{xUser.name}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
