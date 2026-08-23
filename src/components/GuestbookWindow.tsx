'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  addGuestbookEntry,
  formatGuestbookTimestamp,
  listGuestbookEntries,
  type GuestbookEntry,
} from '@/lib/guestbook';

interface GuestbookWindowProps {
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

const WELCOME: GuestbookEntry = {
  id: 'welcome',
  name: 'Concrete95 System Msg',
  message:
    'Welcome to the guestbook! Sign your name and leave a message — it will show up here like an old-school AIM chat.',
  createdAt: '1970-01-01T00:00:00.000Z',
};

const INPUT_CLASS =
  'w-full text-xs border-2 border-t-neutral-600 border-l-neutral-600 border-r-white border-b-white px-1.5 py-1.5 outline-none bg-white text-black placeholder:text-neutral-500';

const INSET_PANEL =
  'border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white bg-white';

function linkify(text: string): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-800 underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export default function GuestbookWindow({
  position,
  zIndex,
  onClose,
  onMouseDown,
  onTouchStart,
}: GuestbookWindowProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [entries, setEntries] = useState<GuestbookEntry[]>([WELCOME]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await listGuestbookEntries();
        if (cancelled) return;
        setEntries(remote.length > 0 ? remote : [WELCOME]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  const handleSend = async () => {
    if (sending || !message.trim()) return;
    setSending(true);
    try {
      const entry = await addGuestbookEntry(name, message);
      setEntries((prev) => {
        const withoutWelcome =
          prev.length === 1 && prev[0].id === 'welcome'
            ? []
            : prev.filter((e) => e.id !== 'welcome');
        return [...withoutWelcome, entry];
      });
      setMessage('');
      toast({ title: 'Message sent!', duration: 2000 });
    } catch (err) {
      toast({
        title: 'Could not send message',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const windowStyle = isMobile
    ? { zIndex }
    : { left: `${position.x}px`, top: `${position.y}px`, zIndex };

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 flex h-dvh w-full flex-col bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans select-none'
          : 'absolute flex w-80 flex-col bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans select-none'
      }
      style={windowStyle}
    >
      <div
        className={`flex h-7 shrink-0 items-center justify-between bg-blue-800 p-1 text-white ${isMobile ? '' : 'cursor-move'}`}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="flex min-w-0 items-center gap-1">
          <Image
            src="/guestbook.png"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 shrink-0 object-contain"
          />
          <span className="truncate text-sm font-bold">Guestbook.aim</span>
        </div>
        <Button
          variant="retro"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <X className="h-3 w-3 text-black" />
        </Button>
      </div>

      <div
        className={`space-y-3 p-4 text-sm text-black ${isMobile ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[calc(100vh-8rem)] overflow-y-auto'}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          ref={chatRef}
          className={`${INSET_PANEL} min-h-[180px] max-h-[240px] overflow-y-auto p-2`}
          style={{ fontFamily: 'Times New Roman, Times, serif' }}
        >
          {loading ? (
            <p className="text-xs italic text-neutral-500">Connecting…</p>
          ) : (
            entries.map((entry) => {
              const timestamp = formatGuestbookTimestamp(entry.createdAt);
              return (
                <p key={entry.id} className="mb-1.5 text-sm leading-snug">
                  <span className="font-bold text-blue-800">{entry.name}:</span>{' '}
                  {linkify(entry.message)}
                  {timestamp && (
                    <span className="ml-1 text-[10px] text-neutral-500">
                      ({timestamp})
                    </span>
                  )}
                </p>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Screen name"
            maxLength={50}
            className={INPUT_CLASS}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here…"
            maxLength={500}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
          <div className="flex justify-end">
            <Button
              variant="retro"
              disabled={sending || !message.trim()}
              onClick={() => void handleSend()}
              className="flex items-center gap-1.5 text-xs"
            >
              <Image
                src="/guestbook.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
