
'use client';

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Slider } from './ui/slider';
import type { FreesoundLayerInfo, GrainLayerInfo, SynthLayerInfo, AtmosphereLayerInfo } from './AudioEngine';
import { useState, useEffect } from 'react';

type LayerInfo = FreesoundLayerInfo | GrainLayerInfo | SynthLayerInfo | AtmosphereLayerInfo;

interface LayerMenuBarProps {
  type: 'synth' | 'freesound' | 'melodic' | 'grain' | 'atmosphere';
  send: number;
  playbackRate?: number;
  reverse?: boolean;
  filterCutoff?: number;
  filterResonance?: number;
  probability?: number;
  grainSize?: number;
  grainDrift?: number;
  info?: LayerInfo;
  onSendChange: (send: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onReverseChange: (reverse: boolean) => void;
  onFilterCutoffChange: (freq: number) => void;
  onFilterResonanceChange: (q: number) => void;
  onProbabilityChange: (value: number) => void;
  onGrainSizeChange: (size: number) => void;
  onGrainDriftChange: (drift: number) => void;
}

export default function LayerMenuBar({
  type,
  send,
  playbackRate,
  reverse,
  filterCutoff,
  filterResonance,
  probability,
  grainSize,
  grainDrift,
  info,
  onSendChange,
  onPlaybackRateChange,
  onReverseChange,
  onFilterCutoffChange,
  onFilterResonanceChange,
  onProbabilityChange,
  onGrainSizeChange,
  onGrainDriftChange,
}: LayerMenuBarProps) {

  const [localCutoff, setLocalCutoff] = useState(filterCutoff ?? 2000);
  const [localResonance, setLocalResonance] = useState(filterResonance ?? 1);
  const [localGrainSize, setLocalGrainSize] = useState(grainSize ?? 0.1);
  const [localGrainDrift, setLocalGrainDrift] = useState(grainDrift ?? 1.0);
  const speedMin = type === 'grain' ? 0.05 : 0.5;
  const speedMax = type === 'grain' ? 1.25 : 2;

  // Sync if initial values arrive after mount (async layer creation)
  useEffect(() => { if (filterCutoff != null) setLocalCutoff(filterCutoff); }, [filterCutoff]);
  useEffect(() => { if (filterResonance != null) setLocalResonance(filterResonance); }, [filterResonance]);
  useEffect(() => { if (grainSize != null) setLocalGrainSize(grainSize); }, [grainSize]);
  useEffect(() => { if (grainDrift != null) setLocalGrainDrift(grainDrift); }, [grainDrift]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const renderInfo = () => {
    if (!info) return <p className="text-xs italic">No info available.</p>;

    if (info.type === 'freesound' || info.type === 'grain') {
      return (
        <div className="space-y-2">
          <a
            href={`https://freesound.org/s/${info.id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            {info.name}
          </a>
          <p className="text-xs">{info.description}</p>
        </div>
      );
    }

    if (info.type === 'synth' || info.type === 'melodic' || info.type === 'atmosphere') {
      return <p className="text-xs">{info.description}</p>;
    }

    return null;
  };

  return (
    <div className="bg-silver text-black p-0 h-auto">
        <Menubar className="bg-transparent border-none p-0 h-auto" onMouseDown={handleMenuClick}>
           <MenubarMenu>
             <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto ">Info</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={(e) => e.preventDefault()}>
                <div className="w-64 text-black">
                  {renderInfo()}
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto ">Effects</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={(e) => e.preventDefault()}>
                <div className="w-48 text-black space-y-4">
                  <div>
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
                  {type !== 'freesound' && type !== 'grain' && type !== 'atmosphere' && (
                    <div>
                      <p className="text-xs mb-2">
                        Probability: {Math.round((probability ?? 1) * 100)}%
                      </p>
                      <Slider
                        defaultValue={[probability ?? 1]}
                        max={1}
                        min={0}
                        step={0.01}
                        onValueChange={(value) => onProbabilityChange(value[0])}
                      />
                    </div>
                  )}
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto">Filter</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onSelect={(e) => e.preventDefault()}>
                <div className="w-48 text-black space-y-4">
                  <div>
                    <p className="text-xs mb-2">
                      Cutoff: {(localCutoff / 1000).toFixed(1)} kHz
                    </p>
                    <Slider
                      value={[localCutoff]}
                      max={18000}
                      min={200}
                      step={50}
                      onValueChange={(value) => {
                        setLocalCutoff(value[0]);
                        onFilterCutoffChange(value[0]);
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs mb-2">
                      Resonance: {localResonance.toFixed(1)}
                    </p>
                    <Slider
                      value={[localResonance]}
                      max={12}
                      min={0.1}
                      step={0.1}
                      onValueChange={(value) => {
                        setLocalResonance(value[0]);
                        onFilterResonanceChange(value[0]);
                      }}
                    />
                  </div>
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          {(type === 'freesound' || type === 'grain') && (
            <MenubarMenu>
                <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto ">Speed</MenubarTrigger>
                <MenubarContent>
                    <MenubarItem onSelect={(e) => e.preventDefault()}>
                    <div className="w-48 text-black space-y-3">
                        <div>
                            <p className="text-xs text-black mb-2">
                                Speed: {playbackRate?.toFixed(2) ?? '1.00'}x
                            </p>
                            <Slider
                                value={[playbackRate ?? 1]}
                                max={speedMax}
                                min={speedMin}
                                step={0.01}
                                onValueChange={(value) => onPlaybackRateChange(value[0])}
                            />
                        </div>
                        <button
                            role="checkbox"
                            aria-checked={!!reverse}
                            onClick={() => onReverseChange(!reverse)}
                            className="flex items-center gap-2 cursor-pointer select-none group"
                        >
                            <span className="w-3.5 h-3.5 flex-shrink-0 border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white flex items-center justify-center">
                                {reverse && <span className="text-black leading-none" style={{ fontSize: '9px', marginTop: '-1px' }}>✓</span>}
                            </span>
                            <span className="text-xs">Reverse</span>
                        </button>
                    </div>
                    </MenubarItem>
                </MenubarContent>
            </MenubarMenu>
          )}
          {type === 'grain' && (
            <MenubarMenu>
              <MenubarTrigger className="text-black px-2 py-0.5 text-sm h-auto">Grain</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onSelect={(e) => e.preventDefault()}>
                  <div className="w-48 text-black space-y-4">
                    <div>
                      <p className="text-xs mb-2">
                        Size: {(localGrainSize * 1000).toFixed(0)} ms
                      </p>
                      <Slider
                        value={[localGrainSize]}
                        max={0.5}
                        min={0.02}
                        step={0.01}
                        onValueChange={(value) => {
                          setLocalGrainSize(value[0]);
                          onGrainSizeChange(value[0]);
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-2">
                        Scatter: {localGrainDrift.toFixed(2)} s
                      </p>
                      <Slider
                        value={[localGrainDrift]}
                        max={3.0}
                        min={0}
                        step={0.05}
                        onValueChange={(value) => {
                          setLocalGrainDrift(value[0]);
                          onGrainDriftChange(value[0]);
                        }}
                      />
                    </div>
                  </div>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          )}
        </Menubar>
    </div>
  );
}
