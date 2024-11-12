import { useState, useEffect } from 'react';
import { Checkbox, Image, Link } from '@nextui-org/react';

interface WeiboUser {
  screen_name: string;
}

interface SyncWeiboDynamicProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseConfig(configStr: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};
  const lines = configStr.split('\n');
  for (const line of lines) {
    const match = line.match(/\$CONFIG\['(\w+)'\]\s*=\s*(.+);/);
    if (match) {
      const [, key, value] = match;
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return result;
}

export default function SyncWeiboDynamic({ isSelected, onChange }: SyncWeiboDynamicProps) {
  const key = 'WeiboDynamic';
  const [weiboUser, setWeiboUser] = useState<WeiboUser | null>(null);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeiboUserData() {
      try {
        const response = await fetch('https://card.weibo.com/article/v3/editor');
        if (!response.ok) {
          throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        const html = await response.text();

        const configMatch = html.match(/\$CONFIG\s*=\s*({[\s\S]+?});/);
        if (configMatch) {
          const configStr = configMatch[1];
          const config = parseConfig(configStr);

          if (config.nick) {
            setWeiboUser({ screen_name: config.nick });
          } else {
            throw new Error('未找到用户信息');
          }
        } else {
          throw new Error('无法找到 $CONFIG 对象');
        }
      } catch (error) {
        console.error('获取微博用户数据时出错:', error);
        // setError(error instanceof Error ? error.message : '未知错误');
      }
    }

    fetchWeiboUserData();
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}
        className="inline-flex items-center">
        <div className="flex items-center space-x-2">
          <Image
            src="https://weibo.com/favicon.ico"
            alt="微博"
            width={20}
            height={20}
            className="rounded-none"
          />
          <span className="text-sm font-medium">微博</span>
        </div>
      </Checkbox>
      {weiboUser && (
        <div className="flex items-center space-x-1">
          <span>@</span>
          <Link
            href="https://weibo.com/"
            isExternal
            className="text-sm transition-colors text-default-500 hover:text-default-700">
            {weiboUser.screen_name}
          </Link>
        </div>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
