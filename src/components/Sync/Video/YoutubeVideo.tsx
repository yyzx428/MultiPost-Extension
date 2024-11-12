import React, { useState, useEffect } from 'react';
import { Image, Checkbox, Link } from '@nextui-org/react';

interface YouTubeChannel {
  channelId: string;
  title: string;
  thumbnailUrl: string;
}

interface SyncYouTubeVideoProps {
  isSelected: boolean;
  onChange: (key: string, isSelected: boolean) => void;
}

export default function SyncYouTubeVideo({ isSelected, onChange }: SyncYouTubeVideoProps) {
  const key = 'YoutubeVideo';
  const [youtubeChannel, setYoutubeChannel] = useState<YouTubeChannel | null>(null);

  useEffect(() => {
    async function fetchYouTubeChannelData() {
      try {
        const response = await fetch('https://studio.youtube.com/', { credentials: 'include' });
        const text = await response.text();
        const match = text.match(/window\.chunkedPrefetchResolvers\['id-0'\]\.resolve\(({[^;]+})\)/);
        if (match) {
          const channelDataString = match[1];
          const channelData = JSON.parse(channelDataString);
          if (channelData.channelId) {
            setYoutubeChannel({
              channelId: channelData.channelId,
              title: channelData.title || '未知频道',
              thumbnailUrl: channelData.thumbnailDetails?.thumbnails?.[0]?.url || 'https://www.youtube.com/favicon.ico',
            });
          } else {
            throw new Error('未找到频道信息');
          }
        } else {
          throw new Error('未找到chunkedPrefetchResolvers数据');
        }
      } catch (error) {
        console.error('获取YouTube频道数据时出错:', error);
      }
    }

    fetchYouTubeChannelData();
  }, []);

  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        isSelected={isSelected}
        onChange={(e) => onChange(key, e.target.checked)}>
        <div className="flex items-center space-x-1">
          <Image
            src="https://www.youtube.com/favicon.ico"
            alt="YouTube"
            width={20}
            height={20}
          />
          <span className="text-sm font-medium">YouTube</span>
        </div>
      </Checkbox>
      {youtubeChannel && (
        <div className="flex items-center space-x-1">
          <Image
            src={youtubeChannel.thumbnailUrl}
            alt="YouTube频道头像"
            width={20}
            height={20}
          />
          <span>@</span>
          <Link
            href={`https://www.youtube.com/channel/${youtubeChannel.channelId}`}
            isExternal>
            <span className="text-sm text-default-500">{youtubeChannel.title}</span>
          </Link>
        </div>
      )}
    </div>
  );
}