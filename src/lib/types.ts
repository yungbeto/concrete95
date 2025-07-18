export type ToneParams = {
  oscillatorType: string;
  reverbWet: number;
  lfoRate: number;
  filterFrequency: number;
};

export type Layering = {
  drone: boolean;
  texture: boolean;
  pulse: boolean;
};

export type SoundscapeState = {
  tone: ToneParams;
  freesound: {
    tags: string[];
  };
  layering: Layering;
};
