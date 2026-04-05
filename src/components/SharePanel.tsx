'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SharePanelProps {
  shareUrl: string | null; // null = still generating
  onClose: () => void;
}

export default function SharePanel({ shareUrl, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='absolute bottom-full right-0 mb-1 z-50 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 w-64 font-sans text-black select-none shadow-md'>
      {/* Title bar */}
      <div className='bg-blue-800 text-white flex items-center justify-between px-2 py-0.5'>
        <span className='font-bold text-xs'>Share Soundscape</span>
        <button
          className='w-4 h-4 bg-silver text-black text-[10px] font-bold flex items-center justify-center border border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 leading-none'
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className='px-3 py-2 flex flex-col gap-2 text-xs'>
        <button
          className='w-full flex items-center justify-between px-2 py-2 border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver hover:bg-neutral-200 active:border-t-neutral-500 active:border-l-neutral-500 active:border-r-white active:border-b-white text-left disabled:opacity-60 disabled:cursor-wait'
          onClick={handleCopy}
          disabled={!shareUrl}
        >
          <div className='overflow-hidden mr-2'>
            <p className='text-neutral-700 text-[10px] leading-none mb-1'>
              Share Link
            </p>
            {shareUrl ? (
              <p className='font-mono text-[10px] truncate text-neutral-500 leading-none'>
                {shareUrl.replace(/^https?:\/\//, '')}
              </p>
            ) : (
              <p className='text-[10px] text-neutral-400 leading-none italic'>
                Generating link…
              </p>
            )}
          </div>
          {copied ? (
            <Check size={14} className='text-green-700 shrink-0' />
          ) : (
            <Copy size={14} className='text-neutral-500 shrink-0' />
          )}
        </button>

        <p className='text-neutral-700 leading-snug'>
          Share this link and anyone can recreate the exact same soundscape on
          their device.
        </p>
      </div>
    </div>
  );
}
