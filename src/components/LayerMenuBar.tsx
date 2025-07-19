
'use client';

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Slider } from './ui/slider';

interface LayerMenuBarProps {
  type: 'synth' | 'freesound' | 'melodic';
  volume: number;
  send: number;
  playbackRate?: number;
  onVolumeChange: (volume: number) => void;
  onSendChange: (send: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

export default function LayerMenuBar({
  type,
  volume,
  send,
  playbackRate,
  onVolumeChange,
  onSendChange,
  onPlaybackRateChange,
}: LayerMenuBarProps) {

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <div className="bg-silver text-black p-0 h-auto">
        <Menubar className="bg-transparent border-none p-0 h-auto" onMouseDown={handleMenuClick}>
          <MenubarMenu>
            <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto focus:bg-blue-800 focus:text-white data-[state=open]:bg-blue-800 data-[state=open]:text-white">Effects</MenubarTrigger>
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
             <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto focus:bg-blue-800 focus:text-white data-[state=open]:bg-blue-800 data-[state=open]:text-white">Options</MenubarTrigger>
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
  );
}
