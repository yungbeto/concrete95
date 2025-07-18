'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Waves, Zap } from 'lucide-react';

export default function SoundscapeController() {
  return (
    <div className="absolute bottom-8 right-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" className="rounded-full w-16 h-16 shadow-lg">
            <Plus className="h-8 w-8" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 mr-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Add Layer</h4>
              <p className="text-sm text-muted-foreground">
                Select a sound source to add to the canvas.
              </p>
            </div>
            <div className="grid gap-2">
              <Button variant="outline">
                <Waves className="mr-2" />
                Freesound Loop
              </Button>
              <Button variant="outline">
                <Zap className="mr-2" />
                Synth Pad
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
