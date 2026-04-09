/**
 * P2.10: Карточка OpenGraph превью для URL в сообщении.
 */

import { memo, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { getOgPreview } from '@/api/client';

interface UrlPreviewCardProps {
  url: string;
}

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

// Простой regex для обнаружения URL в тексте
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export const UrlPreviewCard = memo(function UrlPreviewCard({ url }: UrlPreviewCardProps) {
  const [og, setOg] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOgPreview(url)
      .then((data) => {
        if (!cancelled && (data.title || data.image)) setOg(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading || !og) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-lg overflow-hidden no-underline"
      style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
    >
      {og.image && (
        <img
          src={og.image}
          alt={og.title || ''}
          className="w-full h-[140px] object-cover"
          loading="lazy"
        />
      )}
      <div className="px-3 py-2">
        {og.site_name && (
          <p className="text-[11px] text-blue-400 mb-0.5 flex items-center gap-1">
            <ExternalLink size={10} />
            {og.site_name}
          </p>
        )}
        {og.title && (
          <p className="text-[13px] font-medium text-white leading-tight line-clamp-2">
            {og.title}
          </p>
        )}
        {og.description && (
          <p className="text-[12px] text-white/50 mt-0.5 leading-tight line-clamp-2">
            {og.description}
          </p>
        )}
      </div>
    </a>
  );
});
