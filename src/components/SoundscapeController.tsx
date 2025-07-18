"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Wand2, Zap } from 'lucide-react';

interface SliderControl {
  name: string;
  value: number;
}

interface SoundscapeControllerProps {
  onGenerate: (values: Record<string, number>) => void;
  onSurprise: () => void;
  isLoading: boolean;
  hasGenerated: boolean;
}

const sliderDefaults: SliderControl[] = [
  { name: 'Ennui', value: 50 },
  { name: 'Fluidity', value: 50 },
  { name: 'Chaos', value: 50 },
  { name: 'Permanence', value: 50 },
];

export function SoundscapeController({ onGenerate, onSurprise, isLoading, hasGenerated }: SoundscapeControllerProps) {
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(
    sliderDefaults.reduce((acc, s) => ({ ...acc, [s.name]: s.value }), {})
  );

  const handleSliderChange = (name: string, value: number[]) => {
    setSliderValues(prev => ({ ...prev, [name]: value[0] }));
  };
  
  const handleGenerateClick = () => {
    const normalizedValues = Object.fromEntries(
      Object.entries(sliderValues).map(([key, value]) => [key.toLowerCase(), value / 100])
    );
    onGenerate(normalizedValues);
  };

  return (
    <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Craft Your Soundscape</CardTitle>
        <CardDescription>Adjust the emotional sliders to begin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-8">
          {sliderDefaults.map(slider => (
            <div key={slider.name} className="space-y-3">
              <Label htmlFor={slider.name} className="text-lg">{slider.name}</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id={slider.name}
                  min={0}
                  max={100}
                  step={1}
                  value={[sliderValues[slider.name]]}
                  onValueChange={(value) => handleSliderChange(slider.name, value)}
                  disabled={isLoading}
                />
                <span className="w-10 text-right text-muted-foreground">{sliderValues[slider.name]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button onClick={handleGenerateClick} disabled={isLoading} className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />
            {isLoading ? 'Generating...' : hasGenerated ? 'Regenerate' : 'Generate'}
          </Button>
          <Button onClick={onSurprise} disabled={isLoading || !hasGenerated} variant="outline" className="w-full">
            <Zap className="mr-2 h-4 w-4" />
            Surprise Me
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
