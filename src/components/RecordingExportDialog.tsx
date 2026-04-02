'use client';

import { useEffect, useRef, useState } from 'react';

interface RecordingExportDialogProps {
  blob: Blob;
  durationSeconds: number;
  defaultName: string;
  onDownload: (name: string) => void;
  onCancel: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const btn = 'text-sm px-6 py-0.5 border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver active:border-t-neutral-500 active:border-l-neutral-500 active:border-r-white active:border-b-white disabled:opacity-50';

export default function RecordingExportDialog({
  blob,
  durationSeconds,
  defaultName,
  onDownload,
  onCancel,
}: RecordingExportDialogProps) {
  const [name, setName] = useState(defaultName);
  const blobUrl = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    blobUrl.current = URL.createObjectURL(blob);
    if (audioRef.current) audioRef.current.src = blobUrl.current;
    return () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, [blob]);

  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
      <div className='bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 w-72 font-sans text-black select-none'>

        {/* Title bar */}
        <div className='bg-blue-800 text-white flex items-center justify-between px-2 py-1'>
          <span className='font-bold text-sm'>Export Recording</span>
          <button
            className='w-4 h-4 bg-silver text-black text-[10px] font-bold flex items-center justify-center border border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 leading-none'
            onClick={onCancel}
          >✕</button>
        </div>

        <div className='px-4 pt-3 pb-4 flex flex-col gap-3 text-sm'>

          {/* Stats — Win95 "About" style: label then indented value */}
          <div>
            <p>Duration:</p>
            <p className='pl-4'>{formatDuration(durationSeconds)}</p>
          </div>
          <div>
            <p>File size:</p>
            <p className='pl-4'>{formatSize(blob.size)} ({ext})</p>
          </div>

          {/* Hairline separator */}
          <div className='border-t border-t-neutral-400 border-b border-b-white' />

          {/* Preview */}
          <div>
            <p className='mb-1'>Preview:</p>
            <audio
              ref={audioRef}
              controls
              className='w-full h-7'
              style={{ colorScheme: 'light' }}
            />
          </div>

          <div className='border-t border-t-neutral-400 border-b border-b-white' />

          {/* File name */}
          <div>
            <p className='mb-1'>File name:</p>
            <div className='flex items-center border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white'>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onDownload(name); }}
                className='flex-grow text-sm px-1.5 py-0.5 outline-none bg-transparent text-black'
                autoFocus
              />
              <span className='text-neutral-400 pr-1.5 text-sm'>.{ext}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className='flex justify-center gap-2 pt-1'>
            <button className={btn} onClick={onCancel}>Cancel</button>
            <button className={btn} onClick={() => onDownload(name)} disabled={!name.trim()}>
              Download
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
