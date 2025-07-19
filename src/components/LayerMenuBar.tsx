
'use client';

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { X, Zap, Waves, Music } from 'lucide-react';

interface LayerMenuBarProps {
  title: string;
  type: 'synth' | 'freesound' | 'melodic';
  volume: number;
  send: number;
  playbackRate?: number;
  onVolumeChange: (volume: number) => void;
  onSendChange: (send: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onClose: () => void;
}

const layerIcons = {
  synth: <Zap className="w-4 h-4" />,
  freesound: <Waves className="w-4 h-4" />,
  melodic: <Music className="w-4 h-4" />,
};

export default function LayerMenuBar({
  title,
  type,
  volume,
  send,
  playbackRate,
  onVolumeChange,
  onSendChange,
  onPlaybackRateChange,
  onClose,
}: LayerMenuBarProps) {

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <div className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move">
      <div className="flex items-center gap-1">
        {layerIcons[type]}
        <Menubar className="bg-transparent border-none p-0 h-auto" onMouseDown={handleMenuClick}>
          <MenubarMenu>
            <MenubarTrigger className="text-white px-2 py-0 text-sm h-auto focus:bg-blue-900 data-[state=open]:bg-blue-900">Effects</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={(e) => e.preventDefault()}>
                <div className="w-48 text-black">
                  <p className="text-xs mb-2">
                    FX Send: {send > -40 ? `${send.toFixed(0)} dB` : 'Muted'}
                  </p>
                  <Slider
                    defaultValue={[send]}
                    max={10}
                    min={-40}
                    step={1}
                    onValueChange={(value) => onSendChange(value[0])}
                  />
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
             <MenubarTrigger className="text-white px-2 py-0 text-sm h-auto focus:bg-blue-900 data-[state=open]:bg-blue-900">Options</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={(e) => e.preventDefault()}>
                <div className="w-48 text-black">
                  <p className="text-xs mb-2">
                    Volume: {volume > -40 ? `${volume.toFixed(0)} dB` : 'Muted'}
                  </p>
                  <Slider
                    defaultValue={[volume]}
                    max={10}
                    min={-40}
                    step={1}
                    onValueChange={(value) => onVolumeChange(value[0])}
                  />
                </div>
              </MenubarItem>
              {type === 'freesound' && (
                <>
                <MenubarSeparator />
                <MenubarItem onSelect={(e) => e.preventDefault()}>
                   <div className="w-48 text-black">
                      <p className="text-xs text-black mb-2">
                        Speed: {playbackRate?.toFixed(2) ?? '1.00'}x
                      </p>
                      <Slider
                        defaultValue={[playbackRate ?? 1]}
                        max={2}
                        min={0.5}
                        step={0.01}
                        onValueChange={(value) => onPlaybackRateChange(value[0])}
                      />
                    </div>
                </MenubarItem>
                </>
              )}
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

      </div>
       <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{title}</span>
            <Button
              variant="retro"
              size="icon"
              className="w-5 h-5"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="w-3 h-3 text-black" />
            </Button>
       </div>
    </div>
  );
}
