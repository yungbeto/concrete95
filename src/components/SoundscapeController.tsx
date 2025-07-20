
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Music, Square, Waves, Zap } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SoundscapeControllerProps {
  onAddSynthLayer: () => void;
  onAddFreesoundLayer: () => void;
  onAddMelodicLayer: () => void;
  onStopAll: () => void;
  canAddLayer: boolean;
  hasLayers: boolean;
}

const StartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2H9V9H2V2Z" fill="black"/>
    <path d="M11 2H18V9H11V2Z" fill="black"/>
    <path d="M2 11H9V18H2V11Z" fill="black"/>
    <path d="M11 11H18V18H11V11Z" fill="black"/>
  </svg>
);


export default function SoundscapeController({
  onAddSynthLayer,
  onAddFreesoundLayer,
  onAddMelodicLayer,
  onStopAll,
  canAddLayer,
  hasLayers,
}: SoundscapeControllerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddSynthLayer = () => {
    onAddSynthLayer();
    setIsOpen(false);
  };

  const handleAddFreesoundLayer = () => {
    onAddFreesoundLayer();
    setIsOpen(false);
  };
  
  const handleAddMelodicLayer = () => {
    onAddMelodicLayer();
    setIsOpen(false);
  };

  const handleStopAll = () => {
    onStopAll();
    setIsOpen(false);
  }


  return (
    <div className="z-10">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="start" size="sm" className="h-8">
            <StartIcon />
            <span className="font-bold">Start</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 mb-2 ml-1 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 !rounded-none" side="top" align="start">
          <div className="flex">
            <div
              className="w-8 flex items-center justify-center bg-neutral-500 text-white font-bold text-lg p-2 select-none"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              <span className="tracking-widest rotate-180">Concrete 95</span>
            </div>
            <div className="flex flex-col gap-1 text-black p-1 w-56">
                <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white disabled:hover:bg-transparent disabled:text-neutral-500" onClick={handleAddFreesoundLayer} disabled={!canAddLayer}>
                  <Waves className="mr-2 h-4 w-4" />
                  Sample Loop
                </Button>
                <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white disabled:hover:bg-transparent disabled:text-neutral-500" onClick={handleAddSynthLayer} disabled={!canAddLayer}>
                  <Zap className="mr-2 h-4 w-4" />
                  Synth Pad
                </Button>
                 <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white disabled:hover:bg-transparent disabled:text-neutral-500" onClick={handleAddMelodicLayer} disabled={!canAddLayer}>
                  <Music className="mr-2 h-4 w-4" />
                  Melodic Loop
                </Button>
                <Separator className="bg-neutral-500 my-1" />
                <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white disabled:hover:bg-transparent disabled:text-neutral-500" onClick={handleStopAll} disabled={!hasLayers}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop All
                </Button>
              </div>
            </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
