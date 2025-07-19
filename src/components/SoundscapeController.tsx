
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Waves, Zap, Music } from 'lucide-react';

interface SoundscapeControllerProps {
  onAddSynthLayer: () => void;
  onAddFreesoundLayer: () => void;
  onAddMelodicLayer: () => void;
  isReady: boolean;
}

const WindowsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M0 15L45 10V48H0V15ZM0 52H45V90L0 85V52ZM50 8.5L98 0V48H50V8.5ZM50 52H98V100L50 91.5V52Z" fill="black"/>
  </svg>
);


export default function SoundscapeController({
  onAddSynthLayer,
  onAddFreesoundLayer,
  onAddMelodicLayer,
  isReady,
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


  return (
    <div className="z-10">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="start" size="sm" disabled={!isReady}>
            <WindowsIcon />
            <span className="font-bold">Start</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1 mb-2 ml-1 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 !rounded-none" side="top" align="start">
          <div className="grid gap-1 text-black">
              <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white" onClick={handleAddFreesoundLayer}>
                <Waves className="mr-2 h-4 w-4" />
                Freesound Loop
              </Button>
              <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white" onClick={handleAddSynthLayer}>
                <Zap className="mr-2 h-4 w-4" />
                Synth Pad
              </Button>
               <Button variant="ghost" className="justify-start gap-2 px-2 !rounded-none hover:bg-blue-800 hover:text-white" onClick={handleAddMelodicLayer}>
                <Music className="mr-2 h-4 w-4" />
                Melodic Loop
              </Button>
            </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
