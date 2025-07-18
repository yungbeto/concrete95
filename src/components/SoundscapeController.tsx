'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function SoundscapeController() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Soundscape Layers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-muted rounded-lg">
          <p className="text-muted-foreground">No layers yet. Add one to begin.</p>
          <Button>
            <Plus className="mr-2" />
            Add Layer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
